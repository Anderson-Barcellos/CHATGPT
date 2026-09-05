import { describe, expect, it } from "vitest";
import type { SoundCasePublicVersion, SoundCaseVersionStatus } from "@/lib/soundcase/types";
import { describeSoundCaseVersion, getSoundCasePollInterval, getSoundCaseProgress, getSoundCaseProjectPollInterval } from "@/lib/soundcase/progress";

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

describe("SoundCase version contract for the library", () => {
  it("describes every status with a tone the UI can act on", () => {
    expect(describeSoundCaseVersion(versionWith("synthesizing")).tone).toBe("active");
    expect(describeSoundCaseVersion(versionWith("ready")).tone).toBe("ready");
    expect(describeSoundCaseVersion(versionWith("interrupted")).tone).toBe("stopped");
    expect(describeSoundCaseVersion(versionWith("canceled")).tone).toBe("stopped");
    expect(describeSoundCaseVersion(versionWith("failed")).tone).toBe("failed");
  });

  it("treats audio_ready as playable with the cover still in progress", () => {
    // Em audio_ready o backend já publicou o arquivo; só a capa segue pendente.
    const version = versionWith("audio_ready");
    const view = describeSoundCaseVersion({
      ...version,
      audio: { status: "ready", format: "mp3", durationSeconds: 60, contentType: "audio/mpeg", fileName: "final.mp3" },
    });
    expect(view.tone).toBe("partial");
    expect(view.playable).toBe(true);
    expect(view.label).toMatch(/capa/iu);
    expect(view.label).not.toContain("audio_ready");
  });

  it("never leaks the raw status into the label", () => {
    const view = describeSoundCaseVersion(versionWith("synthesizing"));
    expect(view.label).not.toContain("synthesizing");
    expect(view.label).toContain("2/4");
  });

  it("accepts the summary projection the library receives", () => {
    const { id, status, progress, audio } = versionWith("ready");
    expect(describeSoundCaseVersion({ id, status, progress, audio }).playable).toBe(false);
    const readyAudio = { ...audio, status: "ready" as const, durationSeconds: 1, contentType: "audio/mpeg", fileName: "f.mp3" };
    expect(describeSoundCaseVersion({ id, status, progress, audio: readyAudio }).playable).toBe(true);
  });

  it("polls the project only while a non-selected version is still active", () => {
    const active = { ...versionWith("synthesizing"), id: "active" };
    const done = { ...versionWith("ready"), id: "done" };
    expect(getSoundCaseProjectPollInterval([active, done], active.id)).toBe(false);
    expect(getSoundCaseProjectPollInterval([active, done], done.id)).toBe(4000);
    expect(getSoundCaseProjectPollInterval([done], done.id)).toBe(false);
    expect(getSoundCaseProjectPollInterval([active], null)).toBe(4000);
  });
});
