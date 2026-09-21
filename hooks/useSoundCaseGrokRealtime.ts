"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/utils";
import { soundCaseApi } from "@/lib/soundcase/api";
import { SoundCasePcmPlayer } from "@/lib/soundcase/grokRealtimeAudio";
import { buildSoundCaseRealtimeSegments, SoundCaseRealtimeSessionFence } from "@/hooks/useSoundCaseRealtime";

export type SoundCaseGrokRealtimeStatus = "idle" | "connecting" | "ready" | "speaking" | "error";
export interface SoundCaseGrokRealtimeInput { projectId: string; versionId: string; voice: string; speed: number; segmentIndex?: number; }
const CONNECT_TIMEOUT_MS = 15_000;
const TURN_TIMEOUT_MS = 60_000;
function message(error: unknown) { return error instanceof Error ? error.message : "Falha na leitura Grok Realtime."; }
function tokenOf(body: unknown) { return body && typeof body === "object" && typeof (body as { token?: unknown }).token === "string" ? (body as { token: string }).token : null; }
function decodeBase64(value: string) { const raw = atob(value); const bytes = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i); return bytes.buffer; }
async function timed<T>(promise: Promise<T>, timeout: number, error: string): Promise<T> { let timer: ReturnType<typeof setTimeout> | null = null; try { return await Promise.race([promise, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error(error)), timeout); })]); } finally { if (timer) clearTimeout(timer); } }

