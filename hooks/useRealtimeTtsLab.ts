"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { apiUrl } from "@/lib/utils";
import {
  describeAudioPlayError,
  primeBrowserAudio,
  resumeBrowserAudio,
} from "@/lib/tts/browserAudio";
import {
  DEFAULT_TTS_PREFERENCES,
  normalizeRealtimeTtsVoice,
  normalizeTtsPreferences,
  sanitizeSpeechText,
} from "@/lib/tts/speechText";
import { useSettingsStore } from "@/stores/settingsStore";

type RealtimeTtsStatus =
  | "idle"
  | "connecting"
  | "ready"
  | "speaking"
  | "completed"
  | "error";

function buildRealtimeReadInstructions(text: string, voiceInstructions: string): string {
  const cleaned = sanitizeSpeechText(text);
  const style = voiceInstructions.trim()
    ? `\nVoice style instructions: ${voiceInstructions.trim()}`
    : "";

  return [
    "Read the text below aloud exactly as written.",
    "Do not summarize, translate, explain, add greetings, or add closing commentary.",
    "If the text contains markdown artifacts, render them as natural spoken language.",
    style,
    "\nText to read:",
    cleaned,
  ].join("\n");
}

export function useRealtimeTtsLab(content: string) {
  const customInstructions = useSettingsStore((state) => state.customInstructions);
  const preferences = normalizeTtsPreferences(
    customInstructions?.ttsPreferences ?? DEFAULT_TTS_PREFERENCES
  );
  const [status, setStatus] = useState<RealtimeTtsStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [firstAudioMs, setFirstAudioMs] = useState<number | null>(null);

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamAudioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioUnlockedRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const firstAudioSeenRef = useRef(false);

  const cleanup = useCallback(() => {
    channelRef.current?.close();
    channelRef.current = null;

    const peer = peerRef.current;
    peer?.getSenders().forEach((sender) => sender.track?.stop());
    peer?.getReceivers().forEach((receiver) => receiver.track?.stop());
    peer?.close();
    peerRef.current = null;

    streamAudioSourceRef.current?.disconnect();
    streamAudioSourceRef.current = null;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
      audioRef.current.remove();
      audioRef.current = null;
    }

    startedAtRef.current = null;
    firstAudioSeenRef.current = false;
    audioUnlockedRef.current = false;
  }, []);

  const stop = useCallback(() => {
    cleanup();
    setStatus("idle");
  }, [cleanup]);

  const start = useCallback(async () => {
    const text = sanitizeSpeechText(content);
    if (!text) {
      setStatus("error");
      setError("Essa resposta não tem texto para testar no Realtime.");
      return;
    }

    cleanup();
    setStatus("connecting");
    setError(null);
    setFirstAudioMs(null);
    startedAtRef.current = performance.now();

    try {
      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      peer.addTransceiver("audio", { direction: "recvonly" });

      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.hidden = true;
      audio.setAttribute("playsinline", "true");
      document.body.appendChild(audio);
      audioRef.current = audio;
      primeBrowserAudio(audio, audioUnlockedRef);

      const markAudioStarted = () => {
        setStatus("speaking");

        if (!firstAudioSeenRef.current && startedAtRef.current !== null) {
          firstAudioSeenRef.current = true;
          setFirstAudioMs(
            Math.round(performance.now() - startedAtRef.current)
          );
        }
      };

      const playRemoteStreamWithElement = (stream: MediaStream) => {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
        audio.srcObject = stream;
        audio.muted = false;
        void audio
          .play()
          .then(markAudioStarted)
          .catch((playError) => {
            console.warn("Realtime audio element playback failed:", playError);
            const message = describeAudioPlayError(
              playError,
              "O navegador bloqueou o áudio Realtime; clique em Realtime mini de novo para tentar liberar."
            );
            cleanup();
            setStatus("error");
            setError(message);
            toast.error(message);
          });
      };

      peer.ontrack = (event) => {
        const stream = event.streams[0];

        void resumeBrowserAudio()
          .then((context) => {
            if (!peerRef.current) return;

            if (!context) {
              playRemoteStreamWithElement(stream);
              return;
            }

            streamAudioSourceRef.current?.disconnect();
            const source = context.createMediaStreamSource(stream);
            source.connect(context.destination);
            streamAudioSourceRef.current = source;
            markAudioStarted();
          })
          .catch((playError) => {
            console.warn("Realtime Web Audio playback failed:", playError);
            playRemoteStreamWithElement(stream);
          });
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "failed") {
          setStatus("error");
          setError("A conexão WebRTC do Realtime falhou.");
        }
      };

      const channel = peer.createDataChannel("oai-events");
      channelRef.current = channel;

      channel.addEventListener("open", () => {
        setStatus("ready");
        channel.send(
          JSON.stringify({
            type: "response.create",
            response: {
              conversation: "none",
              metadata: { source: "gaucho-realtime-tts-lab" },
              modalities: ["audio"],
              instructions: buildRealtimeReadInstructions(
                text,
                preferences.instructions
              ),
            },
          })
        );
      });

      channel.addEventListener("message", (event) => {
        const serverEvent = JSON.parse(event.data as string) as {
          type?: string;
          error?: { message?: string };
        };

        if (serverEvent.type === "response.done") {
          setStatus("completed");
        }

        if (serverEvent.type === "error") {
          const message =
            serverEvent.error?.message || "Erro na sessão Realtime TTS.";
          setStatus("error");
          setError(message);
          toast.error(message);
        }
      });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const offerSdp = peer.localDescription?.sdp ?? offer.sdp ?? "";
      if (!offerSdp.trim()) {
        throw new Error("O navegador gerou um offer SDP vazio para o Realtime.");
      }

      const response = await fetch(
        apiUrl(
          `/api/realtime/tts-call?voice=${encodeURIComponent(
            normalizeRealtimeTtsVoice(preferences.voice)
          )}`
        ),
        {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: offerSdp,
        }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error || "Falha ao iniciar Realtime TTS.");
      }

      await peer.setRemoteDescription({
        type: "answer",
        sdp: await response.text(),
      });
    } catch (err) {
      cleanup();
      const message =
        err instanceof Error ? err.message : "Falha ao iniciar Realtime TTS.";
      setStatus("error");
      setError(message);
      toast.error(message);
    }
  }, [
    cleanup,
    content,
    preferences.instructions,
    preferences.voice,
  ]);

  return {
    status,
    error,
    firstAudioMs,
    isActive:
      status === "connecting" || status === "ready" || status === "speaking",
    start,
    stop,
  };
}
