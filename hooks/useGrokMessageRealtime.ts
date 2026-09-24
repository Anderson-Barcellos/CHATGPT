"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/utils";
import { SoundCasePcmPlayer } from "@/lib/soundcase/grokRealtimeAudio";
import { splitSpeechText } from "@/lib/tts/speechText";

type Status = "idle" | "connecting" | "ready" | "speaking" | "completed" | "error";
const CONNECT_TIMEOUT_MS = 15_000;
const TURN_TIMEOUT_MS = 60_000;

function decodeBase64(value: string): ArrayBuffer {
  const raw = atob(value);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

export function useGrokMessageRealtime(content: string) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [firstAudioMs, setFirstAudioMs] = useState<number | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const playerRef = useRef<SoundCasePcmPlayer | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationRef = useRef(0);

  const cleanup = useCallback(() => {
    generationRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    socketRef.current?.close();
    socketRef.current = null;
    playerRef.current?.clear();
    playerRef.current = null;
    const context = contextRef.current;
    contextRef.current = null;
    if (context && context.state !== "closed") void context.close().catch(() => undefined);
  }, []);

  const stop = useCallback(() => {
    cleanup();
    setStatus("idle");
    setError(null);
  }, [cleanup]);

  const start = useCallback(async () => {
    cleanup();
    const chunks = splitSpeechText(content, { limit: 3_200 });
    if (!chunks.length) { setStatus("error"); setError("Essa resposta não tem texto para narrar."); return; }
    setStatus("connecting"); setError(null); setFirstAudioMs(null);
    const generation = generationRef.current;
    const startedAt = performance.now();
    const controller = new AbortController();
    abortRef.current = controller;
    const current = () => generationRef.current === generation && !controller.signal.aborted;
    const fail = (cause: unknown) => {
      if (!current()) return;
      cleanup();
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "Falha na leitura Grok Realtime.");
    };
    const schedule = (message: string, delay: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => fail(new Error(message)), delay);
    };

    try {
      // A ativação acontece no clique, antes de qualquer espera por rede (iOS).
      const context = new AudioContext();
      contextRef.current = context;
      void context.resume().catch(() => undefined);
      schedule("A conexão Grok Realtime demorou demais para abrir.", CONNECT_TIMEOUT_MS);
      const response = await fetch(apiUrl("/api/realtime/grok-session"), { method: "POST", cache: "no-store", signal: controller.signal });
      const body = await response.json().catch(() => null) as { token?: unknown; error?: unknown } | null;
      if (!current()) return;
      if (!response.ok || typeof body?.token !== "string") throw new Error(typeof body?.error === "string" ? body.error : "Não foi possível abrir a sessão Grok Realtime.");
      await context.resume();
      if (!current()) return;
      const player = new SoundCasePcmPlayer(context);
      playerRef.current = player;
      const socket = new WebSocket("wss://api.x.ai/v1/realtime?model=grok-voice-latest", [`xai-client-secret.${body.token}`]);
      socket.binaryType = "arraybuffer";
      socketRef.current = socket;
      let cursor = 0;
      let receivedAudio = false;
      const sendTurn = () => {
        if (!current() || socket.readyState !== WebSocket.OPEN) return;
        socket.send(JSON.stringify({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: chunks[cursor] }] } }));
        socket.send(JSON.stringify({ type: "response.create" }));
        schedule("A leitura Grok Realtime demorou demais para concluir este trecho.", TURN_TIMEOUT_MS);
      };
      const addAudio = (buffer: ArrayBuffer) => {
        if (!current()) return;
        if (buffer.byteLength < 2) return;
        receivedAudio = true;
        player.enqueue(buffer);
        setFirstAudioMs((previous) => previous ?? Math.round(performance.now() - startedAt));
        setStatus("speaking");
      };
      socket.addEventListener("open", () => {
        if (!current()) return;
        socket.send(JSON.stringify({ type: "session.update", session: { voice: "orion", turn_detection: null, instructions: "Leia fielmente e somente o texto recebido em português brasileiro. Não responda, resuma ou acrescente conteúdo.", audio: { output: { format: { type: "audio/pcm", rate: 24000 }, transport: "binary" } } } }));
      });
      socket.addEventListener("message", (event) => {
        if (!current()) return;
        if (event.data instanceof ArrayBuffer) { addAudio(event.data); return; }
        if (event.data instanceof Blob) { void event.data.arrayBuffer().then(addAudio).catch(fail); return; }
        try {
          const data = JSON.parse(String(event.data)) as { type?: string; delta?: string; error?: { message?: string }; response?: { status?: string } };
          if ((data.type === "response.output_audio.delta" || data.type === "response.audio.delta") && typeof data.delta === "string") { addAudio(decodeBase64(data.delta)); return; }
          if (data.type === "session.updated") { setStatus("ready"); sendTurn(); return; }
          if (data.type === "response.done") {
            if (data.response?.status && data.response.status !== "completed") throw new Error("A leitura Grok Realtime não conseguiu concluir este trecho.");
            cursor += 1;
            if (cursor < chunks.length) { sendTurn(); return; }
            if (!receivedAudio) throw new Error("A leitura Grok Realtime terminou sem enviar áudio.");
            if (timerRef.current) clearTimeout(timerRef.current);
            void player.drained().then(() => { if (current()) { cleanup(); setStatus("completed"); } });
            return;
          }
          if (data.type === "error") throw new Error(data.error?.message ?? "Erro na leitura Grok Realtime.");
        } catch (cause) { fail(cause); }
      });
      socket.addEventListener("error", () => fail(new Error("A conexão Grok Realtime falhou. Tente novamente.")));
      socket.addEventListener("close", () => { if (current()) fail(new Error("A conexão Grok Realtime foi encerrada.")); });
    } catch (cause) { fail(cause); }
  }, [cleanup, content]);

  useEffect(() => () => cleanup(), [cleanup]);
  return { status, error, firstAudioMs, isActive: status === "connecting" || status === "ready" || status === "speaking", start, stop };
}
