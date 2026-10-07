import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { readDataFile, withDataFileLock, writeDataFile } from "@/lib/server/jsonFileStore";
import { isDiscoverDailyDue } from "./schedule";
import type { DiscoverArticle, DiscoverState } from "./types";

const FILE = "discover.json";
const EMPTY: DiscoverState = { topics: [], articles: [], schedule: { enabled: true }, job: { status: "idle" } };
const IMAGE_DIR = path.join(process.cwd(), "data", "discover-images");
const BACKUP_DIR = path.join(process.cwd(), "data", "discover-backups");
const TIME_ZONE = "America/Sao_Paulo";

export function discoverDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export function normalizeTopics(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 12) throw new Error("Use até 12 assuntos.");
  const topics: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") throw new Error("Assunto inválido.");
    const topic = item.trim().replace(/\s+/g, " ");
    if (topic.length < 2 || topic.length > 60) throw new Error("Cada assunto deve ter de 2 a 60 caracteres.");
    if (!topics.some((existing) => existing.toLocaleLowerCase("pt-BR") === topic.toLocaleLowerCase("pt-BR"))) topics.push(topic);
  }
  return topics;
}

export async function readDiscoverState(): Promise<DiscoverState> {
  const raw = await readDataFile<DiscoverState>(FILE, EMPTY);
  const job = raw?.job?.status === "running" || raw?.job?.status === "failed" ? raw.job : { status: "idle" as const };
  const stale = job.status === "running" && job.startedAt &&
    Date.now() - new Date(job.startedAt).getTime() > 60 * 60 * 1000;
  return {
    topics: Array.isArray(raw?.topics) ? raw.topics : [],
    articles: Array.isArray(raw?.articles) ? raw.articles : [],
    schedule: { enabled: raw?.schedule?.enabled !== false },
    job: stale ? { status: "failed", error: "A atualização foi interrompida. Tente novamente." } : job,
    lastDailyDate: raw?.lastDailyDate,
  };
}

export async function saveTopics(value: unknown): Promise<string[]> {
  const topics = normalizeTopics(value);
  return withDataFileLock(FILE, async () => {
    const state = await readDiscoverState();
    await writeDataFile(FILE, { ...state, topics });
    return topics;
  });
}

export async function saveDiscoverSchedule(value: unknown): Promise<DiscoverState["schedule"]> {
  if (typeof value !== "boolean") throw new Error("Agendamento inválido.");
  return withDataFileLock(FILE, async () => {
    const state = await readDiscoverState();
    const schedule = { enabled: value };
    await writeDataFile(FILE, { ...state, schedule });
    return schedule;
  });
}

export type DiscoverClaim = "started" | "running" | "not_due" | "paused";

export async function claimDiscoverJob(kind: "daily" | "manual" | "rewrite", now = new Date()): Promise<DiscoverClaim> {
  return withDataFileLock(FILE, async () => {
    const state = await readDiscoverState();
    const today = discoverDate(now);
    if (kind === "daily" && !state.schedule.enabled) return "paused";
    if (state.job.status === "running" && state.job.startedAt &&
      now.getTime() - new Date(state.job.startedAt).getTime() < 60 * 60 * 1000) return "running";
    if (kind === "daily") {
      if (!isDiscoverDailyDue(state.lastDailyDate, now)) return "not_due";
    }
    await writeDataFile(FILE, {
      ...state,
      lastDailyDate: kind === "daily" ? today : state.lastDailyDate,
      job: { status: "running", startedAt: now.toISOString() },
    });
    return "started";
  });
}

function sourceUrl(source: DiscoverArticle["sources"][number]): string {
  try { return new URL(source.url).href; }
  catch { return source.url; }
}

