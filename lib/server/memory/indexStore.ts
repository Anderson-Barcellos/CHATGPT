import "server-only";

import path from "path";
import * as lancedb from "@lancedb/lancedb";
import type { Conversation, RetrievedMemoryContext } from "@/types";
import { createOpenAIClient } from "@/lib/server/chatRequest";
import {
  chunkConversation,
  getConversationContentHash,
} from "@/lib/server/memory/chunking";

const MEMORY_INDEX_DIR = path.join(process.cwd(), "data", "memory-index");
const CHUNKS_TABLE = "conversation_chunks";
const EMBEDDING_MODEL = "text-embedding-3-small";
const DEFAULT_TOP_K = 5;

interface MemoryChunkRecord extends Record<string, unknown> {
  id: string;
  conversationId: string;
  conversationTitle: string;
  messageIds: string;
  chunkText: string;
  embeddingText: string;
  roleSpan: string;
  timestamp: string;
  chunkIndex: number;
  contentHash: string;
  conversationHash: string;
  vector: number[];
}

export interface IndexConversationResult {
  conversationId: string;
  status: "indexed" | "skipped" | "empty";
  chunks: number;
}

let connectionPromise: Promise<lancedb.Connection> | null = null;

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function getConnection() {
  if (!connectionPromise) {
    connectionPromise = lancedb.connect(MEMORY_INDEX_DIR);
  }
  return connectionPromise;
}

async function tableExists(name: string): Promise<boolean> {
  const db = await getConnection();
  return (await db.tableNames()).includes(name);
}

async function getChunksTable() {
  const db = await getConnection();
  if (!(await tableExists(CHUNKS_TABLE))) return null;
  return db.openTable(CHUNKS_TABLE);
}

async function createEmbedding(input: string | string[]): Promise<number[][]> {
  const openai = createOpenAIClient();
  if (!openai) {
    throw new Error("OPENAI_API_KEY nao configurada no servidor.");
  }

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input,
  });

  return response.data.map((item) => item.embedding);
}

export async function isConversationIndexed(
  conversation: Conversation
): Promise<boolean> {
  const table = await getChunksTable();
  if (!table) return false;

  const conversationHash = getConversationContentHash(conversation);
  const count = await table.countRows(
    `conversationId = ${sqlString(conversation.id)} AND conversationHash = ${sqlString(
      conversationHash
    )}`
  );
  return count > 0;
}

export async function indexConversation(
  conversation: Conversation
): Promise<IndexConversationResult> {
  const chunks = chunkConversation(conversation);
  const conversationHash = getConversationContentHash(conversation);

  if (chunks.length === 0) {
    return {
      conversationId: conversation.id,
      status: "empty",
      chunks: 0,
    };
  }

  if (await isConversationIndexed(conversation)) {
    return {
      conversationId: conversation.id,
      status: "skipped",
      chunks: chunks.length,
    };
  }

  const embeddings = await createEmbedding(chunks.map((chunk) => chunk.embeddingText));
  const records: MemoryChunkRecord[] = chunks.map((chunk, index) => ({
    id: chunk.id,
    conversationId: chunk.conversationId,
    conversationTitle: chunk.conversationTitle,
    messageIds: JSON.stringify(chunk.messageIds),
    chunkText: chunk.chunkText,
    embeddingText: chunk.embeddingText,
    roleSpan: chunk.roleSpan,
    timestamp: chunk.timestamp,
    chunkIndex: chunk.chunkIndex,
    contentHash: chunk.contentHash,
    conversationHash,
    vector: embeddings[index],
  }));

  const db = await getConnection();
  if (await tableExists(CHUNKS_TABLE)) {
    const table = await db.openTable(CHUNKS_TABLE);
    await table.delete(`conversationId = ${sqlString(conversation.id)}`);
    await table.add(records);
  } else {
    await db.createTable(CHUNKS_TABLE, records);
  }

  return {
    conversationId: conversation.id,
    status: "indexed",
    chunks: records.length,
  };
}

export async function searchMemoryContext(
  query: string,
  options: {
    topK?: number;
    excludeConversationId?: string;
  } = {}
): Promise<RetrievedMemoryContext[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const table = await getChunksTable();
  if (!table) return [];

  const [queryVector] = await createEmbedding(trimmed);
  let search = table.vectorSearch(queryVector);

  if (options.excludeConversationId) {
    search = search.where(
      `conversationId != ${sqlString(options.excludeConversationId)}`
    );
  }

  const rows = (await search.limit(options.topK ?? DEFAULT_TOP_K).toArray()) as Array<
    MemoryChunkRecord & { _distance?: number }
  >;

  return rows.map((row) => {
    const distance = typeof row._distance === "number" ? row._distance : 0;
    let messageIds: string[] = [];
    try {
      const parsed = JSON.parse(row.messageIds);
      if (Array.isArray(parsed)) messageIds = parsed.filter(Boolean);
    } catch {
      messageIds = [];
    }

    return {
      text: row.chunkText,
      score: Number((1 / (1 + Math.max(distance, 0))).toFixed(4)),
      conversationId: row.conversationId,
      conversationTitle: row.conversationTitle,
      messageIds,
      timestamp: row.timestamp,
      reason: row.roleSpan,
    };
  });
}

export async function getMemoryIndexStats() {
  const table = await getChunksTable();
  if (!table) {
    return { chunks: 0 };
  }

  return {
    chunks: await table.countRows(),
  };
}
