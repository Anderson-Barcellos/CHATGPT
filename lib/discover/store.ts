import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { readDataFile, withDataFileLock, writeDataFile } from "@/lib/server/jsonFileStore";
import type { DiscoverArticle, DiscoverState } from "./types";

const FILE = "discover.json";
const EMPTY: DiscoverState = { topics: [], articles: [], job: { status: "idle" } };
const IMAGE_DIR = path.join(process.cwd(), "data", "discover-images");
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

export async function claimDiscoverJob(kind: "daily" | "manual", now = new Date()): Promise<"started" | "running" | "not_due"> {
  return withDataFileLock(FILE, async () => {
    const state = await readDiscoverState();
    const today = discoverDate(now);
    if (state.job.status === "running" && state.job.startedAt &&
      now.getTime() - new Date(state.job.startedAt).getTime() < 60 * 60 * 1000) return "running";
    if (kind === "daily" && state.lastDailyDate === today) return "not_due";
    await writeDataFile(FILE, {
      ...state,
      lastDailyDate: kind === "daily" ? today : state.lastDailyDate,
      job: { status: "running", startedAt: now.toISOString() },
    });
    return "started";
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
