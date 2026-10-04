import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let directory: string;
let previousCwd: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "gaucho-discover-test-"));
  previousCwd = process.cwd();
  process.chdir(directory);
  vi.resetModules();
});

afterEach(async () => {
  process.chdir(previousCwd);
  await rm(directory, { recursive: true, force: true });
});

describe("estado persistido do Descobrir IA", () => {
  it("reivindica a atualização diária uma única vez e preserva o feed após erro", async () => {
    const store = await import("./store");
    const now = new Date();
    const claims = await Promise.all([store.claimDiscoverJob("daily", now), store.claimDiscoverJob("daily", now)]);
    expect(claims.sort()).toEqual(["running", "started"]);
    await store.finishDiscoverJob({ articles: [{
      title: "Uma notícia", summary: "Resumo verificável", content: "Texto narrativo", topic: "IA",
      publishedAt: now.toISOString(), sources: [{ title: "Fonte", url: "https://example.org/ia" }],
    }] }, now);
    await store.finishDiscoverJob({ error: "Busca indisponível" }, now);
    const state = await store.readDiscoverState();
    expect(state.articles).toHaveLength(1);
    expect(state.job.status).toBe("failed");
    expect(await store.claimDiscoverJob("daily", now)).toBe("not_due");
    expect(await store.claimDiscoverJob("manual", now)).toBe("started");
  });
});
