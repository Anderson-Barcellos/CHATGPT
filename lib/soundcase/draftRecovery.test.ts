import { describe, expect, it, vi } from "vitest";
import {
  clearSoundCaseDraftRecovery,
  readSoundCaseDraftRecovery,
  saveSoundCaseDraftRecovery,
} from "@/lib/soundcase/draftRecovery";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
    removeItem: vi.fn((key: string) => { values.delete(key); }),
  };
}

describe("SoundCase local draft recovery", () => {
  it("round-trips a pending long draft and clears it after confirmation", () => {
    const storage = memoryStorage();
    const recovery = { projectId: "p", text: "texto ".repeat(120_000), baseRevision: 7, updatedAt: "2026-09-03T00:00:00.000Z" };
    expect(saveSoundCaseDraftRecovery(recovery, storage)).toBe(true);
    expect(readSoundCaseDraftRecovery("p", storage)).toEqual(recovery);
    clearSoundCaseDraftRecovery("p", storage);
    expect(readSoundCaseDraftRecovery("p", storage)).toBeNull();
  });

  it("fails closed when browser storage is unavailable or malformed", () => {
    const denied = { getItem: vi.fn(() => "{"), setItem: vi.fn(() => { throw new Error("quota"); }), removeItem: vi.fn() };
    expect(saveSoundCaseDraftRecovery({ projectId: "p", text: "x", baseRevision: 0, updatedAt: "now" }, denied)).toBe(false);
    expect(readSoundCaseDraftRecovery("p", denied)).toBeNull();
  });
});
