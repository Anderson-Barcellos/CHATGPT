// @vitest-environment jsdom
import { Blob as NodeBlob } from "node:buffer";
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAssistantTts } from "@/hooks/useAssistantTts";

vi.mock("@/stores/settingsStore", () => ({ useSettingsStore: (selector: (state: { customInstructions: null }) => unknown) => selector({ customInstructions: null }) }));
vi.mock("@/lib/tts/browserAudio", () => ({
  decodeBrowserAudio: vi.fn(async () => null),
  primeBrowserAudio: vi.fn(),
  resumeBrowserAudio: vi.fn(async () => null),
  describeAudioPlayError: vi.fn(() => "Áudio bloqueado"),
}));

let root: Root | null = null;
let latest: ReturnType<typeof useAssistantTts> | null = null;
const text = `${"Primeira frase de leitura. ".repeat(24)}Segunda parte final.`;
function Probe() { const tts = useAssistantTts(text, "orion-merge-test"); useEffect(() => { latest = tts; }); return null; }

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    if (url === "/api/tts/xai/merge") {
      const clips = (init.body as FormData).getAll("clips") as Blob[];
      const values = await Promise.all(clips.map((clip) => clip.text()));
      expect(values).toEqual(["first-mp3", "next-mp3"]);
      return { ok: true, blob: async () => new NodeBlob(["valid-remuxed-mp3"], { type: "audio/mpeg" }) };
    }
    const { input } = JSON.parse(String(init.body)) as { input: string };
    const bytes = new TextEncoder().encode(input.includes("Segunda parte final") ? "next-mp3" : "first-mp3");
    return { ok: true, blob: async () => new NodeBlob([bytes], { type: "audio/mpeg" }) };
  }));
});
afterEach(async () => { await act(async () => root?.unmount()); root = null; latest = null; vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Chat/Pulse Orion MP3 aggregation", () => {
  it("requests the xAI chunks and enables a single ordered MP3 download", async () => {
    const created: Blob[] = [];
    vi.stubGlobal("Blob", NodeBlob);
    vi.stubGlobal("FormData", class {
      private clips: Blob[] = [];
      append(_name: string, clip: Blob) { this.clips.push(clip); }
      getAll() { return this.clips; }
    });
    vi.stubGlobal("URL", class extends URL {
      static createObjectURL = vi.fn((blob: Blob) => { created.push(blob); return `blob:clip-${created.length}`; });
      static revokeObjectURL = vi.fn();
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    await act(async () => root!.render(createElement(Probe)));
    await act(async () => { latest!.openAndPlay(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(latest!.totalClips).toBeGreaterThan(1);
    expect(latest!.canDownload).toBe(true);
    expect(fetch).toHaveBeenCalledWith("/api/tts/xai", expect.objectContaining({ method: "POST" }));
    await act(async () => latest!.downloadAudio());
    const merged = created.at(-1) as Blob;
    expect(merged.type).toBe("audio/mpeg");
    expect(await merged.text()).toBe("valid-remuxed-mp3");
    expect(fetch).toHaveBeenCalledWith("/api/tts/xai/merge", expect.objectContaining({ method: "POST" }));
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector("a[download]")).toBeNull();
  });
});
