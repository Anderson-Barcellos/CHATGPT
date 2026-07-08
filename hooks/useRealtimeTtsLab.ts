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

type ClientRealtimeLogLevel = "info" | "warn" | "error";

function serializeErrorForLog(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack?.split("\n").slice(0, 6).join("\n"),
    };
  }

  return { value: String(error) };
}

async function reportRealtimeClientLog(
  level: ClientRealtimeLogLevel,
  event: string,
  message: string,
  details?: unknown
) {
  try {
    await fetch(apiUrl("/api/realtime/tts-call/log"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify({
        level,
        event,
        message,
        details,
      }),
    });
  } catch {
    // noop: logging não pode quebrar playback
  }
}

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
      void reportRealtimeClientLog(
        "info",
        "settings.applied",
        "Preferências TTS carregadas para Realtime 2.1 mini.",
        {
          voice: preferences.voice,
          realtimeVoice: normalizeRealtimeTtsVoice(preferences.voice),
          model: preferences.model,
          speed: preferences.speed,
          mode: preferences.mode,
          hasInstructions: Boolean(preferences.instructions.trim()),
          instructionsLength: preferences.instructions.trim().length,
          appliedToRealtime: {
            voice: true,
            instructions: true,
            speed: false,
            mode: false,
            model: false,
          },
        }
      );

      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      peer.addTransceiver("audio", { direction: "recvonly" });

      peer.onicecandidateerror = (event) => {
        console.warn("Realtime ICE candidate error", event);
        void reportRealtimeClientLog(
          "warn",
          "peer.icecandidateerror",
          "Erro no ICE candidate do Realtime 2.1 mini.",
          {
            errorCode: event.errorCode,
            errorText: event.errorText,
            address: event.address,
            port: event.port,
            url: event.url,
          }
        );
      };

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
          const latencyMs = Math.round(performance.now() - startedAtRef.current);
          setFirstAudioMs(latencyMs);
          void reportRealtimeClientLog(
            "info",
            "audio.started",
            `Primeiro áudio Realtime recebido em ${latencyMs}ms.`
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
              "O navegador bloqueou o áudio Realtime; clique em Realtime 2.1 mini de novo para tentar liberar."
            );
            cleanup();
            setStatus("error");
            setError(message);
            toast.error(message);
            void reportRealtimeClientLog(
              "error",
              "audio.playback_failed",
              message,
              serializeErrorForLog(playError)
            );
          });
      };

      peer.ontrack = (event) => {
        const stream = event.streams[0];
        const track = stream.getAudioTracks()[0];

        if (track) {
          track.onended = () => {
            void reportRealtimeClientLog(
              "warn",
              "track.ended",
              "Faixa de áudio remota encerrada no Realtime 2.1 mini."
            );
          };

          track.onmute = () => {
            void reportRealtimeClientLog(
              "info",
              "track.muted",
              "Faixa de áudio remota mutada no Realtime 2.1 mini."
            );
          };

          track.onunmute = () => {
            void reportRealtimeClientLog(
              "info",
              "track.unmuted",
              "Faixa de áudio remota desmutada no Realtime 2.1 mini."
            );
          };
        }

        void resumeBrowserAudio()
          .then((context) => {
            if (!peerRef.current) return;

            if (!context) {
              playRemoteStreamWithElement(stream);
              return;
            }

            // Chromium silencia uma MediaStreamAudioSourceNode vinda de stream
            // WebRTC remoto se o stream não estiver também atado a um elemento de
            // mídia. Atamos um <audio> mudo só para destravar o pipeline; o som
            // sai pelo destination do Web Audio. (Sem isso: sem áudio no desktop.)
            audio.srcObject = stream;
            audio.muted = true;
            void audio.play().catch(() => {});

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
        void reportRealtimeClientLog(
          "info",
          "peer.connection_state",
          `Connection state: ${peer.connectionState}`
        );

        if (peer.connectionState === "failed") {
          setStatus("error");
          setError("A conexão WebRTC do Realtime falhou.");
          void reportRealtimeClientLog(
            "error",
            "peer.connection_failed",
            "A conexão WebRTC do Realtime falhou."
          );
        }
      };

      const channel = peer.createDataChannel("oai-events");
      channelRef.current = channel;

      channel.addEventListener("error", () => {
        void reportRealtimeClientLog(
          "error",
          "channel.error",
          "Erro no data channel do Realtime 2.1 mini."
        );
      });

      channel.addEventListener("close", () => {
        void reportRealtimeClientLog(
          "warn",
          "channel.close",
          "Data channel do Realtime 2.1 mini foi fechado."
        );
      });

      channel.addEventListener("open", () => {
        setStatus((current) => (current === "speaking" ? current : "ready"));
        channel.send(
          JSON.stringify({
            type: "response.create",
            response: {
              conversation: "none",
              metadata: { source: "gaucho-realtime-tts-lab" },
              output_modalities: ["audio"],
              instructions: buildRealtimeReadInstructions(
                text,
                preferences.instructions
              ),
            },
          })
        );
      });

      channel.addEventListener("message", (event) => {
        let serverEvent: {
          type?: string;
          error?: { message?: string };
        };

        try {
          serverEvent = JSON.parse(event.data as string) as {
            type?: string;
            error?: { message?: string };
          };
        } catch (parseError) {
          console.error("Realtime event parse error", parseError);
          void reportRealtimeClientLog(
            "error",
            "channel.parse_error",
            "Falha ao parsear evento do data channel.",
            {
              raw: String(event.data).slice(0, 1000),
              parseError: serializeErrorForLog(parseError),
            }
          );
          return;
        }

        if (serverEvent.type === "response.done") {
          setStatus("completed");
        }

        if (serverEvent.type === "error") {
          const message =
            serverEvent.error?.message || "Erro na sessão Realtime TTS.";
          setStatus("error");
          setError(message);
          toast.error(message);
          void reportRealtimeClientLog("error", "channel.server_error", message, {
            serverEvent,
          });
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
          diagnosticId?: string;
          openaiRequestId?: string;
          upstreamStatus?: number;
        } | null;

        const details = [
          payload?.error,
          payload?.diagnosticId ? `diag: ${payload.diagnosticId}` : null,
          payload?.openaiRequestId ? `openai: ${payload.openaiRequestId}` : null,
        ]
          .filter(Boolean)
          .join(" | ");

        const message = details || "Falha ao iniciar Realtime TTS.";
        void reportRealtimeClientLog("error", "route.non_ok", message, payload);
        throw new Error(message);
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
      void reportRealtimeClientLog(
        "error",
        "start.catch",
        message,
        serializeErrorForLog(err)
      );
    }
  }, [
    cleanup,
    content,
    preferences.instructions,
    preferences.model,
    preferences.mode,
    preferences.speed,
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
