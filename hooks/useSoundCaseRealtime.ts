"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SoundCaseSegment } from "@/lib/soundcase/types";
import { apiUrl } from "@/lib/utils";
import {
  describeAudioPlayError,
  primeBrowserAudio,
  resumeBrowserAudio,
} from "@/lib/tts/browserAudio";

export type SoundCaseRealtimeStatus =
  | "idle" | "connecting" | "ready" | "speaking" | "paused" | "error";

export interface SoundCaseRealtimeInput {
  projectId: string;
  versionId: string;
  segments: SoundCaseSegment[];
}

export function buildSoundCaseRealtimeSegments(text: string): SoundCaseSegment[] {
  const normalized = text.replace(/\r\n?/gu, "\n");
  const segments: SoundCaseSegment[] = [];
  let cursor = 0;
  while (cursor < normalized.length) {
    while (cursor < normalized.length && /\s/u.test(normalized[cursor])) cursor += 1;
    if (cursor >= normalized.length) break;
    const hardEnd = Math.min(normalized.length, cursor + 3_200);
    let end = hardEnd;
    if (hardEnd < normalized.length) {
      const window = normalized.slice(cursor, hardEnd);
      const paragraph = window.lastIndexOf("\n\n");
      const sentence = Math.max(window.lastIndexOf(". "), window.lastIndexOf("! "), window.lastIndexOf("? "));
      const whitespace = window.search(/\s+\S*$/u);
      const preferred = paragraph > 0 ? paragraph : sentence > 0 ? sentence + 1 : whitespace > 0 ? whitespace : window.length;
      end = cursor + preferred;
    }
    while (end > cursor && /\s/u.test(normalized[end - 1])) end -= 1;
    const segmentText = normalized.slice(cursor, end);
    segments.push({
      id: `realtime-${segments.length}`,
      index: segments.length,
      start: cursor,
      end,
      text: segmentText,
      textHash: "realtime-only",
    });
    cursor = Math.max(end, cursor + 1);
  }
  return segments;
}

interface QueueMetadata { generation: string; segmentIndex: string }
interface QueueResponse {
  id?: string;
  status?: string;
  metadata?: Partial<QueueMetadata>;
}

export class SoundCaseRealtimeSessionFence {
  private generation = 0;
  private controller: AbortController | null = null;

  start(): { id: number; signal: AbortSignal } {
    this.invalidate();
    this.controller = new AbortController();
    return { id: this.generation, signal: this.controller.signal };
  }

  invalidate(): void {
    this.generation += 1;
    this.controller?.abort();
    this.controller = null;
  }

  isCurrent(id: number): boolean {
    return id === this.generation && Boolean(this.controller && !this.controller.signal.aborted);
  }
}

export function hasInboundRealtimeAudio(report: unknown): boolean {
  if (!report || typeof report !== "object") return false;
  const value = report as { type?: unknown; kind?: unknown; mediaType?: unknown; bytesReceived?: unknown };
  return value.type === "inbound-rtp" &&
    (value.kind === "audio" || value.mediaType === "audio") &&
    Number(value.bytesReceived) > 0;
}

export class SoundCaseRealtimeQueue {
  private segments: SoundCaseSegment[] = [];
  private generation = 0;
  private index = 0;
  private activeResponseId: string | null = null;

  constructor(
    private readonly send: (payload: string) => void,
    private readonly onIndex: (index: number) => void,
    private readonly onComplete: () => void
  ) {}

  reset(segments: SoundCaseSegment[]): void {
    this.generation += 1;
    this.segments = [...segments].sort((left, right) => left.index - right.index);
    this.index = 0;
    this.activeResponseId = null;
    this.onIndex(0);
  }

  invalidate(): void {
    this.generation += 1;
    this.activeResponseId = null;
  }

