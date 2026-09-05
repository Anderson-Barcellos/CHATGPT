// @vitest-environment jsdom
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSoundCaseRealtime } from "@/hooks/useSoundCaseRealtime";

vi.mock("@/lib/tts/browserAudio", () => ({
  describeAudioPlayError: (_: unknown, fallback: string) => fallback,
  primeBrowserAudio: () => undefined,
  resumeBrowserAudio: async () => null,
}));

class FakeDataChannel extends EventTarget {
  readyState = "connecting";
  send = vi.fn();
  close = vi.fn();
}

class FakePeerConnection {
  ontrack: ((event: unknown) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  connectionState = "new";
  localDescription: { sdp: string } | null = null;
  addTransceiver = vi.fn();
  createDataChannel = vi.fn(() => new FakeDataChannel());
  createOffer = vi.fn(async () => ({ type: "offer", sdp: "v=0 offer" }));
  setLocalDescription = vi.fn(async (offer: { sdp: string }) => { this.localDescription = { sdp: offer.sdp }; });
  setRemoteDescription = vi.fn(async () => undefined);
  getSenders = () => [];
  getReceivers = () => [];
  getStats = vi.fn(async () => new Map());
  close = vi.fn();
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let latest: ReturnType<typeof useSoundCaseRealtime> | null = null;

function Probe() {
  const realtime = useSoundCaseRealtime();
  useEffect(() => { latest = realtime; });
  return null;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("RTCPeerConnection", FakePeerConnection);
  // jsdom não implementa pause(); o cleanup do hook chama no <audio> que ele mesmo cria.
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  vi.stubGlobal("fetch", vi.fn(async () => new Response("v=0 answer", { status: 201 })));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
  latest = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useSoundCaseRealtime session identity", () => {
  it("exposes the version being read and clears it on stop", async () => {
    await act(async () => {
      root!.render(createElement(Probe));
    });
    expect(latest!.versionId).toBeNull();

    await act(async () => {
      await latest!.start({
        projectId: "p", versionId: "v1",
        segments: [{ id: "s0", index: 0, start: 0, end: 4, text: "Olá.", textHash: "x" }],
      });
    });
    expect(latest!.status).toBe("connecting");
    expect(latest!.versionId).toBe("v1");

    await act(async () => {
      latest!.stop();
    });
    expect(latest!.versionId).toBeNull();
  });

  it("does not claim a version when there is nothing to read", async () => {
    await act(async () => {
      root!.render(createElement(Probe));
    });
    await act(async () => {
      await latest!.start({ projectId: "p", versionId: "v1", segments: [] });
    });
    expect(latest!.status).toBe("error");
    expect(latest!.versionId).toBeNull();
  });
});
