import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SoundCasePlayer, switchToFinalAudio } from "@/components/soundcase/SoundCasePlayer";
import type { SoundCasePublicVersion } from "@/lib/soundcase/types";

const version: SoundCasePublicVersion = {
  id: "v", projectId: "p", status: "audio_ready", sourceHash: "s", settingsHash: "h", idempotencyKey: "k",
  wordCount: 100, estimatedDurationSeconds: 60,
  requestedSettings: { automatic: true, playbackMode: "realtime", format: "mp3", voiceOverride: null, speedOverride: null, instructionsOverride: null },
  effectiveSettings: null, direction: null,
  progress: { phase: "audio_ready", ratio: .96, completedChunks: 1, totalChunks: 1, updatedAt: "2026-09-03T00:00:00.000Z" },
  audio: { status: "ready", format: "mp3", durationSeconds: 64, contentType: "audio/mpeg", fileName: "final.mp3" },
  cover: { status: "pending" }, summary: null, createdAt: "2026-09-03T00:00:00.000Z",
};

describe("SoundCase player coordination", () => {
  it("announces the final file without stopping active Realtime during render", () => {
    const stop = vi.fn();
    const markup = renderToStaticMarkup(<SoundCasePlayer
      version={version} audioUrl="/audio" realtime={{ status: "speaking", firstAudioMs: 250, isActive: true, stop }}
    />);
    expect(markup).toContain("Arquivo final pronto");
    expect(markup).toContain("Realtime");
    expect(stop).not.toHaveBeenCalled();
  });

  it("stops Realtime before starting the final file", async () => {
    const stopRealtime = vi.fn();
    const playFinal = vi.fn().mockResolvedValue(undefined);
    await switchToFinalAudio({ stopRealtime, playFinal });
    expect(stopRealtime).toHaveBeenCalledOnce();
    expect(playFinal).toHaveBeenCalledOnce();
    expect(stopRealtime.mock.invocationCallOrder[0]).toBeLessThan(playFinal.mock.invocationCallOrder[0]);
  });
});