  sendCurrent(): void {
    const segment = this.segments[this.index];
    if (!segment) {
      this.onComplete();
      return;
    }
    const metadata: QueueMetadata = {
      generation: String(this.generation),
      segmentIndex: String(this.index),
    };
    this.send(JSON.stringify({
      type: "response.create",
      response: {
        conversation: "none",
        metadata: { source: "soundcase", ...metadata },
        output_modalities: ["audio"],
        input: [{
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: segment.text }],
        }],
      },
    }));
  }

  handleCreated(response: QueueResponse): void {
    const metadata = response.metadata;
    if (metadata?.generation !== String(this.generation) || metadata.segmentIndex !== String(this.index)) {
      if (response.id) this.send(JSON.stringify({ type: "response.cancel", response_id: response.id }));
      return;
    }
    this.activeResponseId = response.id ?? null;
  }

  handleDone(response: QueueResponse): "advanced" | "ignored" | "failed" {
    const metadata = response.metadata;
    if (metadata?.generation !== String(this.generation) || metadata.segmentIndex !== String(this.index)) return "ignored";
    this.activeResponseId = null;
    if (response.status && response.status !== "completed") return "failed";
    this.index += 1;
    this.onIndex(this.index);
    this.sendCurrent();
    return "advanced";
  }

  skipTo(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.segments.length) {
      throw new Error("soundcase_realtime_segment_invalid");
    }
    this.generation += 1;
    this.index = index;
    this.onIndex(index);
    if (this.activeResponseId) {
      this.send(JSON.stringify({ type: "response.cancel", response_id: this.activeResponseId }));
    }
    this.activeResponseId = null;
    this.send(JSON.stringify({ type: "output_audio_buffer.clear" }));
    this.sendCurrent();
  }
}

