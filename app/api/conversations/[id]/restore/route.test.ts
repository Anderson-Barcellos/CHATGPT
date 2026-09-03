import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const restoreConversationMock = vi.fn();
const isAuthEnabledMock = vi.fn();
const isAuthenticatedRequestMock = vi.fn();

vi.mock("../../data", () => ({
  restoreConversation: restoreConversationMock,
}));

vi.mock("@/lib/server/auth", () => ({
  isAuthEnabled: isAuthEnabledMock,
  isAuthenticatedRequest: isAuthenticatedRequestMock,
}));

describe("/api/conversations/[id]/restore route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    isAuthEnabledMock.mockReturnValue(false);
    isAuthenticatedRequestMock.mockResolvedValue(true);
  });

  it("restores an archived conversation", async () => {
    const now = new Date("2026-08-31T12:00:00.000Z");
    restoreConversationMock.mockResolvedValueOnce({
      id: "conv-1",
      title: "Restaurada",
      lifecycle: "active",
      messages: [],
      createdAt: now,
      updatedAt: now,
    });
    const { POST } = await import("./route");

    const response = await POST(
      new NextRequest("http://localhost/api/conversations/conv-1/restore", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "conv-1" }) }
    );

    expect(response.status).toBe(200);
    expect(restoreConversationMock).toHaveBeenCalledWith("conv-1");
    await expect(response.json()).resolves.toMatchObject({
      id: "conv-1",
      lifecycle: "active",
    });
  });

  it("returns not found when the conversation does not exist", async () => {
    restoreConversationMock.mockResolvedValueOnce(undefined);
    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/conversations/missing/restore", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "missing" }) }
    );

    expect(response.status).toBe(404);
  });
});
