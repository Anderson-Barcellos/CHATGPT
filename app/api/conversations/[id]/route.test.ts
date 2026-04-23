import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getConversationMock = vi.fn();
const updateConversationMock = vi.fn();
const deleteConversationMock = vi.fn();
const isAuthEnabledMock = vi.fn();
const isAuthenticatedRequestMock = vi.fn();

vi.mock("../data", () => ({
  getConversation: getConversationMock,
  updateConversation: updateConversationMock,
  deleteConversation: deleteConversationMock,
}));

vi.mock("@/lib/server/auth", () => ({
  isAuthEnabled: isAuthEnabledMock,
  isAuthenticatedRequest: isAuthenticatedRequestMock,
}));

describe("/api/conversations/[id] route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    isAuthEnabledMock.mockReturnValue(false);
    isAuthenticatedRequestMock.mockResolvedValue(true);
  });

  it("returns the standardized not-found payload", async () => {
    getConversationMock.mockResolvedValueOnce(undefined);
    const { GET } = await import("./route");

    const response = await GET(
      new NextRequest("http://localhost/api/conversations/conv-404"),
      { params: Promise.resolve({ id: "conv-404" }) }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: "Not found",
      message: "Conversa nao encontrada.",
      code: "conversation_not_found",
    });
  });
});
