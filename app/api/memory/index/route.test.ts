import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAppAuth: vi.fn(),
  getConversation: vi.fn(),
  listConversations: vi.fn(),
  getMemoryIndexStats: vi.fn(),
  indexConversation: vi.fn(),
  reconcileMemoryIndex: vi.fn(),
}));

vi.mock("@/lib/server/routeAuth", () => ({
  requireAppAuth: mocks.requireAppAuth,
}));
vi.mock("@/app/api/conversations/data", () => ({
  getConversation: mocks.getConversation,
  listConversations: mocks.listConversations,
}));
vi.mock("@/lib/server/memory/indexStore", () => ({
  getMemoryIndexStats: mocks.getMemoryIndexStats,
  indexConversation: mocks.indexConversation,
  reconcileMemoryIndex: mocks.reconcileMemoryIndex,
}));

describe("/api/memory/index route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireAppAuth.mockResolvedValue(null);
    mocks.reconcileMemoryIndex.mockResolvedValue({
      removedConversations: 1,
      removedChunks: 4,
    });
    mocks.getMemoryIndexStats.mockResolvedValue({ chunks: 2 });
    mocks.indexConversation.mockImplementation(async (conversation) => ({
      conversationId: conversation.id,
      status: "indexed",
      chunks: 1,
    }));
  });

  it("reconciles against every canonical ID before indexing the limited recent slice", async () => {
    mocks.listConversations.mockResolvedValue([
      { id: "conv-1" },
      { id: "conv-2" },
      { id: "conv-3" },
    ]);

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/memory/index", {
        method: "POST",
        body: JSON.stringify({ limit: 2 }),
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.reconcileMemoryIndex).toHaveBeenCalledWith([
      "conv-1",
      "conv-2",
      "conv-3",
    ]);
    expect(mocks.indexConversation).toHaveBeenCalledTimes(2);
    expect(mocks.indexConversation).toHaveBeenNthCalledWith(1, { id: "conv-1" });
    expect(mocks.indexConversation).toHaveBeenNthCalledWith(2, { id: "conv-2" });
    await expect(response.json()).resolves.toMatchObject({
      reconciliation: { removedConversations: 1, removedChunks: 4 },
      stats: { chunks: 2 },
    });
  });
});