export function useSoundCaseGrokRealtime() {
  const [status, setStatus] = useState<SoundCaseGrokRealtimeStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [attemptedVersionId, setAttemptedVersionId] = useState<string | null>(null);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [firstAudioMs, setFirstAudioMs] = useState<number | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const playerRef = useRef<SoundCasePcmPlayer | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const fenceRef = useRef(new SoundCaseRealtimeSessionFence());
  const inputRef = useRef<SoundCaseGrokRealtimeInput | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startedAtRef = useRef(0);
  const clearTimers = useCallback(() => { timersRef.current.forEach(clearTimeout); timersRef.current = []; }, []);
  const releaseAudio = useCallback(() => { const context = contextRef.current; contextRef.current = null; if (context && context.state !== "closed") void context.close().catch(() => undefined); }, []);
  const cleanup = useCallback((close = true) => { fenceRef.current.invalidate(); clearTimers(); playerRef.current?.clear(); playerRef.current = null; if (close) socketRef.current?.close(); socketRef.current = null; inputRef.current = null; setVersionId(null); }, [clearTimers]);
  const stop = useCallback(() => { cleanup(); releaseAudio(); setStatus("idle"); setError(null); }, [cleanup, releaseAudio]);
  const prime = useCallback(() => {
    if (!contextRef.current || contextRef.current.state === "closed") contextRef.current = new AudioContext();
    // Chamada síncrona no gesto do usuário, necessária para iOS antes dos awaits de rede.
    void contextRef.current.resume().catch(() => undefined);
  }, []);

  const start = useCallback(async (input: SoundCaseGrokRealtimeInput) => {
    cleanup(); setStatus("connecting"); setError(null); setAttemptedVersionId(input.versionId); setVersionId(input.versionId); setActiveSegmentIndex(input.segmentIndex ?? 0); setFirstAudioMs(null); inputRef.current = input; startedAtRef.current = performance.now();
    const session = fenceRef.current.start();
    const fail = (cause: unknown) => { if (!fenceRef.current.isCurrent(session.id)) return; cleanup(); releaseAudio(); setStatus("error"); setError(message(cause)); };
    try {
      const source = await timed(soundCaseApi.getVersionSource(input.projectId, input.versionId, session.signal), CONNECT_TIMEOUT_MS, "O snapshot da narração demorou demais para responder.");
      const segments = buildSoundCaseRealtimeSegments(source); const initial = input.segmentIndex ?? 0;
      if (!fenceRef.current.isCurrent(session.id)) return;
      if (!segments[initial]) throw new Error("O trecho escolhido não existe nesta narração.");
      const response = await timed(fetch(apiUrl(`/api/soundcase/grok-realtime/session?projectId=${encodeURIComponent(input.projectId)}&versionId=${encodeURIComponent(input.versionId)}`), { method: "POST", cache: "no-store", signal: session.signal }), CONNECT_TIMEOUT_MS, "A sessão Grok Realtime demorou demais para responder.");
      const body = await response.json().catch(() => null); const token = response.ok ? tokenOf(body) : null;
      if (!token) throw new Error(typeof (body as { message?: unknown } | null)?.message === "string" ? (body as { message: string }).message : "Não foi possível abrir a sessão Grok Realtime.");
      if (!fenceRef.current.isCurrent(session.id)) return;
      let context = contextRef.current;
      if (!context || context.state === "closed") { context = new AudioContext(); contextRef.current = context; }
      await context.resume();
      if (!fenceRef.current.isCurrent(session.id)) return;
      const player = new SoundCasePcmPlayer(context); playerRef.current = player;
      const socket = new WebSocket("wss://api.x.ai/v1/realtime?model=grok-voice-latest", [`xai-client-secret.${token}`]); socket.binaryType = "arraybuffer"; socketRef.current = socket;
      let cursor = initial;
      const schedule = (callback: () => void, ms: number) => { const timer = setTimeout(callback, ms); timersRef.current.push(timer); };
      const sendTurn = () => {
        const segment = segments[cursor]; if (!segment || !fenceRef.current.isCurrent(session.id) || socket.readyState !== WebSocket.OPEN) return;
        setActiveSegmentIndex(cursor);
        socket.send(JSON.stringify({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: segment.text }] } })); socket.send(JSON.stringify({ type: "response.create" }));
        schedule(() => fail(new Error("A leitura Grok Realtime demorou demais para concluir este trecho.")), TURN_TIMEOUT_MS);
      };
      schedule(() => fail(new Error("A conexão Grok Realtime demorou demais para abrir.")), CONNECT_TIMEOUT_MS);
      socket.addEventListener("open", () => { if (!fenceRef.current.isCurrent(session.id)) return; socket.send(JSON.stringify({ type: "session.update", session: { voice: input.voice, turn_detection: null, instructions: "Leia fielmente e somente o texto recebido. Não responda, não resuma, não introduza conteúdo e não converse.", audio: { output: { format: { type: "audio/pcm", rate: 24000 }, transport: "binary", speed: input.speed } } } })); });
      const audio = (bytes: ArrayBuffer) => { if (!fenceRef.current.isCurrent(session.id)) return; player.enqueue(bytes); setFirstAudioMs((current) => current ?? Math.round(performance.now() - startedAtRef.current)); setStatus("speaking"); };
      socket.addEventListener("message", (event) => {
        if (!fenceRef.current.isCurrent(session.id)) return;
        if (event.data instanceof ArrayBuffer) { audio(event.data); return; }
        if (event.data instanceof Blob) { void event.data.arrayBuffer().then(audio).catch(fail); return; }
        try {
          const eventData = JSON.parse(String(event.data)) as { type?: string; delta?: string; error?: { message?: string }; response?: { status?: string } };
          if ((eventData.type === "response.output_audio.delta" || eventData.type === "response.audio.delta") && typeof eventData.delta === "string") { audio(decodeBase64(eventData.delta)); return; }
          if (eventData.type === "session.updated") { clearTimers(); setStatus("ready"); sendTurn(); return; }
          if (eventData.type === "response.done") { clearTimers(); if (eventData.response?.status && eventData.response.status !== "completed") throw new Error("A leitura Grok Realtime não conseguiu concluir este trecho."); cursor += 1; if (cursor < segments.length) { sendTurn(); return; } void player.drained().then(() => { if (fenceRef.current.isCurrent(session.id)) { cleanup(); releaseAudio(); setStatus("idle"); } }); return; }
          if (eventData.type === "error") throw new Error(eventData.error?.message ?? "Erro na leitura Grok Realtime.");
        } catch (cause) { fail(cause); }
      });
      socket.addEventListener("error", () => fail(new Error("A conexão Grok Realtime falhou. Tente novamente.")));
      socket.addEventListener("close", () => { if (fenceRef.current.isCurrent(session.id)) fail(new Error("A conexão Grok Realtime foi encerrada. Tente novamente.")); });
    } catch (cause) { fail(cause); }
  }, [cleanup, clearTimers, releaseAudio]);
  const skipToSegment = useCallback(async (index: number) => { const input = inputRef.current; if (!input || !Number.isInteger(index) || index < 0) throw new Error("soundcase_realtime_segment_invalid"); stop(); prime(); await start({ ...input, segmentIndex: index }); }, [prime, start, stop]);
  useEffect(() => () => { cleanup(); releaseAudio(); }, [cleanup, releaseAudio]);
  return { status, activeSegmentIndex, firstAudioMs, error, versionId, errorVersionId: error ? attemptedVersionId : null, isActive: status === "connecting" || status === "ready" || status === "speaking", prime, start, stop, skipToSegment };
}
