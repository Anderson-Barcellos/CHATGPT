// @vitest-environment jsdom
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGrokMessageRealtime } from "@/hooks/useGrokMessageRealtime";

class FakeWebSocket extends EventTarget {
  static OPEN = 1;
  static latest: FakeWebSocket | null = null;
  readyState = 0;
  binaryType = "blob";
  send = vi.fn();
  close = vi.fn(() => { this.readyState = 3; this.dispatchEvent(new Event("close")); });
  constructor(readonly url: string, readonly protocols: string[]) { super(); FakeWebSocket.latest = this; }
  open() { this.readyState = 1; this.dispatchEvent(new Event("open")); }
  message(value: unknown) { this.dispatchEvent(new MessageEvent("message", { data: value })); }
}

class FakeAudioContext {
  state = "running";
  currentTime = 0;
  resume = vi.fn(async () => undefined);
  close = vi.fn(async () => { this.state = "closed"; });
  createBuffer = vi.fn(() => ({ duration: 0.01, copyToChannel: vi.fn() }));
  createBufferSource = vi.fn(() => {
    const source = new EventTarget() as EventTarget & { buffer: unknown; connect: () => void; start: () => void; stop: () => void };
    source.connect = () => undefined;
    source.start = () => queueMicrotask(() => source.dispatchEvent(new Event("ended")));
    source.stop = () => source.dispatchEvent(new Event("ended"));
    return source;
  });
  get destination() { return {}; }
}

let root: Root | null = null;
let latest: ReturnType<typeof useGrokMessageRealtime> | null = null;
function Probe() { const realtime = useGrokMessageRealtime("Uma mensagem para ler."); useEffect(() => { latest = realtime; }); return null; }

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  FakeWebSocket.latest = null;
  vi.stubGlobal("WebSocket", FakeWebSocket);
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ token: "temporary" })));
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root?.unmount()); root = null; latest = null; vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("useGrokMessageRealtime", () => {
  it("opens only on play and reads the message with Orion", async () => {
    await act(async () => root!.render(createElement(Probe)));
    expect(fetch).not.toHaveBeenCalled();
    await act(async () => latest!.start());
    expect(fetch).toHaveBeenCalledWith("/api/realtime/grok-session", expect.objectContaining({ method: "POST", cache: "no-store" }));
    const socket = FakeWebSocket.latest!;
    expect(socket.protocols).toEqual(["xai-client-secret.temporary"]);
    await act(async () => socket.open());
    expect(JSON.parse(socket.send.mock.calls[0][0]).session.voice).toBe("orion");
    await act(async () => socket.message(JSON.stringify({ type: "session.updated" })));
    expect(JSON.parse(socket.send.mock.calls[1][0]).item.content[0].text).toBe("Uma mensagem para ler.");
    expect(JSON.parse(socket.send.mock.calls[2][0]).type).toBe("response.create");
    await act(async () => { socket.message(new ArrayBuffer(4)); socket.message(JSON.stringify({ type: "response.done", response: { status: "completed" } })); await Promise.resolve(); });
    expect(latest!.status).toBe("completed");
    expect(socket.close).toHaveBeenCalledOnce();
  });

  it("ignores a token that arrives after stop", async () => {
    let resolve!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((done) => { resolve = done; })));
    await act(async () => root!.render(createElement(Probe)));
    let pending!: Promise<void>;
    await act(async () => { pending = latest!.start(); });
    await act(async () => latest!.stop());
    await act(async () => { resolve(Response.json({ token: "late" })); await pending; });
    expect(FakeWebSocket.latest).toBeNull();
    expect(latest!.status).toBe("idle");
  });

  it("reports a completed response that contains no audio", async () => {
    await act(async () => root!.render(createElement(Probe)));
    await act(async () => latest!.start());
    const socket = FakeWebSocket.latest!;
    await act(async () => { socket.open(); socket.message(JSON.stringify({ type: "session.updated" })); socket.message(JSON.stringify({ type: "response.done", response: { status: "completed" } })); });
    expect(latest!.status).toBe("error");
    expect(latest!.error).toContain("sem enviar áudio");
  });
});
