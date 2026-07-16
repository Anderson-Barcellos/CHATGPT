import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = { conversationId: string };

const lance = vi.hoisted(() => {
  const store = { rows: [] as Row[] };
  const conversationIdFromFilter = (filter: string) =>
    filter.match(/^conversationId = '((?:''|[^'])*)'$/)?.[1]?.replace(/''/g, "'") ?? "";

  const table = {
    countRows: vi.fn(async (filter: string) => {
      const id = conversationIdFromFilter(filter);
      return store.rows.filter((row) => row.conversationId === id).length;
    }),
    delete: vi.fn(async (filter: string) => {
      const id = conversationIdFromFilter(filter);
      store.rows = store.rows.filter((row) => row.conversationId !== id);
    }),
    query: vi.fn(() => ({
      select: vi.fn(() => ({
        toArray: vi.fn(async () => store.rows.map((row) => ({ ...row }))),
      })),
    })),
  };

  const db = {
    tableNames: vi.fn(async () => ["conversation_chunks"]),
    openTable: vi.fn(async () => table),
  };

  return { store, table, db };
});

vi.mock("server-only", () => ({}));
vi.mock("@lancedb/lancedb", () => ({
  connect: vi.fn(async () => lance.db),
}));
vi.mock("@/lib/server/chatRequest", () => ({
  createOpenAIClient: vi.fn(),
}));

import {
  deleteConversationFromMemoryIndex,
  reconcileMemoryIndex,
} from "@/lib/server/memory/indexStore";

describe("memory index lifecycle", () => {
  beforeEach(() => {
    lance.store.rows = [];
    vi.clearAllMocks();
  });

  it("deletes every chunk for one conversation and reports the count", async () => {
    lance.store.rows = [
      { conversationId: "conv-delete" },
      { conversationId: "conv-delete" },
      { conversationId: "conv-keep" },
    ];

    await expect(
      deleteConversationFromMemoryIndex("conv-delete")
    ).resolves.toBe(2);
    expect(lance.store.rows).toEqual([{ conversationId: "conv-keep" }]);
  });

  it("removes only conversation IDs absent from the canonical set", async () => {
    lance.store.rows = [
      { conversationId: "conv-keep" },
      { conversationId: "conv-orphan-a" },
      { conversationId: "conv-orphan-a" },
      { conversationId: "conv-orphan-b" },
    ];

    await expect(reconcileMemoryIndex(["conv-keep"])).resolves.toEqual({
      removedConversations: 2,
      removedChunks: 3,
    });
    expect(lance.store.rows).toEqual([{ conversationId: "conv-keep" }]);
  });
});
