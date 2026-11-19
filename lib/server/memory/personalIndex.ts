import "server-only";
import path from "path";
import * as lancedb from "@lancedb/lancedb";
import { createOpenAIClient } from "@/lib/server/chatRequest";
import { digest, readPersonalSources, type PersonalSource } from "./personalSources";

const TABLE = "personal_chunks";
const EMBEDDING_MODEL = "text-embedding-3-small";
export interface PersonalChunk { sourceId: string; text: string; sourceHash: string; offset: number }
export function personalChunks(sources: PersonalSource[]): PersonalChunk[] {
  return sources.flatMap(source => {
    const chunks: PersonalChunk[] = [];
    for (let offset = 0; offset < source.text.length; offset += 1000) {
      chunks.push({ sourceId: source.id, sourceHash: digest(source.text), offset, text: source.text.slice(offset, offset + 1200) });
    }
    return chunks;
  });
}
async function connect() { return lancedb.connect(path.join(process.cwd(), "data", "memory-index")); }

export async function rebuildPersonalIndex(sources: PersonalSource[]) {
  const chunks = personalChunks(sources);
  if (!chunks.length) return;
  const client = createOpenAIClient();
  if (!client) throw new Error("personal_provider_unavailable");
  const embedding = await client.embeddings.create({ model: EMBEDDING_MODEL, input: chunks.map(c => c.text) }, { timeout: 30000, maxRetries: 0 });
  if (embedding.data.length !== chunks.length) throw new Error("personal_embedding_incomplete");
  const db = await connect();
  await db.createTable(TABLE, chunks.map((chunk, i) => ({ ...chunk, vector: embedding.data[i].embedding })), { mode: "overwrite" });
}

export function validatePersonalChunks(chunks: PersonalChunk[], sources: PersonalSource[]) {
  const current = new Map(sources.map(source => [source.id, source]));
  return chunks.filter(chunk => {
    const source = current.get(chunk.sourceId);
    return source && digest(source.text) === chunk.sourceHash && source.text.slice(chunk.offset, chunk.offset + 1200) === chunk.text;
  });
}

function lexicalSearch(query: string, sources: PersonalSource[]) {
  const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const words = [...new Set(normalize(query).match(/[\p{L}\p{N}]{3,}/gu) || [])];
  return personalChunks(sources).map(chunk => ({ chunk, score: words.reduce((n, word) => n + Number(normalize(chunk.text).includes(word)), 0) }))
    .filter(item => item.score > 0).sort((a, b) => b.score - a.score).map(item => item.chunk);
}

export async function searchPersonalSources(query: string, limit = 3) {
  if (!query.trim()) return [];
  const initial = await readPersonalSources();
  let candidates = lexicalSearch(query, initial.sources);
  try {
    const client = createOpenAIClient();
    const db = await connect();
    if (client && (await db.tableNames()).includes(TABLE)) {
      const embedding = await client.embeddings.create({ model: EMBEDDING_MODEL, input: query }, { timeout: 8000, maxRetries: 0 });
      const table = await db.openTable(TABLE);
      const rows = await table.vectorSearch(embedding.data[0].embedding).distanceType("cosine").limit(6).toArray();
      candidates = [...rows.filter(row => typeof row._distance === "number" && row._distance <= 0.55).map(row => ({
        sourceId: String(row.sourceId), sourceHash: String(row.sourceHash), offset: Number(row.offset), text: String(row.text),
      })), ...candidates];
    }
  } catch { /* Current-source lexical retrieval remains available without embeddings. */ }
  const current = await readPersonalSources();
  const valid = validatePersonalChunks(candidates, current.sources);
  const seen = new Set<string>();
  return valid.filter(chunk => {
    const key = `${chunk.sourceId}:${chunk.offset}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, Math.min(Math.max(limit, 1), 3));
}
