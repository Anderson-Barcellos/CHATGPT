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
  /** Partes já geradas; a geração segue mesmo com a escuta parada ou pausada. */
  generatedClips: number;
  /** Falha de geração que a reprodução ainda não alcançou. */
  generationError: string | null;
  /** Posição e duração da leitura inteira, em segundos. */
  currentTime: number;
  duration: number;
  /** A duração inclui uma estimativa das partes que ainda não chegaram. */
  durationEstimated: boolean;
  /** Segundos já gerados em sequência a partir do início; é até onde dá para avançar. */
  bufferedTime: number;
};
const idle: SpeechState = {
  status: "idle", versionId: null, firstAudioMs: null, error: null, audioUrl: null, clipIndex: 0, totalClips: 0,
  generatedClips: 0, generationError: null, currentTime: 0, duration: 0, durationEstimated: false, bufferedTime: 0,
};
/** A rota devolve PCM 16 bits mono a 24 kHz depois de um cabeçalho de 44 bytes. */
const WAV_HEADER_BYTES = 44;
const WAV_BYTES_PER_SECOND = 48_000;
/** Folga para o avanço não cair exatamente no fim do que já foi gerado. */
const SEEK_END_MARGIN = 0.25;

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
  /** Duração de cada parte gerada e tamanho do texto de todas, para estimar o total. */
  durations: (number | undefined)[];
  chars: number[];
  mergedUrl: string | null;
  index: number;
  /** A reprodução chegou numa parte que ainda não foi gerada. */
  waiting: boolean;
  /** Já há uma parte carregada no elemento de áudio. */
  live: boolean;
  /** A pessoa quer a leitura tocando; parar ou pausar a escuta não interrompe a geração. */
  wantsPlay: boolean;
  /** Posição a aplicar quando a parte recém-carregada tiver metadados. */
  pendingSeek: number | null;
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

function partOffset(session: Session, index: number): number {
  let offset = 0;
  for (let part = 0; part < index; part += 1) offset += session.durations[part] ?? 0;
  return offset;
}

/** Duração total (estimada pelo ritmo das partes prontas enquanto faltar alguma) e trecho contínuo já gerado. */
function timeline(session: Session) {
  let known = 0;
  let knownChars = 0;
  let missingChars = 0;
  let buffered = 0;
  let contiguous = true;
  session.chars.forEach((chars, index) => {
    const duration = session.durations[index];
    if (duration === undefined) {
      missingChars += chars;
      contiguous = false;
      return;
    }
    known += duration;
    knownChars += chars;
    if (contiguous) buffered += duration;
  });
  const estimated = missingChars > 0;
  const duration = estimated && knownChars ? known + missingChars * (known / knownChars) : known;
  return { duration, durationEstimated: estimated, bufferedTime: buffered };
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
    session.pendingSeek = null;
    audio.src = url;
    setState((current) => ({ ...current, clipIndex: index, currentTime: partOffset(session, index) }));
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
      session.wantsPlay = true;
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
      session.wantsPlay = false;
      const media = mediaSession();
      if (media) media.playbackState = "paused";
      setState((current) => ({ ...current, status: "paused" }));
    };
    audio.onloadedmetadata = () => {
      const session = live();
      if (!session || session.pendingSeek === null) return;
      audio.currentTime = session.pendingSeek;
      session.pendingSeek = null;
    };
    audio.ontimeupdate = () => {
      const session = live();
      if (!session || session.waiting || session.pendingSeek !== null) return;
      const currentTime = partOffset(session, session.index) + audio.currentTime;
      setState((current) => (current.currentTime === currentTime ? current : { ...current, currentTime }));
    };
    audio.onended = () => {
      const session = live();
      if (!session) return;
      if (session.index + 1 < session.blobs.length) {
        playPartRef.current(session, session.index + 1);
        return;
      }
      session.completed = true;
      session.wantsPlay = false;
      setState((current) => ({ ...current, status: "completed", currentTime: partOffset(session, session.blobs.length) }));
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
      blobs: [], urls: [], durations: [], chars: [], mergedUrl: null, index: 0, waiting: true, live: false,
      wantsPlay: true, pendingSeek: null, completed: false, failure: null,
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
      session.chars = parts.map((part) => part.length);
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
          session.durations[index] = (wav.size - WAV_HEADER_BYTES) / WAV_BYTES_PER_SECOND;
          setState((current) => ({ ...current, ...timeline(session), generatedClips: current.generatedClips + 1 }));
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
      else setState((current) => ({ ...current, generationError: message }));
    }
  }, [ensureAudio, fail, playPart, release]);

  const toggle = useCallback(() => {
    const session = sessionRef.current;
    const audio = audioRef.current;
    if (!session || !audio) return;
    if (session.completed || !session.live) {
      // Depois do fim recomeça da primeira parte; parada antes do primeiro áudio, toca a parte atual quando chegar.
      session.wantsPlay = true;
      playPart(session, session.completed ? 0 : session.index);
    } else if (audio.paused) {
      session.wantsPlay = true;
      void play(session, audio);
    } else audio.pause();
  }, [play, playPart]);

  /**
   * Para a escuta e volta ao início sem descartar nada: as partes seguem sendo
   * geradas e o arquivo completo fica disponível para salvar. `stop` é quem descarta.
   */
  const stopPlayback = useCallback(() => {
    const session = sessionRef.current;
    const audio = audioRef.current;
    if (!session) return;
    session.wantsPlay = false;
    session.waiting = false;
    session.completed = false;
    session.pendingSeek = null;
    session.index = 0;
    if (audio && session.live) {
      audio.pause();
      const first = session.urls[0]!;
      if (audio.getAttribute("src") === first) audio.currentTime = 0;
      else audio.src = first;
    }
    setState((current) => ({ ...current, status: "paused", clipIndex: 0, currentTime: 0 }));
  }, []);

  /** Avança ou volta dentro do que já foi gerado, trocando de parte quando preciso. */
  const seekBy = useCallback((seconds: number) => {
    const session = sessionRef.current;
    const audio = audioRef.current;
    if (!session || !audio || !session.live) return;
    const { bufferedTime } = timeline(session);
    const position = partOffset(session, session.index) + (session.waiting ? 0 : audio.currentTime);
    const target = Math.min(Math.max(position + seconds, 0), Math.max(bufferedTime - SEEK_END_MARGIN, 0));
    let index = 0;
    let offset = 0;
    while (session.urls[index + 1] && target >= offset + session.durations[index]!) {
      offset += session.durations[index]!;
      index += 1;
    }
    const url = session.urls[index]!;
    const local = target - offset;
    const resume = session.wantsPlay;
    session.index = index;
    session.waiting = false;
    session.completed = false;
    if (audio.getAttribute("src") === url) {
      session.pendingSeek = null;
      audio.currentTime = local;
    } else {
      session.pendingSeek = local;
      audio.src = url;
    }
    setState((current) => ({
      ...current, clipIndex: index, currentTime: target, status: resume ? current.status : "paused",
    }));
    if (resume) void play(session, audio);
  }, [play]);

  useEffect(() => release, [release]);

  return {
    ...state,
    errorVersionId: state.error ? state.versionId : null,
    isActive: state.status === "connecting" || state.status === "speaking",
    canResume: state.status === "ready" || state.status === "paused" || state.status === "completed",
    toggle,
    start,
    stop,
    stopPlayback,
    seekBy,
  };
}
