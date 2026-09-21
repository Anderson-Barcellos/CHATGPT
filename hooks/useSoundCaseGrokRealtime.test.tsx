// @vitest-environment jsdom
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSoundCaseGrokRealtime } from "@/hooks/useSoundCaseGrokRealtime";

class FakeWebSocket extends EventTarget {
  static readonly OPEN = 1;
  static latest: FakeWebSocket | null = null;
  readonly OPEN = 1;
  readyState = 0;
  binaryType = "blob";
  send = vi.fn(); close = vi.fn(() => { this.readyState = 3; this.dispatchEvent(new Event("close")); });
  constructor(readonly url: string, readonly protocols: string[]) { super(); FakeWebSocket.latest = this; }
  open() { this.readyState = 1; this.dispatchEvent(new Event("open")); }
  message(value: unknown) { this.dispatchEvent(new MessageEvent("message", { data: value })); }
}
class FakeAudioContext {
  static order: string[] = [];
  currentTime = 0; state = "running";
  constructor() { FakeAudioContext.order.push("context"); }
  resume = vi.fn(async () => undefined); close = vi.fn(async () => { this.state = "closed"; });
  createBuffer = vi.fn(() => ({ duration: 0.01, copyToChannel: vi.fn() }));
  createBufferSource = vi.fn(() => {
    const source = new EventTarget() as EventTarget & { buffer: unknown; connect: () => void; start: () => void; stop: () => void };
    source.connect = () => undefined; source.start = () => queueMicrotask(() => source.dispatchEvent(new Event("ended"))); source.stop = () => source.dispatchEvent(new Event("ended"));
    return source;
  });
  get destination() { return {}; }
}
let root: Root | null = null;
let latest: ReturnType<typeof useSoundCaseGrokRealtime> | null = null;
function Probe() { const realtime = useSoundCaseGrokRealtime(); useEffect(() => { latest = realtime; }); return null; }

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  FakeWebSocket.latest = null;
  FakeAudioContext.order = [];
  vi.stubGlobal("WebSocket", FakeWebSocket); vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ text: "Texto imutável." })).mockResolvedValueOnce(Response.json({ token: "temporary" })));
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root?.unmount()); root = null; latest = null; vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("useSoundCaseGrokRealtime", () => {
  it("uses a token efêmero, manual turns and the exact immutable snapshot", async () => {
    await act(async () => root!.render(createElement(Probe)));
    await act(async () => { await latest!.start({ projectId: "p", versionId: "v", voice: "eve", speed: 1 }); });
    const socket = FakeWebSocket.latest!;
    expect(socket.url).toBe("wss://api.x.ai/v1/realtime?model=grok-voice-latest"); expect(socket.protocols).toEqual(["xai-client-secret.temporary"]);
    await act(async () => socket.open());
    const setup = JSON.parse(socket.send.mock.calls[0][0]);
    expect(setup.session).toMatchObject({ voice: "eve", turn_detection: null, audio: { output: { speed: 1, transport: "binary" } } });
    await act(async () => socket.message(JSON.stringify({ type: "session.updated" })));
    expect(JSON.parse(socket.send.mock.calls[1][0])).toMatchObject({ type: "conversation.item.create", item: { content: [{ text: "Texto imutável." }] } });
    expect(JSON.parse(socket.send.mock.calls[2][0])).toEqual({ type: "response.create" });
  });
  it("does not open a token session when a stopped snapshot load returns late", async () => {
    let resolveSource!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { resolveSource = resolve; })));
    await act(async () => root!.render(createElement(Probe)));
    let starting!: Promise<void>; await act(async () => { starting = latest!.start({ projectId: "p", versionId: "v", voice: "eve", speed: 1 }); });
    await act(async () => latest!.stop());
    await act(async () => { resolveSource(Response.json({ text: "Tardio." })); await starting; });
    expect(fetch).toHaveBeenCalledOnce(); expect(FakeWebSocket.latest).toBeNull(); expect(latest!.status).toBe("idle");
  });
  it("waits for the final audio queue then closes an ended response", async () => {
    await act(async () => root!.render(createElement(Probe)));
    await act(async () => { await latest!.start({ projectId: "p", versionId: "v", voice: "eve", speed: 1 }); });
    const socket = FakeWebSocket.latest!;
    await act(async () => { socket.open(); socket.message(JSON.stringify({ type: "session.updated" })); socket.message(JSON.stringify({ type: "response.done", response: { status: "completed" } })); await Promise.resolve(); });
    expect(latest!.status).toBe("idle"); expect(latest!.isActive).toBe(false); expect(socket.close).toHaveBeenCalledOnce();
  });
  it("reports an unexpected disconnect from the first session", async () => {
    await act(async () => root!.render(createElement(Probe)));
    await act(async () => { await latest!.start({ projectId: "p", versionId: "v", voice: "eve", speed: 1 }); });
    const socket = FakeWebSocket.latest!;
    await act(async () => socket.dispatchEvent(new Event("close")));
    expect(latest!.status).toBe("error"); expect(latest!.error).toContain("encerrada");
  });
  it("times out a socket that opens but never acknowledges session.update", async () => {
    vi.useFakeTimers();
    await act(async () => root!.render(createElement(Probe)));
    await act(async () => { await latest!.start({ projectId: "p", versionId: "v", voice: "eve", speed: 1 }); });
    await act(async () => { FakeWebSocket.latest!.open(); await vi.advanceTimersByTimeAsync(15_000); });
    expect(latest!.status).toBe("error"); expect(latest!.error).toContain("conexão");
  });
  it("skips by invalidating the prior turn and opening a fresh session at the requested segment", async () => {
    const longText = "A".repeat(3_300);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ text: longText })).mockResolvedValueOnce(Response.json({ token: "first" })).mockResolvedValueOnce(Response.json({ text: longText })).mockResolvedValueOnce(Response.json({ token: "second" })));
    await act(async () => root!.render(createElement(Probe)));
    await act(async () => { await latest!.start({ projectId: "p", versionId: "v", voice: "eve", speed: 1 }); });
    const first = FakeWebSocket.latest!; await act(async () => { first.open(); first.message(JSON.stringify({ type: "session.updated" })); FakeAudioContext.order = []; await latest!.skipToSegment(1); });
    expect(first.close).toHaveBeenCalledOnce(); expect(FakeWebSocket.latest!.protocols).toEqual(["xai-client-secret.second"]); expect(latest!.activeSegmentIndex).toBe(1);
    expect(FakeAudioContext.order[0]).toBe("context");
  });
});
