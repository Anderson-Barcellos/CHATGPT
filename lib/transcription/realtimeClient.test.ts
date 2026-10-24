import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startLiveTranscription } from "./realtimeClient";

class Socket {
  static OPEN = 1; static CLOSING = 2; static last: Socket;
  readyState = 1; bufferedAmount = 0; sent: unknown[] = [];
  onmessage?: (event: { data: string }) => void;
  onerror?: () => void;
  onclose?: () => void;
  constructor(public url: URL) { Socket.last = this; }
  send(data: unknown) { this.sent.push(data); }
  close() { this.readyState = 3; }
  emit(event: object) { this.onmessage?.({ data: JSON.stringify(event) }); }
}
let context: AudioContext;
let preview = vi.fn<(text: string) => void>();
let port: { onmessage?: ((event: { data: unknown }) => void) | null; postMessage: ReturnType<typeof vi.fn> };
const emit = (data: unknown) => port.onmessage?.({ data });
const begin = async () => {
  const client = startLiveTranscription({} as MediaStream, context, preview);
  await Promise.resolve(); return client;
};
beforeEach(() => {
  vi.useFakeTimers(); vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/chat");
  preview = vi.fn(); port = { postMessage: vi.fn() };
  context = {
    audioWorklet: { addModule: vi.fn().mockResolvedValue(undefined) }, destination: {},
    createMediaStreamSource: () => ({ connect: vi.fn(), disconnect: vi.fn() }),
  } as unknown as AudioContext;
  vi.stubGlobal("AudioWorkletNode", class { port = port; connect = vi.fn(); disconnect = vi.fn(); });
  vi.stubGlobal("window", { location: { href: "https://gaucho.example/chat/" } });
  vi.stubGlobal("WebSocket", Socket);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("captura ao vivo no navegador", () => {
  it("preserva o áudio anterior ao ready, envia a cauda antes do stop e usa o prefixo", async () => {
    const client = await begin();
    expect(Socket.last.url.href).toBe("wss://gaucho.example/chat/api/transcribe/realtime");
    expect(context.audioWorklet.addModule).toHaveBeenCalledWith("/chat/pcm-recorder.js");
    const audio = new ArrayBuffer(4800);
    emit({ type: "audio", buffer: audio }); emit({ type: "commit" });
    expect(Socket.last.sent).toHaveLength(0);
    Socket.last.emit({ type: "ready" });
    expect(Socket.last.sent).toEqual([audio, '{"type":"commit"}']);
    Socket.last.emit({ type: "transcript", text: "Texto ao vivo" });
    expect(preview).toHaveBeenCalledWith("Texto ao vivo");
    const done = client.finish();
    expect(port.postMessage).toHaveBeenCalledWith("stop");
    emit({ type: "audio", buffer: audio }); emit({ type: "flushed" });
    expect(Socket.last.sent.slice(-2)).toEqual([audio, '{"type":"stop"}']);
    Socket.last.emit({ type: "done", text: "Texto final" });
    expect(await done).toBe("Texto final");
  });
  it("aceita parar antes do ready sem perder a fila", async () => {
    const client = await begin(); emit({ type: "audio", buffer: new ArrayBuffer(4800) });
    const done = client.finish(); emit({ type: "flushed" });
    Socket.last.emit({ type: "ready" });
    expect(Socket.last.sent.at(-1)).toBe('{"type":"stop"}');
    Socket.last.emit({ type: "done", text: "Curto" }); expect(await done).toBe("Curto");
  });
  it.each(["onerror", "onclose"] as const)("libera fallback ao receber %s", async (event) => {
    const client = await begin(); Socket.last[event]?.(); expect(await client.finish()).toBeNull();
  });
  it("limita fila anterior ao ready e pressão da rede", async () => {
    const client = await begin(); emit({ type: "audio", buffer: new ArrayBuffer(1024 * 1024 + 1) });
    expect(await client.finish()).toBeNull();
    const other = await begin(); Socket.last.emit({ type: "ready" }); Socket.last.bufferedAmount = 1024 * 1024 + 1;
    emit({ type: "audio", buffer: new ArrayBuffer(2) }); expect(await other.finish()).toBeNull();
  });
  it("limita conexão e finalização", async () => {
    const client = await begin(); await vi.advanceTimersByTimeAsync(20001); expect(await client.finish()).toBeNull();
    const other = await begin(); Socket.last.emit({ type: "ready" }); const done = other.finish();
    await vi.advanceTimersByTimeAsync(25001); expect(await done).toBeNull();
  });
  it("ignora callbacks após cancelamento", async () => {
    const client = await begin(); client.cancel(); Socket.last.emit({ type: "transcript", text: "atrasado" });
    expect(preview).not.toHaveBeenCalled(); expect(await client.finish()).toBeNull();
  });
  it("recorre ao fallback quando não há worklet", async () => {
    vi.stubGlobal("AudioWorkletNode", undefined);
    const client = await begin(); expect(await client.finish()).toBeNull();
  });
});
