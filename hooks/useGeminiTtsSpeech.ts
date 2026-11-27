"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readGeminiTtsSettings } from "@/hooks/useGeminiTtsSettings";
import { soundCaseApi } from "@/lib/soundcase/api";
import { describeAudioPlayError, primeBrowserAudio } from "@/lib/tts/browserAudio";
import {
  GEMINI_TTS_PART_CONCURRENCY,
  GEMINI_TTS_REQUEST_TIMEOUT_MS,
  GEMINI_TTS_TEXT_LIMIT,
  joinGeminiWavs,
  splitGeminiSpeechText,
  type GeminiTtsSettings,
} from "@/lib/tts/geminiTts";
import { sanitizeSpeechText } from "@/lib/tts/speechText";
import { apiUrl } from "@/lib/utils";

type SpeechInput = { text: string } | { projectId: string; versionId: string };
type SpeechStatus = "idle" | "connecting" | "ready" | "speaking" | "paused" | "completed" | "error";
type SpeechState = {
  status: SpeechStatus;
  versionId: string | null;
  firstAudioMs: number | null;
  error: string | null;
  /** WAV completo; só existe depois que a última parte foi gerada. */
  audioUrl: string | null;
  clipIndex: number;
  totalClips: number;
};
const idle: SpeechState = {
  status: "idle", versionId: null, firstAudioMs: null, error: null, audioUrl: null, clipIndex: 0, totalClips: 0,
};

/**
 * Uma leitura em andamento. O texto é gerado em partes (ver `splitGeminiSpeechText`)
 * e a primeira toca assim que chega, enquanto as seguintes são geradas. Gerar tudo
 * antes de tocar deixava uma resposta comum mais de um minuto em silêncio.
 */
type Session = {
  request: AbortController;
  versionId: string | null;
  startedAt: number;
  blobs: Blob[];
  urls: (string | undefined)[];
  mergedUrl: string | null;
  index: number;
  /** A reprodução chegou numa parte que ainda não foi gerada. */
  waiting: boolean;
  /** Já há uma parte carregada no elemento de áudio. */
  live: boolean;
  completed: boolean;
  /** Falha numa parte adiante; só interrompe quando a reprodução chegar nela. */
  failure: string | null;
};

async function fetchPart(text: string, settings: GeminiTtsSettings, signal: AbortSignal): Promise<Blob> {
  const response = await fetch(apiUrl("/api/tts/gemini"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, ...settings }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(GEMINI_TTS_REQUEST_TIMEOUT_MS + 5_000)]),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.error ?? "Não consegui gerar o áudio do Gemini.");
  }
  const wav = await response.blob();
  if (wav.type !== "audio/wav" || wav.size <= 44) throw new Error("O Gemini TTS devolveu áudio inválido.");
  return wav;
}

/**
 * Media Session: avisa ao sistema que há mídia em andamento e põe tocar/pausar na
 * tela de bloqueio. Ajuda a leitura a seguir com o celular bloqueado ou o navegador
 * minimizado; quem decide de fato é o sistema de cada aparelho.
 */
function mediaSession(): MediaSession | null {
  return typeof navigator !== "undefined" && "mediaSession" in navigator ? navigator.mediaSession : null;
}

function describeFailure(error: unknown): string {
  if (error instanceof DOMException && error.name === "TimeoutError") return "O Gemini TTS demorou demais para responder.";
  return error instanceof Error ? error.message : "Não consegui concluir a leitura com o Gemini TTS.";
}

