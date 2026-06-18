import type {
  MemorySuggestion,
  RetrievedMemoryContext,
  SerializedMemorySuggestion,
} from "@/types";
import { apiUrl } from "@/lib/utils";

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

  if (!response.ok) return [];
  const data = (await safeJson(response)) as {
    results?: RetrievedMemoryContext[];
  } | null;
  return Array.isArray(data?.results) ? data.results : [];
}

export async function indexConversationMemory(
  conversationId: string
): Promise<void> {
  await fetch(apiUrl("/api/memory/index"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId }),
  });
}

export async function indexRecentConversationMemories(
  limit = 50
): Promise<void> {
  await fetch(apiUrl("/api/memory/index"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ limit }),
  });
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
