import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createSoundCaseProject,
  deleteSoundCaseProject,
  getSoundCaseProject,
  importSoundCaseText,
  listSoundCaseProjects,
  saveSoundCaseDraft,
} from "@/lib/server/soundcase/store";

let root: string;
let previousRoot: string | undefined;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(tmpdir(), "soundcase-store-"));
  previousRoot = process.env.SOUNDCASE_DATA_DIR;
  process.env.SOUNDCASE_DATA_DIR = root;
});

afterEach(async () => {
  if (previousRoot === undefined) delete process.env.SOUNDCASE_DATA_DIR;
  else process.env.SOUNDCASE_DATA_DIR = previousRoot;
  await fs.rm(root, { recursive: true, force: true });
});

describe("SoundCase project store", () => {
  it("creates a project without embedding draft text in the index", async () => {
    const project = await createSoundCaseProject({
      title: " Ensaio ",
      text: "linha um\r\n\r\nlinha dois",
    });

    expect(project.title).toBe("Ensaio");
    expect(project.draftRevision).toBe(0);
    const detail = await getSoundCaseProject(project.id);
    expect(detail.draftText).toBe("linha um\n\nlinha dois");
    expect(detail.versions).toEqual([]);

    const index = await fs.readFile(path.join(root, "projects.json"), "utf8");
    expect(index).not.toContain("linha um");
  });

  it("rejects autosave with a stale revision", async () => {
    const project = await createSoundCaseProject({ title: "Ensaio" });
    await saveSoundCaseDraft(project.id, { text: "versão dois", revision: 0 });

    await expect(
      saveSoundCaseDraft(project.id, {
        text: "escrita atrasada",
        revision: 0,
      })
    ).rejects.toMatchObject({
      code: "soundcase_revision_conflict",
      status: 409,
    });
  });

  it("serializes concurrent writes against the same revision", async () => {
    const project = await createSoundCaseProject({ title: "Concorrência" });
    const settled = await Promise.allSettled([
      saveSoundCaseDraft(project.id, { text: "primeiro", revision: 0 }),
      saveSoundCaseDraft(project.id, { text: "segundo", revision: 0 }),
    ]);

    expect(settled.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(settled.filter((item) => item.status === "rejected")).toHaveLength(1);
    expect((await getSoundCaseProject(project.id)).draftRevision).toBe(1);
  });

  it.each([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ])("rejects a MIME outside the contract: %s", async (mime) => {
    const project = await createSoundCaseProject({ title: "Importação" });
    const bytes = new TextEncoder().encode("conteúdo inválido para este MIME");

    await expect(
      importSoundCaseText(project.id, { name: "entrada.bin", mime, bytes })
    ).rejects.toMatchObject({ code: "soundcase_import_type", status: 415 });
  });

  it("imports txt and markdown as UTF-8 with normalized newlines", async () => {
    const project = await createSoundCaseProject({ title: "Importação" });
    const detail = await importSoundCaseText(project.id, {
      name: "capitulo.md",
      mime: "text/markdown",
      bytes: new TextEncoder().encode("# Título\r\n\r\nTexto."),
    });

    expect(detail.draftText).toBe("# Título\n\nTexto.");
    expect(detail.draftRevision).toBe(1);
    expect(detail.importMetadata).toMatchObject({
      sourceName: "capitulo.md",
      sourceType: "md",
    });
  });

  it("rejects extension mismatch, oversized input and invalid UTF-8", async () => {
    const project = await createSoundCaseProject({ title: "Importação" });

    await expect(
      importSoundCaseText(project.id, {
        name: "entrada.pdf",
        mime: "text/plain",
        bytes: new TextEncoder().encode("texto"),
      })
    ).rejects.toMatchObject({ code: "soundcase_import_type" });
    await expect(
      importSoundCaseText(project.id, {
        name: "enorme.txt",
        mime: "text/plain",
        bytes: new Uint8Array(1024 * 1024 + 1),
      })
    ).rejects.toMatchObject({ code: "soundcase_import_size", status: 413 });
    await expect(
      importSoundCaseText(project.id, {
        name: "invalido.txt",
        mime: "text/plain",
        bytes: new Uint8Array([0xc3, 0x28]),
      })
    ).rejects.toMatchObject({ code: "soundcase_import_encoding" });
  });

  it("tombstones and removes only the selected project", async () => {
    const removed = await createSoundCaseProject({ title: "Remover", text: "A" });
    const kept = await createSoundCaseProject({ title: "Manter", text: "B" });

    await deleteSoundCaseProject(removed.id);
    await expect(deleteSoundCaseProject(removed.id)).resolves.toBeUndefined();

    expect((await listSoundCaseProjects()).map((project) => project.id)).toEqual([
      kept.id,
    ]);
    await expect(getSoundCaseProject(removed.id)).rejects.toMatchObject({
      code: "soundcase_project_not_found",
      status: 404,
    });
    await expect(
      fs.access(path.join(root, "projects", removed.id))
    ).rejects.toMatchObject({ code: "ENOENT" });
    await expect(fs.readFile(path.join(root, "projects", kept.id, "draft.txt"), "utf8")).resolves.toBe("B");
  });
});
