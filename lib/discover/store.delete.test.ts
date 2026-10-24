import { mkdtemp, mkdir, readFile, rm, writeFile, access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
let directory: string;
let cwd: string;
const image = "11111111-1111-4111-8111-111111111111";
const otherImage = "22222222-2222-4222-8222-222222222222";
const article = (id: string, picture?: string) => ({ id, title: id, summary: "Resumo", content: "Texto", topic: "IA", publishedAt: "2026-10-23", createdAt: "2026-10-23", sources: [], ...(picture ? { image: picture } : {}) });
const initial = { topics: ["Pesquisa"], articles: [article("one", image), article("two", otherImage), article("three")], schedule: { enabled: false }, job: { status: "idle" }, lastDailyDate: "2026-10-23" };
beforeEach(async () => {
  cwd = process.cwd(); directory = await mkdtemp(path.join(os.tmpdir(), "discover-delete-")); process.chdir(directory); vi.resetModules();
  await mkdir("data/discover-images", { recursive: true });
  await writeFile("data/discover.json", JSON.stringify(initial));
  await writeFile(`data/discover-images/${image}.png`, "synthetic");
  await writeFile(`data/discover-images/${otherImage}.png`, "synthetic");
});
afterEach(async () => { process.chdir(cwd); await rm(directory, { recursive: true, force: true }); });
it("exclui lote, limpa apenas suas capas e preserva preferências/agendamento", async () => {
  const store = await import("./store");
  expect(await store.deleteDiscoverArticles(["one", "three"])).toEqual({ deletedIds: ["one", "three"] });
  expect(await store.readDiscoverState()).toEqual({ ...initial, articles: [article("two", otherImage)] });
  await expect(access(`data/discover-images/${image}.png`)).rejects.toThrow();
  await expect(access(`data/discover-images/${otherImage}.png`)).resolves.toBeUndefined();
  expect(await store.readDiscoverImage(image)).toBeNull();
});
it("aceita repetição e identificadores já removidos sem perder outras notícias", async () => {
  const store = await import("./store");
  await store.deleteDiscoverArticles(["one", "one"]);
  expect(await store.deleteDiscoverArticles(["one", "missing"])).toEqual({ deletedIds: ["one", "missing"] });
  expect((await store.readDiscoverState()).articles.map(a => a.id)).toEqual(["two", "three"]);
});
it("serializa exclusões simultâneas e alteração de preferência", async () => {
  const store = await import("./store");
  await Promise.all([store.deleteDiscoverArticles(["one"]), store.deleteDiscoverArticles(["two"]), store.saveTopics(["Agentes"])]);
  expect(await store.readDiscoverState()).toMatchObject({ topics: ["Agentes"], articles: [article("three")] });
});
it("recusa exclusão durante curadoria e deixa arquivo/capa intactos", async () => {
  const store = await import("./store");
  await store.claimDiscoverJob("manual");
  const before = await readFile("data/discover.json", "utf8");
  await expect(store.deleteDiscoverArticles(["one"])).rejects.toMatchObject({ status: 409 });
  expect(await readFile("data/discover.json", "utf8")).toBe(before);
  await expect(access(`data/discover-images/${image}.png`)).resolves.toBeUndefined();
});
it.each([null, [], ["../escape"], [1], Array(61).fill("one")])("recusa seleção inválida %j", async (ids) => {
  const store = await import("./store");
  await expect(store.deleteDiscoverArticles(ids)).rejects.toMatchObject({ status: 400 });
  expect((await store.readDiscoverState()).articles).toHaveLength(3);
});
it("preserva capa compartilhada e tolera capa já ausente", async () => {
  const store = await import("./store");
  await writeFile("data/discover.json", JSON.stringify({ ...initial, articles: [article("one", image), article("two", image)] }));
  await store.deleteDiscoverArticles(["one"]);
  await expect(access(`data/discover-images/${image}.png`)).resolves.toBeUndefined();
  await rm(`data/discover-images/${image}.png`);
  await store.deleteDiscoverArticles(["two"]);
  expect((await store.readDiscoverState()).articles).toEqual([]);
});
it("falha de persistência não remove notícias nem capas", async () => {
  const store = await import("./store");
  await mkdir("data/discover.json.tmp");
  await expect(store.deleteDiscoverArticles(["one"])).rejects.toThrow();
  expect(JSON.parse(await readFile("data/discover.json", "utf8"))).toEqual(initial);
  await expect(access(`data/discover-images/${image}.png`)).resolves.toBeUndefined();
});
