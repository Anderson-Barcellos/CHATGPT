import { describe, expect, it } from "vitest";
import type { SoundCasePublicVersion, SoundCaseVersionStatus } from "@/lib/soundcase/types";
import { getSoundCasePollInterval, getSoundCaseProgress } from "@/lib/soundcase/progress";

function versionWith(status: SoundCaseVersionStatus): SoundCasePublicVersion {
  return {
    id: "v", projectId: "p", status, sourceHash: "source", settingsHash: "settings",
    idempotencyKey: "key", wordCount: 100, estimatedDurationSeconds: 60,
    requestedSettings: { automatic: true, playbackMode: "silent", format: "mp3", voiceOverride: null, speedOverride: null, instructionsOverride: null },
    effectiveSettings: null, direction: null,
    progress: { phase: status, ratio: 0.2, completedChunks: 2, totalChunks: 4, updatedAt: "2026-09-03T00:00:00.000Z" },
    audio: { status: "pending", format: "mp3" }, cover: { status: "pending" }, summary: null,
    createdAt: "2026-09-03T00:00:00.000Z",
  };
}

describe("SoundCase confirmed progress", () => {
  it("polls only active versions", () => {
    expect(getSoundCasePollInterval(versionWith("synthesizing"))).toBe(1500);
    expect(getSoundCasePollInterval(versionWith("ready"))).toBe(false);
    expect(getSoundCasePollInterval(versionWith("failed"))).toBe(false);
  });

  it("maps real completed chunks into synthesis progress", () => {
    const view = getSoundCaseProgress(versionWith("synthesizing"));
    expect(view.ratio).toBeCloseTo(0.47);
    expect(view.label).toContain("voz");
    expect(view.animated).toBe(true);
  });
});
