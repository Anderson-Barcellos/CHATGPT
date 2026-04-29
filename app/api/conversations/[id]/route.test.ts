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

  it("updates workspace notes when payload is valid", async () => {
    const now = new Date("2026-04-28T19:20:00.000Z");
    updateConversationMock.mockResolvedValueOnce({
      id: "conv-1",
      title: "Conversa teste",
      messages: [],
      workspace: {
        notes: {
          objective: "Objetivo final",
          body: "Notas da rodada",
          nextSteps: ["Validar", "Publicar"],
          updatedAt: now,
        },
      },
      createdAt: now,
      updatedAt: now,
    });

    const { PUT } = await import("./route");
    const response = await PUT(
      new NextRequest("http://localhost/api/conversations/conv-1", {
        method: "PUT",
        body: JSON.stringify({
          workspace: {
            notes: {
              objective: "  Objetivo final  ",
              body: "Notas da rodada",
              nextSteps: [" Validar ", "", "Publicar"],
            },
          },
        }),
      }),
      { params: Promise.resolve({ id: "conv-1" }) }
    );

    expect(response.status).toBe(200);
    expect(updateConversationMock).toHaveBeenCalledWith(
      "conv-1",
      expect.objectContaining({
        workspace: {
          notes: {
            objective: "Objetivo final",
            body: "Notas da rodada",
            nextSteps: ["Validar", "Publicar"],
            updatedAt: expect.any(Date),
          },
        },
      })
    );
  });

  it("rejects invalid workspace payload", async () => {
    const { PUT } = await import("./route");
    const response = await PUT(
      new NextRequest("http://localhost/api/conversations/conv-1", {
        method: "PUT",
        body: JSON.stringify({
          workspace: "invalid",
        }),
      }),
      { params: Promise.resolve({ id: "conv-1" }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid workspace payload",
      code: "invalid_workspace_payload",
    });
    expect(updateConversationMock).not.toHaveBeenCalled();
  });
});
