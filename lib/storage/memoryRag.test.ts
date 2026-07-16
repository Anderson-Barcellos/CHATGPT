import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  indexConversationMemory,
  indexRecentConversationMemories,
  searchMemoryContext,
} from "@/lib/storage/memoryRag";

describe("memory RAG client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("throws the structured API error when semantic search fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            error: "Failed to search memory",
            message: "Busca de memoria indisponivel.",
            code: "memory_search_failed",
          },
          { status: 500 }
        )
      )
    );

    await expect(
      searchMemoryContext({ query: "contexto anterior" })
    ).rejects.toMatchObject({
      name: "ClientApiError",
      status: 500,
      code: "memory_search_failed",
    });
  });

  it("throws the structured API error when conversation indexing fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            error: "Failed to index memory",
            message: "Indexacao indisponivel.",
            code: "memory_index_failed",
          },
          { status: 500 }
        )
      )
    );

    await expect(indexConversationMemory("conv-1")).rejects.toMatchObject({
      name: "ClientApiError",
      status: 500,
      code: "memory_index_failed",
    });
  });

  it("returns indexing and reconciliation statistics", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          results: [
            { conversationId: "conv-1", status: "indexed", chunks: 2 },
          ],
          stats: { chunks: 4 },
          reconciliation: { removedConversations: 3, removedChunks: 8 },
        })
      )
    );

    await expect(indexRecentConversationMemories(75)).resolves.toEqual({
      results: [
        { conversationId: "conv-1", status: "indexed", chunks: 2 },
      ],
      stats: { chunks: 4 },
      reconciliation: { removedConversations: 3, removedChunks: 8 },
    });
  });
});
