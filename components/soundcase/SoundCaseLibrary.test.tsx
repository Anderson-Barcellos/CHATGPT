import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SoundCaseLibrary, type SoundCaseLibraryProps } from "@/components/soundcase/SoundCaseLibrary";
import type { SoundCaseProjectDetail, SoundCaseVersionSummary } from "@/lib/soundcase/types";

const interrupted: SoundCaseVersionSummary = {
  id: "v", projectId: "p", idempotencyKey: "k", status: "interrupted", title: "Ensaio sobre o sono",
  summary: "Um passeio pelas fases do sono.", wordCount: 1, estimatedDurationSeconds: 60, requestedFormat: "mp3",
  audio: { status: "pending", format: "mp3" }, cover: { status: "pending" },
  progress: { phase: "interrupted", ratio: .4, completedChunks: 1, totalChunks: 2, updatedAt: "2026-09-03T01:00:00.000Z" },
  createdAt: "2026-09-03T00:30:00.000Z",
};

const audioReady: SoundCaseVersionSummary = {
  ...interrupted, id: "v2", status: "audio_ready", title: "Segunda leitura", summary: "Resumo da segunda.",
  audio: { status: "ready", format: "mp3", durationSeconds: 120, contentType: "audio/mpeg", fileName: "final.mp3" },
  cover: { status: "ready", contentType: "image/png", fileName: "cover.png" },
  progress: { phase: "audio_ready", ratio: .96, completedChunks: 2, totalChunks: 2, updatedAt: "2026-09-03T01:10:00.000Z" },
  createdAt: "2026-09-03T00:40:00.000Z",
};

const project: SoundCaseProjectDetail = {
  id: "p", title: "Ensaio sobre o sono", draftRevision: 1, activeVersionId: "v",
  createdAt: "2026-09-03T00:00:00.000Z", updatedAt: "2026-09-03T01:00:00.000Z",
  draftText: "texto", draftWordCount: 1, estimatedDurationSeconds: 1,
  versions: [interrupted, audioReady],
};

function render(overrides: Partial<SoundCaseLibraryProps> = {}): string {
  const noop = vi.fn();
  return renderToStaticMarkup(<SoundCaseLibrary
    projects={[project]} project={project} selectedVersionId="v" playback={null}
    onCreate={noop} onSelectProject={noop} onSelectVersion={noop}
    onResumeVersion={noop} onDeleteVersion={noop} onDeleteProject={noop}
    {...overrides}
  />);
}

function countOf(markup: string, needle: string): number {
  return markup.split(needle).length - 1;
}

describe("SoundCase library", () => {
  it("shows projects, selected version and explicit resume/delete actions", () => {
    const markup = render();
    expect(markup).toContain("Ensaio sobre o sono");
    expect(markup).toContain("Retomar geração");
    expect(markup).toContain('aria-current="true"');
    expect(markup).toContain("Excluir geração");
  });

  it("renders every generation as a cover card from the start", () => {
    const markup = render();
    expect(countOf(markup, 'data-slot="soundcase-version-card"')).toBe(2);
    // Capa pendente mostra o placeholder; capa pronta mostra a imagem privada.
    expect(markup).toContain("Criando capa");
    expect(markup).toMatch(/src="[^"]*\/api\/soundcase\/projects\/p\/versions\/v2\/cover"/u);
  });

  it("speaks the contract label instead of the raw status", () => {
    const markup = render();
    expect(markup).not.toContain("audio_ready");
    expect(markup).toMatch(/capa em curso/iu);
    expect(markup).toContain("Interrompido");
  });

  it("expands summary and metadata only on the selected card", () => {
    const markup = render({ selectedVersionId: "v2" });
    expect(markup).toContain("Resumo da segunda.");
    expect(markup).not.toContain("Um passeio pelas fases do sono.");
  });

  it("marks which generation is playing and through which source", () => {
    const realtime = render({ playback: { versionId: "v2", source: "realtime" } });
    expect(realtime).toContain("Tocando · Realtime");
    expect(countOf(realtime, "Tocando")).toBe(1);

    const file = render({ playback: { versionId: "v", source: "file" } });
    expect(file).toContain("Tocando · arquivo");
  });
});
