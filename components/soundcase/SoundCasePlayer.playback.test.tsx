// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SoundCasePlayer } from "@/components/soundcase/SoundCasePlayer";
import type { SoundCasePublicVersion } from "@/lib/soundcase/types";

const version: SoundCasePublicVersion = {
  id: "v", projectId: "p", status: "ready", sourceHash: "s", settingsHash: "h", idempotencyKey: "k",
  wordCount: 100, estimatedDurationSeconds: 60,
  requestedSettings: { automatic: true, playbackMode: "silent", format: "mp3", voiceOverride: null, speedOverride: null, instructionsOverride: null },
  effectiveSettings: null, direction: null,
  progress: { phase: "ready", ratio: 1, completedChunks: 1, totalChunks: 1, updatedAt: "2026-09-03T00:00:00.000Z" },
  audio: { status: "ready", format: "mp3", durationSeconds: 64, contentType: "audio/mpeg", fileName: "final.mp3" },
  cover: { status: "pending" }, summary: null, createdAt: "2026-09-03T00:00:00.000Z",
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom não implementa reprodução; o player só precisa da promessa resolvida.
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async () => undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
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
  vi.restoreAllMocks();
});

describe("SoundCasePlayer playback reporting", () => {
  it("reports when the final file starts and stops playing", async () => {
    const onPlaybackChange = vi.fn();
    await act(async () => {
      root!.render(createElement(SoundCasePlayer, {
        version, audioUrl: "/audio", onPlaybackChange,
        realtime: { status: "idle", firstAudioMs: null, isActive: false, stop: vi.fn() },
      }));
    });

    const button = container!.querySelector<HTMLButtonElement>('[aria-label="Reproduzir arquivo final"]');
    expect(button).not.toBeNull();
    await act(async () => {
      button!.click();
    });
    expect(onPlaybackChange).toHaveBeenLastCalledWith(true);

    const audio = container!.querySelector("audio")!;
    await act(async () => {
      audio.dispatchEvent(new Event("pause"));
    });
    expect(onPlaybackChange).toHaveBeenLastCalledWith(false);
  });
});
