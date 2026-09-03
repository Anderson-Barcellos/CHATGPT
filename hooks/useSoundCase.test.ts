import { describe, expect, it } from "vitest";
import type { SoundCaseProjectDetail } from "@/lib/soundcase/types";
import { buildSoundCaseDraftConflict } from "@/hooks/useSoundCase";

const serverProject: SoundCaseProjectDetail = {
  id: "p", title: "Servidor", draftRevision: 8, activeVersionId: null,
  createdAt: "2026-09-03T00:00:00.000Z", updatedAt: "2026-09-03T00:00:01.000Z",
  draftText: "texto remoto", draftWordCount: 2, estimatedDurationSeconds: 1, versions: [],
};

describe("SoundCase project reconciliation", () => {
  it("preserves local text beside the reloaded server revision on CAS conflict", () => {
    const conflict = buildSoundCaseDraftConflict("texto local ainda não salvo", serverProject);
    expect(conflict.localText).toBe("texto local ainda não salvo");
    expect(conflict.serverProject.draftRevision).toBe(8);
    expect(conflict.serverProject.draftText).toBe("texto remoto");
  });
});
