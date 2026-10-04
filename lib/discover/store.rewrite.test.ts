import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/jsonFileStore", () => ({
  readDataFile: vi.fn(),
  writeDataFile: vi.fn(),
  withDataFileLock: vi.fn(async (_file: string, action: () => Promise<unknown>) => action()),
}));

import { readDataFile, writeDataFile, withDataFileLock } from "@/lib/server/jsonFileStore";
import type { DiscoverArticle, DiscoverState } from "./types";
import { applyDiscoverRewrite, finishDiscoverRewrite, readDiscoverState } from "./store";

const ARTICLE: DiscoverArticle = {
  id: "article-1",
  title: "Manchete preservada",
  summary: "Resumo compacto que permanece igual durante a reescrita controlada.",
  content: "Conteúdo anterior.",
  topic: "Modelos de IA",
  publishedAt: "2026-10-03T10:00:00.000Z",
  createdAt: "2026-10-04T12:00:00.000Z",
  image: "image-1",
  sources: [{ title: "Fonte original", url: "https://example.org/original" }],
};

const tempDirectories: string[] = [];

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  while (tempDirectories.length) rmSync(tempDirectories.pop()!, { recursive: true, force: true });
});

describe("reescrita atômica do Descobrir IA", () => {
  it("preserva identidade e fontes existentes", () => {
    const rewritten = [{
      ...ARTICLE,
      content: "Conteúdo narrativo novo.",
      sources: [...ARTICLE.sources, { title: "Fonte nova", url: "https://example.org/new" }],
    }];
    expect(applyDiscoverRewrite([ARTICLE], rewritten)).toEqual(rewritten);
    expect(() => applyDiscoverRewrite([ARTICLE], [{ ...rewritten[0], title: "Título alterado" }])).toThrow(/title/);
    expect(() => applyDiscoverRewrite([ARTICLE], [{ ...rewritten[0], sources: rewritten[0].sources.slice(1) }])).toThrow(/remover uma fonte/);
    expect(() => applyDiscoverRewrite([ARTICLE], [])).toThrow(/todas as matérias/);
  });

  it("cria backup antes de gravar o lote completo", async () => {
    const backupDirectory = mkdtempSync(join(tmpdir(), "discover-rewrite-"));
    tempDirectories.push(backupDirectory);
    const state: DiscoverState = { topics: [], articles: [ARTICLE], job: { status: "running" } };
    const rewritten = [{ ...ARTICLE, content: "Conteúdo narrativo novo e completo." }];
    vi.mocked(readDataFile).mockImplementation(async () => state);
    expect(await readDataFile("discover.json", state)).toBe(state);
    expect((await readDiscoverState()).job.status).toBe("running");

    const backupPath = await finishDiscoverRewrite(rewritten, new Date("2026-10-04T13:00:00.000Z"), backupDirectory);

    expect(JSON.parse(readFileSync(backupPath, "utf8"))).toMatchObject({ articles: [ARTICLE], job: { status: "idle" } });
    expect(writeDataFile).toHaveBeenCalledWith("discover.json", expect.objectContaining({
      articles: rewritten,
      job: { status: "idle", finishedAt: "2026-10-04T13:00:00.000Z" },
    }));
    expect(withDataFileLock).toHaveBeenCalledTimes(1);
  });

  it("não grava nem cria backup quando o lote é parcial", async () => {
    const backupDirectory = mkdtempSync(join(tmpdir(), "discover-rewrite-partial-"));
    tempDirectories.push(backupDirectory);
    vi.mocked(readDataFile).mockResolvedValue({ topics: [], articles: [ARTICLE], job: { status: "running" } });

    await expect(finishDiscoverRewrite([], new Date(), backupDirectory)).rejects.toThrow(/todas as matérias/);
    expect(writeDataFile).not.toHaveBeenCalled();
    expect(readdirSync(backupDirectory)).toEqual([]);
  });
});