export function useGeminiTtsSpeech() {
  const [state, setState] = useState<SpeechState>(idle);
  const sessionRef = useRef<Session | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);
  const playPartRef = useRef<(session: Session, index: number) => void>(() => {});

  const release = useCallback(() => {
    const session = sessionRef.current;
    sessionRef.current = null;
    const audio = audioRef.current;
    if (audio && session?.live) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      const media = mediaSession();
      if (media) {
        media.metadata = null;
        media.playbackState = "none";
        media.setActionHandler("play", null);
        media.setActionHandler("pause", null);
      }
    }
    if (!session) return;
    session.request.abort();
    for (const url of session.urls) if (url) URL.revokeObjectURL(url);
    if (session.mergedUrl && !session.urls.includes(session.mergedUrl)) URL.revokeObjectURL(session.mergedUrl);
  }, []);

  const stop = useCallback(() => {
    release();
    setState(idle);
  }, [release]);

  const fail = useCallback((session: Session, message: string) => {
    if (sessionRef.current !== session) return;
    release();
    setState({ ...idle, status: "error", versionId: session.versionId, error: message });
  }, [release]);

  const play = useCallback(async (session: Session, audio: HTMLAudioElement) => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await audio.play();
        return;
      } catch (error) {
        if (sessionRef.current !== session) return;
        const name = error instanceof DOMException ? error.name : "";
        if (name === "NotAllowedError") {
          setState((current) => ({ ...current, status: "ready", error: null }));
          return;
        }
        // AbortError vem de uma pausa (nada a fazer) ou do destrave de áudio, que ao
        // terminar limpa o elemento se a parte chegou cedo demais: recarrega uma vez.
        const url = session.urls[session.index];
        if (name === "AbortError" && (!url || audio.getAttribute("src") === url)) return;
        if (name !== "AbortError" || attempt > 0) {
          fail(session, describeAudioPlayError(error, "Não consegui tocar o áudio do Gemini."));
          return;
        }
        audio.src = url!;
      }
    }
  }, [fail]);

  const playPart = useCallback((session: Session, index: number) => {
    const audio = audioRef.current;
    if (!audio || sessionRef.current !== session) return;
    session.index = index;
    session.completed = false;
    const url = session.urls[index];
    if (!url) {
      if (session.failure) {
        fail(session, session.failure);
        return;
      }
      session.waiting = true;
      setState((current) => ({ ...current, status: "connecting", clipIndex: index }));
      return;
    }
    session.waiting = false;
    session.live = true;
    audio.src = url;
    setState((current) => ({ ...current, clipIndex: index }));
    void play(session, audio);
  }, [fail, play]);

  useEffect(() => {
    playPartRef.current = playPart;
  }, [playPart]);

  /**
   * Um único elemento por player, criado e destravado dentro do toque do usuário:
   * as partes seguintes chegam segundos depois, fora do gesto, e o Safari do
   * iPhone só deixa tocar sem novo toque num elemento que já tocou.
   */
  const ensureAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    const audio = new Audio();
    audio.preload = "auto";
    const live = () => {
      const session = sessionRef.current;
      return session?.live ? session : null;
    };
    audio.onplaying = () => {
      const session = live();
      if (!session) return;
      const media = mediaSession();
      if (media) {
        if (!media.metadata && typeof MediaMetadata !== "undefined") {
          media.metadata = new MediaMetadata({ title: "Leitura em voz alta", artist: "Gemini TTS · Charon" });
        }
        media.playbackState = "playing";
        media.setActionHandler("play", () => { void audio.play().catch(() => undefined); });
        media.setActionHandler("pause", () => audio.pause());
      }
      setState((current) => ({
        ...current, status: "speaking", error: null,
        firstAudioMs: current.firstAudioMs ?? Math.round(performance.now() - session.startedAt),
      }));
    };
    audio.onpause = () => {
      const session = live();
      if (!session || session.waiting || audio.ended) return;
      const media = mediaSession();
      if (media) media.playbackState = "paused";
      setState((current) => ({ ...current, status: "paused" }));
    };
    audio.onended = () => {
      const session = live();
      if (!session) return;
      if (session.index + 1 < session.blobs.length) {
        playPartRef.current(session, session.index + 1);
        return;
      }
      session.completed = true;
      setState((current) => ({ ...current, status: "completed" }));
    };
    audio.onerror = () => {
      const session = live();
      if (session && !session.waiting) fail(session, "O navegador não conseguiu abrir o áudio do Gemini.");
    };
    audioRef.current = audio;
    return audio;
  }, [fail]);

  const start = useCallback(async (input: SpeechInput) => {
    release();
    primeBrowserAudio(ensureAudio(), unlockedRef);
    const versionId = "versionId" in input ? input.versionId : null;
    const session: Session = {
      request: new AbortController(), versionId, startedAt: performance.now(),
      blobs: [], urls: [], mergedUrl: null, index: 0, waiting: true, live: false, completed: false, failure: null,
    };
    sessionRef.current = session;
    const { signal } = session.request;
    const settings = readGeminiTtsSettings();
    setState({ ...idle, status: "connecting", versionId });

    try {
      const rawSource = "text" in input ? input.text : await soundCaseApi.getVersionSource(
        input.projectId, input.versionId, AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
      );
      const text = sanitizeSpeechText(rawSource, { preserveParagraphs: true });
      if (!text) throw new Error("Este conteúdo não tem texto para ler.");
      if (text.length > GEMINI_TTS_TEXT_LIMIT) throw new Error("O Gemini TTS aceita até 20.000 caracteres por leitura.");
      if (signal.aborted) return;

      const parts = splitGeminiSpeechText(text);
      session.blobs.length = parts.length;
      setState((current) => ({ ...current, totalClips: parts.length }));

      let next = 0;
      const worker = async () => {
        while (next < parts.length && !signal.aborted && !session.failure) {
          const index = next;
          next += 1;
          const wav = await fetchPart(parts[index], settings, signal);
          if (signal.aborted) return;
          session.blobs[index] = wav;
          session.urls[index] = URL.createObjectURL(wav);
          if (session.waiting && session.index === index) playPart(session, index);
        }
      };
      await Promise.all(Array.from({ length: Math.min(GEMINI_TTS_PART_CONCURRENCY, parts.length) }, worker));
      if (signal.aborted || sessionRef.current !== session) return;

      session.mergedUrl = parts.length === 1 ? session.urls[0]! : URL.createObjectURL(joinGeminiWavs(session.blobs));
      setState((current) => ({ ...current, audioUrl: session.mergedUrl }));
    } catch (error) {
      if (signal.aborted || sessionRef.current !== session) return;
      // As demais gerações param; o que já chegou continua tocando até a parte que falta.
      const message = describeFailure(error);
      session.failure = message;
      if (session.waiting) fail(session, message);
    }
  }, [ensureAudio, fail, playPart, release]);

  const toggle = useCallback(() => {
    const session = sessionRef.current;
    const audio = audioRef.current;
    if (!session || !audio || !session.live) return;
    if (session.completed) playPart(session, 0);
    else if (audio.paused) void play(session, audio);
    else audio.pause();
  }, [play, playPart]);

  useEffect(() => release, [release]);

  return {
    ...state,
    errorVersionId: state.error ? state.versionId : null,
    isActive: state.status === "connecting" || state.status === "speaking",
    canResume: state.status === "ready" || state.status === "paused" || state.status === "completed",
    toggle,
    start,
    stop,
  };
}
