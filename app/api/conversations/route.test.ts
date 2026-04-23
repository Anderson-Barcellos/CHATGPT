import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const listConversationsMock = vi.fn();
const createConversationMock = vi.fn();
const isAuthEnabledMock = vi.fn();
const isAuthenticatedRequestMock = vi.fn();

vi.mock("./data", () => ({
  listConversations: listConversationsMock,
  createConversation: createConversationMock,
}));

vi.mock("@/lib/server/auth", () => ({
  isAuthEnabled: isAuthEnabledMock,
  isAuthenticatedRequest: isAuthenticatedRequestMock,
}));

describe("/api/conversations route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    isAuthEnabledMock.mockReturnValue(false);
    isAuthenticatedRequestMock.mockResolvedValue(true);
  });

  it("returns the standardized error payload when POST fails", async () => {
    createConversationMock.mockRejectedValueOnce(new Error("boom"));
    const { POST } = await import("./route");

    const response = await POST(
      new NextRequest("http://localhost/api/conversations", {
        method: "POST",
        body: JSON.stringify({ title: "Nova conversa" }),
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: "Failed to create conversation",
      message: "Nao consegui criar uma nova conversa agora.",
      code: "conversation_create_failed",
    });
  });
});
