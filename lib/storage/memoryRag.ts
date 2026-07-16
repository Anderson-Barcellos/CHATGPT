import type {
  MemorySuggestion,
  RetrievedMemoryContext,
  SerializedMemorySuggestion,
} from "@/types";
import { parseApiErrorResponse } from "@/lib/api/errors";
import { apiUrl } from "@/lib/utils";

export interface MemoryIndexResult {
  results: Array<{
    conversationId: string;
    status: "indexed" | "skipped" | "empty";
    chunks: number;
  }>;
  stats: { chunks: number };
  reconciliation?: {
    removedConversations: number;
    removedChunks: number;
  };
}

function toSuggestion(input: SerializedMemorySuggestion): MemorySuggestion {
  return {
    ...input,
    createdAt: new Date(input.createdAt),
    updatedAt: new Date(input.updatedAt),
  };
}

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function assertOk(res: Response): Promise<void> {
  if (!res.ok) {
    throw await parseApiErrorResponse(res);
  }
}

async function readMemoryIndexResult(res: Response): Promise<MemoryIndexResult> {
  await assertOk(res);
  const data = (await safeJson(res)) as MemoryIndexResult | null;
  if (!data || !Array.isArray(data.results) || typeof data.stats?.chunks !== "number") {
    throw new Error("A API de memoria retornou um resultado de indexacao invalido.");
  }
  return data;
}

export async function searchMemoryContext(input: {
  query: string;
  excludeConversationId?: string;
  topK?: number;
}): Promise<RetrievedMemoryContext[]> {
  const response = await fetch(apiUrl("/api/memory/search"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  await assertOk(response);
  const data = (await safeJson(response)) as {
    results?: RetrievedMemoryContext[];
  } | null;
  return Array.isArray(data?.results) ? data.results : [];
}

export async function indexConversationMemory(
  conversationId: string
): Promise<MemoryIndexResult> {
  const response = await fetch(apiUrl("/api/memory/index"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId }),
  });
  return readMemoryIndexResult(response);
}

export async function indexRecentConversationMemories(
  limit = 50
): Promise<MemoryIndexResult> {
  const response = await fetch(apiUrl("/api/memory/index"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ limit }),
  });
  return readMemoryIndexResult(response);
}

export async function createMemorySuggestions(
  conversationId: string
): Promise<MemorySuggestion[]> {
  const response = await fetch(apiUrl("/api/memory/suggestions"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId }),
  });

  if (!response.ok) return [];
  const data = await safeJson(response);
  return Array.isArray(data)
    ? data.map((item) => toSuggestion(item as SerializedMemorySuggestion))
    : [];
}

export async function listMemorySuggestions(): Promise<MemorySuggestion[]> {
  const response = await fetch(apiUrl("/api/memory/suggestions?status=pending"), {
    cache: "no-store",
  });

  if (!response.ok) return [];
  const data = await safeJson(response);
  return Array.isArray(data)
    ? data.map((item) => toSuggestion(item as SerializedMemorySuggestion))
    : [];
}

export async function updateMemorySuggestion(input: {
  id: string;
  status: "accepted" | "rejected";
  content?: string;
}): Promise<{ memoryId?: string }> {
  const response = await fetch(apiUrl(`/api/memory/suggestions/${input.id}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = (await safeJson(response)) as { memoryId?: string } | null;
  return { memoryId: data?.memoryId };
}
