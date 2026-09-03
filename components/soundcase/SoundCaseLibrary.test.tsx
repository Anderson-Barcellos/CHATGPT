import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SoundCaseLibrary } from "@/components/soundcase/SoundCaseLibrary";
import type { SoundCaseProjectDetail } from "@/lib/soundcase/types";

const project: SoundCaseProjectDetail = {
  id: "p", title: "Ensaio sobre o sono", draftRevision: 1, activeVersionId: "v",
  createdAt: "2026-09-03T00:00:00.000Z", updatedAt: "2026-09-03T01:00:00.000Z",
  draftText: "texto", draftWordCount: 1, estimatedDurationSeconds: 1,
  versions: [{
    id: "v", projectId: "p", idempotencyKey: "k", status: "interrupted", title: "Ensaio sobre o sono",
    summary: null, wordCount: 1, estimatedDurationSeconds: 1, requestedFormat: "mp3",
    audio: { status: "pending", format: "mp3" }, cover: { status: "pending" },
    progress: { phase: "interrupted", ratio: .4, completedChunks: 1, totalChunks: 2, updatedAt: "2026-09-03T01:00:00.000Z" },
    createdAt: "2026-09-03T00:30:00.000Z",
  }],
};

describe("SoundCase library", () => {
  it("shows projects, selected version and explicit resume/delete actions", () => {
    const noop = vi.fn();
    const markup = renderToStaticMarkup(<SoundCaseLibrary
      projects={[project]} project={project} selectedVersionId="v"
      onCreate={noop} onSelectProject={noop} onSelectVersion={noop}
      onResumeVersion={noop} onDeleteVersion={noop} onDeleteProject={noop}
    />);
    expect(markup).toContain("Ensaio sobre o sono");
    expect(markup).toContain("Retomar geração");
    expect(markup).toContain('aria-current="true"');
    expect(markup).toContain("Excluir geração");
  });
});
