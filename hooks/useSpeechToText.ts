"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "@/lib/utils";
import { parseTranscriptionStreamLine } from "@/lib/transcription/stream";
import { startLiveTranscription, type LiveTranscription } from "@/lib/transcription/realtimeClient";

export type SpeechToTextStatus = "idle" | "recording" | "transcribing" | "error";

interface UseSpeechToTextOptions {
  onTranscriptPreview?: (text: string) => void;
}

const MIN_RECORDING_DURATION_MS = 900;
const MIN_AUDIO_BLOB_SIZE = 2048;

function getSupportedMimeType() {
  if (typeof MediaRecorder === "undefined") return "";

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function getExtensionFromMimeType(mimeType: string) {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

function getSpeechErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Permissao de microfone negada. Libera o acesso e tenta de novo.";
    }
    if (error.name === "NotFoundError") {
      return "Nao encontrei nenhum microfone disponivel neste dispositivo.";
    }
    if (error.name === "NotReadableError") {
      return "O microfone esta ocupado por outro app ou nao pode ser acessado agora.";
    }
    if (error.name === "AbortError") {
      return "A captura de audio foi interrompida antes da transcricao terminar.";
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Nao consegui gravar ou transcrever teu audio agora.";
}

export function useSpeechToText({
  onTranscriptPreview,
}: UseSpeechToTextOptions = {}) {
  const [status, setStatus] = useState<SpeechToTextStatus>("idle");
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);
  const [transcriptPreview, setTranscriptPreview] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const shouldTranscribeRef = useRef(true);
  const stopResolverRef = useRef<((text: string | null) => void) | null>(null);
  const transcriptionAbortRef = useRef<AbortController | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const liveRef = useRef<LiveTranscription | null>(null);
  const generationRef = useRef(0);
  const busyRef = useRef(false);
  const stopPromiseRef = useRef<Promise<string | null> | null>(null);
  const previewCallbackRef = useRef(onTranscriptPreview);
  const previewTextRef = useRef("");
  useEffect(() => { previewCallbackRef.current = onTranscriptPreview; }, [onTranscriptPreview]);

  const publishTranscriptPreview = useCallback(
    (text: string) => {
      setTranscriptPreview(text);
      previewTextRef.current = text;
      previewCallbackRef.current?.(text);
    },
    []
  );

  const isSupported = useMemo(() => {
    if (typeof window === "undefined") return false;
    return Boolean(
      navigator.mediaDevices &&
        typeof MediaRecorder !== "undefined" &&
        typeof window.AudioContext !== "undefined"
    );
  }, []);

  const teardownVisualizer = useCallback(() => {
    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioSourceRef.current) {
      audioSourceRef.current.disconnect();
      audioSourceRef.current = null;
    }

    analyserRef.current = null;

    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    setAudioLevel(0);
  }, []);

  const stopDurationTracking = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  const startDurationTracking = useCallback(() => {
    stopDurationTracking();
    const startedAt = Date.now();
    recordingStartedAtRef.current = startedAt;
    setRecordingDurationMs(0);
    durationIntervalRef.current = setInterval(() => {
      setRecordingDurationMs(Date.now() - startedAt);
    }, 150);
  }, [stopDurationTracking]);

  const teardownStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const teardownSession = useCallback(() => {
    liveRef.current?.cancel();
    liveRef.current = null;
    stopDurationTracking();
    teardownVisualizer();
    teardownStream();
    recorderRef.current = null;
    chunksRef.current = [];
    recordingStartedAtRef.current = null;
  }, [stopDurationTracking, teardownStream, teardownVisualizer]);

  const transcribeAudio = useCallback(async (blob: Blob, generation: number) => {
    const controller = new AbortController();
    transcriptionAbortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 120000);
    try {

      const mimeType = blob.type || "audio/webm";
      const file = new File([blob], `gravacao.${getExtensionFromMimeType(mimeType)}`, {
        type: mimeType,
      });
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(apiUrl("/api/transcribe"), {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const isStreaming = response.headers
        .get("content-type")
        ?.includes("application/x-ndjson");

      if (response.ok && isStreaming && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";
        let completedText = "";
        let completed = false;

        while (true) {
          const { done, value } = await reader.read();
          if (generation !== generationRef.current) return "";
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split("\n");
          buffer = done ? "" : lines.pop() ?? "";

          for (const line of lines) {
            const event = parseTranscriptionStreamLine(line);
            if (!event) continue;
            if (event.type === "error") throw new Error(event.error);
            if (event.type === "delta") {
              accumulated += event.delta;
              publishTranscriptPreview(accumulated);
            } else {
              completed = true;
              completedText = event.text;
              publishTranscriptPreview(event.text);
            }
          }

          if (done) break;
        }

        if (!completed) throw new Error("A transcrição foi interrompida. O texto parcial foi preservado.");
        return completedText.trim();
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Falha ao transcrever teu audio."
        );
      }

      if (typeof data.text !== "string") {
        throw new Error("A API de transcricao nao devolveu texto valido.");
      }

      return data.text.trim();
    } finally {
      clearTimeout(timeout);
    }
  }, [publishTranscriptPreview]);

  const resolveStop = useCallback((text: string | null) => {
    const resolve = stopResolverRef.current;
    stopResolverRef.current = null;
    stopPromiseRef.current = null;
    busyRef.current = false;
    resolve?.(text);
  }, []);

  const finalizeStop = useCallback(async (generation: number) => {
    if (generation !== generationRef.current) return;
    const recorder = recorderRef.current;
    const mimeType = recorder?.mimeType || "audio/webm";
    const chunks = [...chunksRef.current];
    const shouldTranscribe = shouldTranscribeRef.current;
    const durationMs = recordingStartedAtRef.current
      ? Date.now() - recordingStartedAtRef.current
      : recordingDurationMs;

    setStatus("transcribing");
    const liveText = shouldTranscribe ? await liveRef.current?.finish() : null;
    if (generation !== generationRef.current) return;
    const partialText = previewTextRef.current;
    teardownSession();

    if (!shouldTranscribe) {
      setError(null);
      setStatus("idle");
      setRecordingDurationMs(0);
      resolveStop(null);
      return;
    }

    if (liveText == null && chunks.length === 0) {
      setError("Nao consegui captar audio suficiente para transcrever.");
      setStatus("error");
      setRecordingDurationMs(0);
      resolveStop(null);
      return;
    }

    const blob = new Blob(chunks, { type: mimeType });
    if (liveText == null && (durationMs < MIN_RECORDING_DURATION_MS || blob.size < MIN_AUDIO_BLOB_SIZE)) {
      setError("A gravacao ficou curta demais. Tenta falar por pelo menos um segundo.");
      setStatus("error");
      setRecordingDurationMs(0);
      resolveStop(null);
      return;
    }

    try {
      const text = liveText ?? await transcribeAudio(blob, generation);
      if (generation !== generationRef.current) return;
      if (!text) {
        setError("Nao saiu texto da transcricao. Tenta gravar mais um pouco.");
        setStatus("error");
        setRecordingDurationMs(0);
        resolveStop(null);
        return;
      }

      setError(null);
      publishTranscriptPreview(text);
      setStatus("idle");
      setRecordingDurationMs(0);
      resolveStop(text);
    } catch (transcriptionError) {
      if (generation !== generationRef.current) return;
      if (partialText) publishTranscriptPreview(partialText);
      setError(getSpeechErrorMessage(transcriptionError));
      setStatus("error");
      setRecordingDurationMs(0);
      resolveStop(null);
    } finally {
      if (generation === generationRef.current) {
        transcriptionAbortRef.current = null;
        chunksRef.current = [];
      }
    }
  }, [recordingDurationMs, resolveStop, teardownSession, transcribeAudio, publishTranscriptPreview]);

  const startVisualizer = useCallback(async (stream: MediaStream, audioContext: AudioContext) => {
    await audioContext.resume();

    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    source.connect(analyser);

    audioContextRef.current = audioContext;
    audioSourceRef.current = source;
    analyserRef.current = analyser;

    const buffer = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      const currentAnalyser = analyserRef.current;
      if (!currentAnalyser) return;

      currentAnalyser.getByteFrequencyData(buffer);
      const average =
        buffer.reduce((sum, value) => sum + value, 0) / buffer.length / 255;
      setAudioLevel(Math.min(1, average * 1.9));
      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    tick();
  }, []);

  const cancelRecording = useCallback(async () => {
    generationRef.current += 1;
    shouldTranscribeRef.current = false;
    transcriptionAbortRef.current?.abort();

    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();

    teardownSession();
    setError(null);
    setStatus("idle");
    setRecordingDurationMs(0);
    setTranscriptPreview("");
    resolveStop(null);
  }, [resolveStop, teardownSession]);

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError("Este navegador nao suporta gravacao de audio.");
      setStatus("error");
      return false;
    }

    if (busyRef.current) {
      return false;
    }
    busyRef.current = true;
    const generation = ++generationRef.current;

    try {
      setError(null);
      shouldTranscribeRef.current = true;
      chunksRef.current = [];
      setTranscriptPreview("");
      previewTextRef.current = "";
      setRecordingDurationMs(0);
      // Criado no gesto do usuário para desbloquear áudio também no celular.
      const context = new window.AudioContext();
      audioContextRef.current = context;
      void context.resume().catch(() => undefined);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (generation !== generationRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorderRef.current = recorder;

      recorder.addEventListener("dataavailable", (event) => {
        if (generation === generationRef.current && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener("stop", () => {
        void finalizeStop(generation);
      });

      recorder.addEventListener("error", () => {
        if (generation !== generationRef.current) return;
        generationRef.current += 1;
        setError("A gravacao do microfone falhou antes da transcricao.");
        setStatus("error");
        setRecordingDurationMs(0);
        teardownSession();
        resolveStop(null);
      });

      await startVisualizer(stream, context);
      if (generation !== generationRef.current) return false;
      startDurationTracking();
      recorder.start();
      liveRef.current = startLiveTranscription(stream, context, (text) => {
        if (generation === generationRef.current) publishTranscriptPreview(text);
      });
      setStatus("recording");
      return true;
    } catch (recordingError) {
      if (generation !== generationRef.current) return false;
      setError(getSpeechErrorMessage(recordingError));
      setStatus("error");
      teardownSession();
      resolveStop(null);
      return false;
    }
  }, [
    finalizeStop,
    isSupported,
    resolveStop,
    startVisualizer,
    startDurationTracking,
    teardownSession,
    publishTranscriptPreview,
  ]);

  const stopRecording = useCallback(async () => {
    if (stopPromiseRef.current) return stopPromiseRef.current;
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") {
      return null;
    }

    setStatus("transcribing");
    setAudioLevel(0);
    stopDurationTracking();

    stopPromiseRef.current = new Promise<string | null>((resolve) => {
      stopResolverRef.current = resolve;
      void liveRef.current?.finish();
      recorder.stop();
    });
    return stopPromiseRef.current;
  }, [stopDurationTracking]);

  const toggleRecording = useCallback(async () => {
    if (status === "recording") {
      return stopRecording();
    }

    const started = await startRecording();
    return started ? null : null;
  }, [startRecording, status, stopRecording]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && busyRef.current) {
        void cancelRecording();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [cancelRecording]);

  useEffect(() => {
    return () => {
      generationRef.current += 1;
      shouldTranscribeRef.current = false;
      transcriptionAbortRef.current?.abort();
      const recorder = recorderRef.current;
      if (recorder?.state === "recording") {
        recorder.stop();
      }
      teardownSession();
      resolveStop(null);
    };
  }, [teardownSession, resolveStop]);

  return {
    audioLevel,
    error,
    isSupported,
    recordingDurationMs,
    status,
    transcriptPreview,
    startRecording,
    stopRecording,
    toggleRecording,
  };
}
