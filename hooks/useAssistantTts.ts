"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { apiUrl } from "@/lib/utils";
import {
  DEFAULT_TTS_PREFERENCES,
  getTtsChunkingProfile,
  isDownloadableTtsFormat,
  normalizeTtsPreferences,
  TTS_CONTENT_TYPES,
  splitSpeechText,
} from "@/lib/tts/speechText";
import {
  decodeBrowserAudio,
  describeAudioPlayError,
  primeBrowserAudio,
  resumeBrowserAudio,
} from "@/lib/tts/browserAudio";
import { useSettingsStore } from "@/stores/settingsStore";

type TtsStatus = "idle" | "loading" | "playing" | "paused" | "error";

interface AudioClip {
  url: string;
  blob: Blob;
  duration: number;
  audioBuffer: AudioBuffer | null;
}

interface CachedSpeech {
  chunks: string[];
  clips: AudioClip[];
  complete: boolean;
  failed: boolean;
}

const speechCache = new Map<string, CachedSpeech>();
const BROWSER_AUDIO_BLOCKED_MESSAGE =
  "Áudio pronto — clique em tocar para liberar o navegador.";

function hashText(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function formatDuration(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function buildTtsDownloadFilename(messageId: string, extension: string): string {
  const safeId = messageId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "resposta";
  return `gaucho-chat-voz-${safeId}.${extension}`;
}

function isCacheDownloadReady(cache: CachedSpeech | null | undefined): cache is CachedSpeech {
  return Boolean(
    cache?.complete &&
      !cache.failed &&
      cache.clips.length === cache.chunks.length &&
      cache.chunks.every((_, index) => Boolean(cache.clips[index]?.blob))
  );
}

export function useAssistantTts(content: string, messageId: string) {
  const customInstructions = useSettingsStore((state) => state.customInstructions);
  const preferences = normalizeTtsPreferences(
    customInstructions?.ttsPreferences ?? DEFAULT_TTS_PREFERENCES
  );
  const chunkingProfile = getTtsChunkingProfile(preferences.mode);
  const chunks = useMemo(
    () => splitSpeechText(content, { mode: preferences.mode }),
    [content, preferences.mode]
  );
  const cacheKey = useMemo(
    () =>
      [
        messageId,
        hashText(content),
        preferences.voice,
        preferences.speed.toFixed(2),
        preferences.mode,
        preferences.format,
        hashText(preferences.instructions),
      ].join(":"),
    [
      content,
      messageId,
      preferences.instructions,
      preferences.mode,
      preferences.speed,
      preferences.voice,
      preferences.format,
    ]
  );

  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<TtsStatus>("idle");
  const [clipIndex, setClipIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDownloadReady, setIsDownloadReady] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);
  const playbackModeRef = useRef<"html" | "web-audio" | null>(null);
  const webAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const webAudioStartedAtRef = useRef(0);
  const webAudioOffsetRef = useRef(0);
  const webAudioTimerRef = useRef<number | null>(null);
  const suppressWebAudioEndedRef = useRef(false);
  const handleClipEndedRef = useRef<() => void>(() => {});
  const activeCacheRef = useRef<CachedSpeech | null>(null);
  const abortControllersRef = useRef<Set<AbortController>>(new Set());
  const generatingKeyRef = useRef<string | null>(null);
  const requestedPlayRef = useRef(false);
  const waitingForClipRef = useRef<number | null>(null);
  const clipIndexRef = useRef(0);

  const totalClips = chunks.length || 1;
  const isPlaying = status === "playing";
  const canPlay = chunks.length > 0;

  const clearWebAudioTimer = useCallback(() => {
    if (webAudioTimerRef.current === null) return;
    window.clearInterval(webAudioTimerRef.current);
    webAudioTimerRef.current = null;
  }, []);

  const getWebAudioPosition = useCallback(() => {
    const clip = activeCacheRef.current?.clips[clipIndexRef.current];

    if (!webAudioSourceRef.current || !clip) return webAudioOffsetRef.current;

    const audioContext = webAudioSourceRef.current.context;
    const elapsed =
      webAudioOffsetRef.current +
      Math.max(0, audioContext.currentTime - webAudioStartedAtRef.current);

    return Math.min(elapsed, clip.duration || elapsed);
  }, []);

  const stopWebAudioSource = useCallback((storePosition: boolean) => {
    if (storePosition) {
      webAudioOffsetRef.current = getWebAudioPosition();
    }

    suppressWebAudioEndedRef.current = true;

    const source = webAudioSourceRef.current;
    webAudioSourceRef.current = null;

    if (source) {
      try {
        source.stop();
      } catch {
        // Already stopped sources throw in some browsers.
      }
      source.disconnect();
    }

    clearWebAudioTimer();
  }, [clearWebAudioTimer, getWebAudioPosition]);

  const abortGeneration = useCallback(() => {
    abortControllersRef.current.forEach((controller) => controller.abort());
    abortControllersRef.current.clear();
    generatingKeyRef.current = null;
    waitingForClipRef.current = null;
  }, []);

  const playClip = useCallback((index: number, startAt = 0) => {
    const audio = audioRef.current;
    const cache = activeCacheRef.current;
    const clip = cache?.clips[index];
    if (!clip) return false;

    const clipDuration = clip.audioBuffer?.duration || clip.duration || 0;
    const safeOffset = clipDuration
      ? Math.min(Math.max(startAt, 0), Math.max(0, clipDuration - 0.05))
      : 0;

    const playHtmlAudio = () => {
      if (!audio) return false;

      stopWebAudioSource(false);
      playbackModeRef.current = "html";

      audio.muted = false;
      audio.src = clip.url;

      if (safeOffset > 0) {
        audio.addEventListener(
          "loadedmetadata",
          () => {
            if (Number.isFinite(audio.duration)) {
              audio.currentTime = Math.min(safeOffset, audio.duration);
            }
          },
          { once: true }
        );
      }

      void audio
        .play()
        .then(() => {
          setStatus("playing");
          setError(null);
        })
        .catch((playError) => {
          console.warn("HTML audio TTS playback failed:", playError);
          requestedPlayRef.current = false;
          playbackModeRef.current = null;
          setStatus("paused");
          setError(describeAudioPlayError(playError, BROWSER_AUDIO_BLOCKED_MESSAGE));
        });

      return true;
    };

    clipIndexRef.current = index;
    setClipIndex(index);
    setDuration(clipDuration);
    setCurrentTime(safeOffset);

    if (clip.audioBuffer) {
      stopWebAudioSource(false);
      audio?.pause();
      audio?.removeAttribute("src");
      audio?.load();

      void resumeBrowserAudio()
        .then((context) => {
          if (!context) {
            if (!requestedPlayRef.current) return;
            playHtmlAudio();
            return;
          }

          if (!requestedPlayRef.current) return;

          const source = context.createBufferSource();
          source.buffer = clip.audioBuffer;
          source.connect(context.destination);

          suppressWebAudioEndedRef.current = false;
          webAudioSourceRef.current = source;
          webAudioOffsetRef.current = safeOffset;
          webAudioStartedAtRef.current = context.currentTime;
          playbackModeRef.current = "web-audio";

          source.onended = () => {
            if (suppressWebAudioEndedRef.current) return;
            webAudioSourceRef.current = null;
            playbackModeRef.current = null;
            webAudioOffsetRef.current = 0;
            clearWebAudioTimer();
            handleClipEndedRef.current();
          };

          source.start(0, safeOffset);
          clearWebAudioTimer();
          webAudioTimerRef.current = window.setInterval(() => {
            setCurrentTime(getWebAudioPosition());
          }, 200);

          setStatus("playing");
          setError(null);
        })
        .catch((playError) => {
          console.warn("Web Audio TTS playback failed:", playError);
          if (!requestedPlayRef.current) return;
          if (!playHtmlAudio()) {
            requestedPlayRef.current = false;
            setStatus("paused");
            setError(describeAudioPlayError(playError, BROWSER_AUDIO_BLOCKED_MESSAGE));
          }
        });

      return true;
    }

    if (!playHtmlAudio()) return false;
    return true;
  }, [clearWebAudioTimer, getWebAudioPosition, stopWebAudioSource]);

  const fetchClip = useCallback(async (
    chunk: string,
    signal: AbortSignal
  ): Promise<AudioClip> => {
    const response = await fetch(apiUrl("/api/tts"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: chunk,
        voice: preferences.voice,
        speed: preferences.speed,
        instructions: preferences.instructions,
        format: preferences.format,
      }),
      signal,
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(payload?.error || "Falha ao gerar voz.");
    }

    const blob = await response.blob();
    const audioBuffer = await decodeBrowserAudio(await blob.arrayBuffer());
    return {
      url: URL.createObjectURL(blob),
      blob,
      duration: audioBuffer?.duration ?? 0,
      audioBuffer,
    };
  }, [preferences.format, preferences.instructions, preferences.speed, preferences.voice]);

  const generateClips = useCallback(async () => {
    if (!chunks.length) {
      setStatus("error");
      setError("Essa resposta não tem texto para narrar.");
      return;
    }

    let cache = speechCache.get(cacheKey);
    if (cache?.complete && cache.clips.length && !cache.failed) {
      activeCacheRef.current = cache;
      setIsDownloadReady(isCacheDownloadReady(cache));
      playClip(clipIndexRef.current);
      return;
    }

    if (cache && !cache.complete && generatingKeyRef.current === cacheKey) {
      activeCacheRef.current = cache;
      setStatus("loading");
      return;
    }

    cache = { chunks, clips: [], complete: false, failed: false };
    speechCache.set(cacheKey, cache);
    activeCacheRef.current = cache;
    setIsDownloadReady(false);
    setStatus("loading");
    setError(null);

    abortGeneration();
    generatingKeyRef.current = cacheKey;
    const controllers = abortControllersRef.current;
    let nextIndex = 1;

    const generateIndex = async (index: number) => {
      const controller = new AbortController();
      controllers.add(controller);

      try {
        const clip = await fetchClip(chunks[index], controller.signal);
        cache.clips[index] = clip;

        if (requestedPlayRef.current && index === 0) {
          playClip(0);
        }

        if (waitingForClipRef.current === index) {
          waitingForClipRef.current = null;
          playClip(index);
        }
      } finally {
        controllers.delete(controller);
      }
    };

    const worker = async () => {
      while (nextIndex < chunks.length) {
        const index = nextIndex;
        nextIndex += 1;
        await generateIndex(index);
      }
    };

    try {
      const firstClipPromise = generateIndex(0);
      const workerCount = Math.max(0, Math.min(chunkingProfile.concurrency - 1, chunks.length - 1));
      const workers = Array.from({ length: workerCount }, () => worker());

      await Promise.all([firstClipPromise, ...workers]);

      cache.complete = true;
      setIsDownloadReady(isCacheDownloadReady(cache));
      generatingKeyRef.current = null;
      if (status === "loading" && cache.clips.length > 0 && !requestedPlayRef.current) {
        setStatus("paused");
      }
    } catch (err) {
      if (controllers.size === 0 && generatingKeyRef.current === null) return;
      cache.failed = true;
      setIsDownloadReady(false);
      generatingKeyRef.current = null;
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
      const message = err instanceof Error ? err.message : "Falha ao gerar voz.";
      setStatus("error");
      setError(message);
      toast.error(message);
    }
  }, [
    cacheKey,
    abortGeneration,
    chunkingProfile.concurrency,
    chunks,
    fetchClip,
    playClip,
    status,
  ]);

  const openAndPlay = useCallback(() => {
    setIsOpen(true);
    requestedPlayRef.current = true;

    const cache = speechCache.get(cacheKey);
    if (
      cache?.clips[clipIndexRef.current] &&
      (cache.complete || generatingKeyRef.current === cacheKey)
    ) {
      activeCacheRef.current = cache;
      playClip(clipIndexRef.current);
      return;
    }

    primeBrowserAudio(audioRef.current, audioUnlockedRef);
    void generateClips();
  }, [cacheKey, generateClips, playClip]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!isOpen || status === "idle" || status === "error") {
      openAndPlay();
      return;
    }

    if (status === "playing") {
      requestedPlayRef.current = false;

      if (playbackModeRef.current === "web-audio") {
        stopWebAudioSource(true);
        setCurrentTime(webAudioOffsetRef.current);
        setStatus("paused");
        return;
      }

      audio?.pause();
      setStatus("paused");
      return;
    }

    requestedPlayRef.current = true;

    const cache = activeCacheRef.current;
    const clip = cache?.clips[clipIndexRef.current];
    if (clip?.audioBuffer) {
      playClip(clipIndexRef.current, currentTime || webAudioOffsetRef.current);
      return;
    }

    void audio
      ?.play()
      .then(() => {
        setStatus("playing");
        setError(null);
      })
      .catch((playError) => {
        requestedPlayRef.current = false;
        setStatus("paused");
        setError(
          describeAudioPlayError(
            playError,
            "O navegador ainda bloqueou o áudio. Clique em tocar novamente."
          )
        );
      });
  }, [currentTime, isOpen, openAndPlay, playClip, status, stopWebAudioSource]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    requestedPlayRef.current = false;
    abortGeneration();
    stopWebAudioSource(false);
    playbackModeRef.current = null;
    webAudioOffsetRef.current = 0;
    audio?.pause();
    if (audio) audio.currentTime = 0;
    clipIndexRef.current = 0;
    setClipIndex(0);
    setCurrentTime(0);
    setStatus(activeCacheRef.current?.clips.length ? "paused" : "idle");
  }, [abortGeneration, stopWebAudioSource]);

  const seekBy = useCallback((seconds: number) => {
    const cache = activeCacheRef.current;
    const clip = cache?.clips[clipIndexRef.current];

    if (clip?.audioBuffer) {
      const clipDuration = clip.duration || clip.audioBuffer.duration || duration;
      const position =
        status === "playing" && playbackModeRef.current === "web-audio"
          ? getWebAudioPosition()
          : currentTime;
      const next = position + seconds;

      if (next >= 0 && (!clipDuration || next <= clipDuration)) {
        if (status === "playing") {
          playClip(clipIndexRef.current, next);
        } else {
          const nextOffset = Math.max(0, next);
          webAudioOffsetRef.current = nextOffset;
          setCurrentTime(nextOffset);
        }
        return;
      }

      if (next < 0 && clipIndexRef.current > 0) {
        const previous = clipIndexRef.current - 1;
        const previousClip = cache?.clips[previous];
        const previousDuration =
          previousClip?.duration || previousClip?.audioBuffer?.duration || 0;
        playClip(previous, Math.max(0, previousDuration + next));
        return;
      }

      if (next > clipDuration) {
        const nextIndex = clipIndexRef.current + 1;
        if (cache?.clips[nextIndex]) {
          playClip(nextIndex);
        } else {
          setCurrentTime(clipDuration || position);
        }
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    const next = audio.currentTime + seconds;
    if (next >= 0 && (!audio.duration || next <= audio.duration)) {
      audio.currentTime = Math.max(0, next);
      return;
    }

    if (next < 0 && clipIndexRef.current > 0) {
      const previous = clipIndexRef.current - 1;
      if (playClip(previous)) {
        window.setTimeout(() => {
          const previousAudio = audioRef.current;
          if (previousAudio?.duration) {
            previousAudio.currentTime = Math.max(0, previousAudio.duration + next);
          }
        }, 80);
      }
      return;
    }

    if (next > audio.duration) {
      const nextIndex = clipIndexRef.current + 1;
      if (activeCacheRef.current?.clips[nextIndex]) {
        playClip(nextIndex);
      } else {
        audio.currentTime = audio.duration || audio.currentTime;
      }
    }
  }, [currentTime, duration, getWebAudioPosition, playClip, status]);

  const downloadAudio = useCallback(() => {
    const cache = activeCacheRef.current ?? speechCache.get(cacheKey);
    if (!isDownloadableTtsFormat(preferences.format)) {
      toast.info("Download completo fica disponível só em MP3 por enquanto.");
      return;
    }

    if (!isCacheDownloadReady(cache)) {
      toast.info("Espera a voz terminar de gerar para baixar o áudio inteiro.");
      return;
    }

    const mergedBlob = new Blob(
      cache.chunks.map((_, index) => cache.clips[index].blob),
      { type: TTS_CONTENT_TYPES[preferences.format] }
    );
    const url = URL.createObjectURL(mergedBlob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = buildTtsDownloadFilename(messageId, preferences.format);
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [cacheKey, messageId, preferences.format]);

  useEffect(() => {
    const audio = document.createElement("audio");
    audio.hidden = true;
    audio.setAttribute("playsinline", "true");
    audio.preload = "metadata";
    document.body.appendChild(audio);
    audioRef.current = audio;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const handleLoadedMetadata = () => {
      const cache = activeCacheRef.current;
      const index = clipIndexRef.current;
      if (cache?.clips[index]) {
        cache.clips[index].duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      }
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };

    handleClipEndedRef.current = () => {
      const nextIndex = clipIndexRef.current + 1;
      const cache = activeCacheRef.current;
      if (cache?.clips[nextIndex]) {
        playClip(nextIndex);
      } else if (cache && !cache.complete && nextIndex < cache.chunks.length) {
        waitingForClipRef.current = nextIndex;
        setStatus("loading");
      } else {
        requestedPlayRef.current = false;
        setStatus("paused");
        setCurrentTime(0);
      }
    };
    const handleEnded = () => handleClipEndedRef.current();

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      abortGeneration();
      stopWebAudioSource(false);
      audio.pause();
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.src = "";
      audio.remove();
      audioRef.current = null;
    };
  }, [abortGeneration, playClip, stopWebAudioSource]);

  return {
    isOpen,
    status,
    isPlaying,
    canPlay,
    error,
    clipIndex,
    totalClips,
    currentTime,
    duration,
    formattedCurrentTime: formatDuration(currentTime),
    formattedDuration: formatDuration(duration),
    progress: duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0,
    canDownload:
      isDownloadableTtsFormat(preferences.format) &&
      isDownloadReady,
    openAndPlay,
    togglePlay,
    stop,
    seekBy,
    downloadAudio,
  };
}