export function applyDiscoverRewrite(current: DiscoverArticle[], rewritten: DiscoverArticle[]): DiscoverArticle[] {
  if (rewritten.length !== current.length) throw new Error("A reescrita precisa cobrir todas as matérias atuais.");
  const byId = new Map(rewritten.map((article) => [article.id, article]));
  if (byId.size !== rewritten.length) throw new Error("A reescrita retornou identificadores duplicados.");

  return current.map((article) => {
    const next = byId.get(article.id);
    if (!next) throw new Error(`A reescrita não retornou a matéria ${article.id}.`);
    for (const field of ["title", "summary", "topic", "publishedAt", "createdAt", "image"] as const) {
      if (next[field] !== article[field]) throw new Error(`A reescrita tentou alterar ${field} da matéria ${article.id}.`);
    }
    const nextSources = new Set(next.sources.map(sourceUrl));
    if (!article.sources.every((source) => nextSources.has(sourceUrl(source))))
      throw new Error(`A reescrita tentou remover uma fonte da matéria ${article.id}.`);
    if (!next.content.trim()) throw new Error(`A reescrita retornou conteúdo vazio para ${article.id}.`);
    return { ...article, content: next.content, sources: next.sources };
  });
}

export async function finishDiscoverRewrite(
  rewritten: DiscoverArticle[],
  now = new Date(),
  backupDirectory = BACKUP_DIR
): Promise<string> {
  return withDataFileLock(FILE, async () => {
    const state = await readDiscoverState();
    if (state.job.status !== "running") throw new Error("A reescrita não possui uma execução ativa.");
    const articles = applyDiscoverRewrite(state.articles, rewritten);
    const backupState: DiscoverState = { ...state, job: { status: "idle", finishedAt: now.toISOString() } };
    await fs.mkdir(backupDirectory, { recursive: true, mode: 0o700 });
    const stamp = now.toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(backupDirectory, `discover-before-rewrite-${stamp}.json`);
    await fs.writeFile(backupPath, JSON.stringify(backupState, null, 2), { encoding: "utf8", flag: "wx", mode: 0o600 });
    await writeDataFile(FILE, {
      ...state,
      articles,
      job: { status: "idle", finishedAt: now.toISOString() },
    });
    return backupPath;
  });
}

export async function finishDiscoverJob(result: { articles?: Omit<DiscoverArticle, "id" | "createdAt">[]; error?: string }, now = new Date()): Promise<void> {
  await withDataFileLock(FILE, async () => {
    const state = await readDiscoverState();
    const added: DiscoverArticle[] = [];
    const createdImages: string[] = [];
    const articleKey = (article: DiscoverArticle | Omit<DiscoverArticle, "id" | "createdAt">) =>
      article.sources[0]?.url.replace(/[#?].*$/, "").replace(/\/$/, "") || article.title.toLocaleLowerCase("pt-BR");
    const existingKeys = new Set(state.articles.map(articleKey));
    try {
      for (const article of result.articles ?? []) {
        const key = articleKey(article);
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        const id = randomUUID();
        if (article.image) {
          await fs.mkdir(IMAGE_DIR, { recursive: true });
          const imagePath = path.join(IMAGE_DIR, `${id}.png`);
          await fs.writeFile(imagePath, Buffer.from(article.image, "base64"), { flag: "wx", mode: 0o600 });
          createdImages.push(imagePath);
        }
        added.push({ ...article, id, createdAt: now.toISOString(), image: article.image ? id : undefined });
      }
      const articles = [...added, ...state.articles].slice(0, 60);
      await writeDataFile(FILE, {
        ...state, articles,
        job: result.error
          ? { status: "failed", finishedAt: now.toISOString(), error: result.error }
          : { status: "idle", finishedAt: now.toISOString() },
      });
      const retained = new Set(articles.map((article) => article.image).filter(Boolean));
      await Promise.all(state.articles.filter((article) => article.image && !retained.has(article.image))
        .map((article) => fs.unlink(path.join(IMAGE_DIR, `${article.image}.png`)).catch(() => undefined)));
    } catch (error) {
      await Promise.all(createdImages.map((image) => fs.unlink(image).catch(() => undefined)));
      throw error;
    }
  });
}

export async function readDiscoverImage(id: string): Promise<Buffer | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const state = await readDiscoverState();
  if (!state.articles.some((article) => article.image === id)) return null;
  try { return await fs.readFile(path.join(IMAGE_DIR, `${id}.png`)); }
  catch { return null; }
}