export function useSoundCaseRealtime() {
  const [status, setStatus] = useState<SoundCaseRealtimeStatus>("idle");
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [firstAudioMs, setFirstAudioMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const unlockedRef = useRef(false);
  const startedAtRef = useRef(0);
  const queueRef = useRef<SoundCaseRealtimeQueue | null>(null);
  const fenceRef = useRef<SoundCaseRealtimeSessionFence | null>(null);
  if (!fenceRef.current) fenceRef.current = new SoundCaseRealtimeSessionFence();
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const preparedAudioRef = useRef(false);

  const cleanup = useCallback((preservePreparedAudio = false) => {
    fenceRef.current?.invalidate();
    if (statsTimerRef.current) clearInterval(statsTimerRef.current);
    statsTimerRef.current = null;
    queueRef.current?.invalidate();
    queueRef.current = null;
    channelRef.current?.close();
    channelRef.current = null;
    const peer = peerRef.current;
    peer?.getSenders().forEach((sender) => sender.track?.stop());
    peer?.getReceivers().forEach((receiver) => receiver.track?.stop());
    peer?.close();
    peerRef.current = null;
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    if (audioRef.current && !preservePreparedAudio) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
      audioRef.current.remove();
      audioRef.current = null;
    }
    if (!preservePreparedAudio) {
      unlockedRef.current = false;
      preparedAudioRef.current = false;
    }
  }, []);

  const stop = useCallback(() => {
    cleanup(false);
    setStatus("idle");
  }, [cleanup]);

  const prime = useCallback(() => {
    if (audioRef.current) return;
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.hidden = true;
    audio.setAttribute("playsinline", "true");
    document.body.appendChild(audio);
    audioRef.current = audio;
    preparedAudioRef.current = true;
    primeBrowserAudio(audio, unlockedRef);
  }, []);

  const start = useCallback(async (input: SoundCaseRealtimeInput) => {
    const preparedAudio = preparedAudioRef.current ? audioRef.current : null;
    cleanup(Boolean(preparedAudio));
    if (!input.segments.length) {
      setStatus("error");
      setError("O texto não possui segmentos para leitura.");
      return;
    }
    const audio = preparedAudio ?? document.createElement("audio");
    if (!preparedAudio) {
      audio.autoplay = true;
      audio.hidden = true;
      audio.setAttribute("playsinline", "true");
      document.body.appendChild(audio);
      audioRef.current = audio;
      primeBrowserAudio(audio, unlockedRef);
    }
    preparedAudioRef.current = false;
    startedAtRef.current = performance.now();
    setFirstAudioMs(null);
    setError(null);
    setStatus("connecting");
    const session = fenceRef.current!.start();

    try {
      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      peer.addTransceiver("audio", { direction: "recvonly" });
      peer.ontrack = (event) => {
        if (!fenceRef.current?.isCurrent(session.id)) return;
        const stream = event.streams[0];
        if (!stream) return;
        audio.srcObject = stream;
        const markPlayback = () => {
          if (!fenceRef.current?.isCurrent(session.id)) return;
          if (statsTimerRef.current) clearInterval(statsTimerRef.current);
          statsTimerRef.current = null;
          setFirstAudioMs((current) => current ?? Math.round(performance.now() - startedAtRef.current));
          setStatus("speaking");
        };
        event.track.addEventListener("unmute", markPlayback, { once: true });
        statsTimerRef.current = setInterval(() => {
          void peer.getStats(event.track).then((reports) => {
            reports.forEach((report) => {
              if (hasInboundRealtimeAudio(report)) markPlayback();
            });
          }).catch(() => undefined);
        }, 50);
        const playWithElement = () => {
          if (!fenceRef.current?.isCurrent(session.id)) return;
          audio.muted = false;
          void audio.play().catch((playError) => {
            if (!fenceRef.current?.isCurrent(session.id)) return;
            setStatus("error");
            setError(describeAudioPlayError(playError, "Não consegui iniciar o áudio Realtime."));
          });
        };
        void resumeBrowserAudio().then((context) => {
          if (!fenceRef.current?.isCurrent(session.id) || peerRef.current !== peer) return;
          if (context) {
            audio.muted = true;
            void audio.play().catch(() => undefined);
            const source = context.createMediaStreamSource(stream);
            source.connect(context.destination);
            sourceRef.current = source;
          } else {
            playWithElement();
          }
        }).catch(playWithElement);
      };
      peer.onconnectionstatechange = () => {
        if (!fenceRef.current?.isCurrent(session.id)) return;
        if (peer.connectionState === "failed") {
          cleanup();
          setStatus("error");
          setError("A conexão Realtime falhou.");
        }
      };
      const channel = peer.createDataChannel("oai-events");
      channelRef.current = channel;
      const queue = new SoundCaseRealtimeQueue(
        (payload) => channel.send(payload),
        setActiveSegmentIndex,
        () => setStatus("ready")
      );
      queue.reset(input.segments);
      queueRef.current = queue;
      channel.addEventListener("open", () => {
        if (!fenceRef.current?.isCurrent(session.id)) return;
        setStatus("ready");
        queue.sendCurrent();
      });
      channel.addEventListener("message", (event) => {
        if (!fenceRef.current?.isCurrent(session.id)) return;
        try {
          const serverEvent = JSON.parse(String(event.data)) as {
            type?: string;
            response?: QueueResponse;
            error?: { message?: string };
          };
          if (serverEvent.type === "response.created" && serverEvent.response) {
            queue.handleCreated(serverEvent.response);
          }
          if (serverEvent.type === "response.done" && serverEvent.response) {
            if (queue.handleDone(serverEvent.response) === "failed") {
              cleanup();
              setStatus("error");
              setError("A leitura Realtime não conseguiu concluir este trecho.");
            }
          }
          if (serverEvent.type === "error") {
            cleanup();
            setStatus("error");
            setError(serverEvent.error?.message ?? "Erro na leitura Realtime.");
          }
        } catch {
          setStatus("error");
          setError("Evento inválido na leitura Realtime.");
        }
      });
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const sdp = peer.localDescription?.sdp ?? offer.sdp ?? "";
      if (!sdp.trim()) throw new Error("SDP vazio.");
      const response = await fetch(apiUrl(
        `/api/soundcase/realtime-call?projectId=${encodeURIComponent(input.projectId)}&versionId=${encodeURIComponent(input.versionId)}`
      ), {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: sdp,
        signal: session.signal,
      });
      if (!response.ok) throw new Error("Não foi possível iniciar a leitura Realtime.");
      await peer.setRemoteDescription({ type: "answer", sdp: await response.text() });
    } catch (cause) {
      if (!fenceRef.current?.isCurrent(session.id)) return;
      cleanup(false);
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "Falha na leitura Realtime.");
    }
  }, [cleanup]);

  useEffect(() => () => cleanup(false), [cleanup]);

  const skipToSegment = useCallback(async (index: number) => {
    const channel = channelRef.current;
    if (!channel || channel.readyState !== "open" || !queueRef.current) {
      throw new Error("soundcase_realtime_not_ready");
    }
    queueRef.current.skipTo(index);
    setStatus("speaking");
  }, []);

  return {
    status, activeSegmentIndex, firstAudioMs, error,
    isActive: status === "connecting" || status === "ready" || status === "speaking" || status === "paused",
    prime, start, stop, skipToSegment,
  };
}
