import { describe, expect, it } from "vitest";
import type { SoundCaseProjectDetail } from "@/lib/soundcase/types";
import {
  buildSoundCaseDraftConflict,
  isSoundCaseDraftDirty,
  reconcileSoundCaseDraftRecovery,
} from "@/hooks/useSoundCase";

const serverProject: SoundCaseProjectDetail = {
  id: "p", title: "Servidor", draftRevision: 8, activeVersionId: null,
  createdAt: "2026-09-03T00:00:00.000Z", updatedAt: "2026-09-03T00:00:01.000Z",
  draftText: "texto remoto", draftWordCount: 2, estimatedDurationSeconds: 1, versions: [],
};

describe("SoundCase project reconciliation", () => {
  it("marks a draft dirty only when it differs from the persisted snapshot", () => {
    expect(isSoundCaseDraftDirty("rascunho", "salvo")).toBe(true);
    expect(isSoundCaseDraftDirty("salvo", "salvo")).toBe(false);
  });

  it("preserves local text beside the reloaded server revision on CAS conflict", () => {
    const conflict = buildSoundCaseDraftConflict("texto local ainda não salvo", serverProject);
    expect(conflict.localText).toBe("texto local ainda não salvo");
    expect(conflict.serverProject.draftRevision).toBe(8);
    expect(conflict.serverProject.draftText).toBe("texto remoto");
  });

  it("restores an unconfirmed local copy automatically when the server revision is unchanged", () => {
    const recovered = reconcileSoundCaseDraftRecovery({
      projectId: "p", text: "última edição", baseRevision: 8, updatedAt: "2026-09-03T00:00:02.000Z",
    }, serverProject);
    expect(recovered).toEqual({ text: "última edição", conflict: null });
  });

  it("surfaces both copies when another write won the CAS while the page was away", () => {
    const recovered = reconcileSoundCaseDraftRecovery({
      projectId: "p", text: "última edição", baseRevision: 7, updatedAt: "2026-09-03T00:00:02.000Z",
    }, serverProject);
    expect(recovered.text).toBe("última edição");
    expect(recovered.conflict?.serverProject).toBe(serverProject);
  });
});
