import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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
  vi.useRealTimers();
  process.chdir(previousCwd);
  await rm(directory, { recursive: true, force: true });
});

describe("estado persistido do Descobrir IA", () => {
  it("reivindica a atualização diária uma única vez e preserva o feed após erro", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T12:00:00.000Z"));
    const store = await import("./store");
    const now = new Date("2026-10-07T12:00:00.000Z");
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
    expect(await store.claimDiscoverJob("daily", new Date("2026-10-08T12:00:00.000Z"))).toBe("not_due");
    expect(await store.claimDiscoverJob("manual", now)).toBe("started");
  });

  it("mantém o agendamento legado ativo e pausa apenas a execução diária", async () => {
    await mkdir(path.join(directory, "data"), { recursive: true });
    await writeFile(path.join(directory, "data", "discover.json"), JSON.stringify({
      topics: ["Agentes"],
      articles: [],
      job: { status: "idle" },
      lastDailyDate: "2026-10-01",
    }));
    const store = await import("./store");

    expect((await store.readDiscoverState()).schedule).toEqual({ enabled: true });
    await store.saveDiscoverSchedule(false);
    const afterPause = await store.readDiscoverState();
    expect(afterPause).toMatchObject({ topics: ["Agentes"], lastDailyDate: "2026-10-01", schedule: { enabled: false } });

    const paused = await Promise.all([
      store.claimDiscoverJob("daily", new Date("2026-10-07T12:00:00.000Z")),
      store.claimDiscoverJob("daily", new Date("2026-10-07T12:00:00.000Z")),
    ]);
    expect(paused).toEqual(["paused", "paused"]);
    expect(await store.claimDiscoverJob("manual", new Date("2026-10-07T12:00:00.000Z"))).toBe("started");
  });

  it("preserva a pausa quando uma execução em curso termina e manual não altera a data diária", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T12:00:00.000Z"));
    const store = await import("./store");
    const now = new Date("2026-10-07T12:00:00.000Z");

    expect(await store.claimDiscoverJob("daily", now)).toBe("started");
    await store.saveDiscoverSchedule(false);
    await store.finishDiscoverJob({ articles: [{
      title: "Matéria durante a pausa", summary: "Resumo verificável", content: "Texto narrativo", topic: "IA",
      publishedAt: now.toISOString(), sources: [{ title: "Fonte", url: "https://example.org/pausa" }],
    }] }, now);
    const afterFinish = await store.readDiscoverState();
    expect(afterFinish.schedule).toEqual({ enabled: false });
    expect(afterFinish.articles).toHaveLength(1);
    expect(afterFinish.lastDailyDate).toBe("2026-10-07");

    expect(await store.claimDiscoverJob("manual", new Date("2026-10-07T12:05:00.000Z"))).toBe("started");
    expect((await store.readDiscoverState()).lastDailyDate).toBe("2026-10-07");
  });

  it("não inicia a curadoria diária antes das 08h de São Paulo", async () => {
    const store = await import("./store");
    expect(await store.claimDiscoverJob("daily", new Date("2026-10-07T10:59:59.000Z"))).toBe("not_due");
    expect(await store.claimDiscoverJob("daily", new Date("2026-10-07T11:00:00.000Z"))).toBe("started");
  });
});
