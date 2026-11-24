"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildSoundCaseRealtimeSegments } from "@/hooks/useSoundCaseRealtime";
import { soundCaseApi } from "@/lib/soundcase/api";
import { SoundCasePcmPlayer } from "@/lib/soundcase/grokRealtimeAudio";
import { resumeBrowserAudio } from "@/lib/tts/browserAudio";
import { readOpenAILiveSettings } from "@/hooks/useOpenAILiveSettings";
import { normalizeLiveTranscript, OPENAI_LIVE_SPEECH_LIMIT } from "@/lib/tts/openaiLiveSpeech";
import { sanitizeSpeechText } from "@/lib/tts/speechText";
import { apiUrl } from "@/lib/utils";

type SpeechInput = { text: string } | { projectId: string; versionId: string };
type SpeechStatus = "idle" | "connecting" | "speaking" | "completed" | "error";
type SpeechState = {
  status: SpeechStatus;
  versionId: string | null;
  firstAudioMs: number | null;
  error: string | null;
};
const idle: SpeechState = { status: "idle", versionId: null, firstAudioMs: null, error: null };

export function useOpenAILiveSpeech() {
  const [state, setState] = useState<SpeechState>(idle);
  const requestRef = useRef<AbortController | null>(null);
  const playerRef = useRef<SoundCasePcmPlayer | null>(null);

  const release = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    playerRef.current?.clear();
    playerRef.current = null;
  }, []);

  const stop = useCallback(() => {
    release();
    setState(idle);
  }, [release]);

  const prime = useCallback(() => { void resumeBrowserAudio().catch(() => undefined); }, []);

  const start = useCallback(async (input: SpeechInput) => {
    release();
    const request = new AbortController();
    requestRef.current = request;
    const { signal } = request;
    const versionId = "versionId" in input ? input.versionId : null;
    const startedAt = performance.now();
    setState({ ...idle, status: "connecting", versionId });

    try {
      const context = await resumeBrowserAudio();
      if (signal.aborted) return;
      if (!context) throw new Error("O navegador não oferece reprodução de áudio ao vivo.");
      const player = new SoundCasePcmPlayer(context);
      playerRef.current = player;
      const source = "text" in input
        ? sanitizeSpeechText(input.text)
        : await soundCaseApi.getVersionSource(input.projectId, input.versionId, AbortSignal.any([signal, AbortSignal.timeout(15_000)]));
      const segments = buildSoundCaseRealtimeSegments(source, OPENAI_LIVE_SPEECH_LIMIT)
        .filter(({ text }) => normalizeLiveTranscript(text));
      if (!segments.length) throw new Error("Este conteúdo não tem texto para ler.");

      // Lida no início: trocar a voz no meio da leitura vale para a próxima, sem misturar vozes.
      const { voice, pace } = readOpenAILiveSettings();
      for (const { text } of segments) {
        if (signal.aborted) return;
        const response = await fetch(apiUrl("/api/realtime/openai-live-speech"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice, pace }),
          signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]),
        });
        if (!response.ok) {
          const result = await response.json().catch(() => null);
          throw new Error(result?.error ?? "Não consegui gerar este trecho com o Live 1.1.");
        }
        const pcm = await response.arrayBuffer();
        if (!pcm.byteLength || pcm.byteLength % 2) throw new Error("O Live 1.1 devolveu áudio inválido.");
        await player.drained();
        if (signal.aborted) return;
        player.enqueue(pcm);
        setState((current) => ({
          ...current,
          status: "speaking",
          firstAudioMs: current.firstAudioMs ?? Math.round(performance.now() - startedAt),
        }));
      }
      await player.drained();
      if (!signal.aborted) setState((current) => ({ ...current, status: "completed", versionId: null }));
    } catch (error) {
      if (signal.aborted) return;
      await playerRef.current?.drained();
      if (signal.aborted) return;
      setState((current) => ({
        ...current,
        status: "error",
        error: error instanceof DOMException && error.name === "TimeoutError"
          ? "O Live 1.1 demorou demais para responder."
          : error instanceof Error ? error.message : "Não consegui concluir a leitura com o Live 1.1.",
      }));
    } finally {
      if (requestRef.current === request) release();
    }
  }, [release]);

  useEffect(() => release, [release]);

  return {
    ...state,
    errorVersionId: state.error ? state.versionId : null,
    isActive: state.status === "connecting" || state.status === "speaking",
    prime, start, stop,
  };
}
