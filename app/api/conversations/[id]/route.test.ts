import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getConversationMock = vi.fn();
const updateConversationMock = vi.fn();
const archiveConversationMock = vi.fn();
const permanentlyDeleteConversationMock = vi.fn();
const isAuthEnabledMock = vi.fn();
const isAuthenticatedRequestMock = vi.fn();

vi.mock("../data", () => ({
  getConversation: getConversationMock,
  updateConversation: updateConversationMock,
  archiveConversation: archiveConversationMock,
  permanentlyDeleteConversation: permanentlyDeleteConversationMock,
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

  it("archives by default without invoking permanent deletion", async () => {
    getConversationMock.mockResolvedValueOnce({ id: "conv-1" });
    archiveConversationMock.mockResolvedValueOnce({
      id: "conv-1",
      lifecycle: "archived",
    });

    const { DELETE } = await import("./route");
    const response = await DELETE(
      new NextRequest("http://localhost/api/conversations/conv-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "conv-1" }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      archived: true,
    });
    expect(archiveConversationMock).toHaveBeenCalledWith("conv-1");
    expect(permanentlyDeleteConversationMock).not.toHaveBeenCalled();
  });

  it("uses the canonical permanent deletion transaction when requested", async () => {
    getConversationMock.mockResolvedValueOnce({ id: "conv-1" });
    permanentlyDeleteConversationMock.mockResolvedValueOnce({
      conversations: 1,
      messages: 2,
      attachments: 1,
      evidence: 3,
      facts: 1,
    });

    const { DELETE } = await import("./route");
    const response = await DELETE(
      new NextRequest(
        "http://localhost/api/conversations/conv-1?permanent=true",
        { method: "DELETE" }
      ),
      { params: Promise.resolve({ id: "conv-1" }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      permanent: true,
      report: { conversations: 1, messages: 2, attachments: 1 },
    });
    expect(permanentlyDeleteConversationMock).toHaveBeenCalledWith("conv-1");
    expect(archiveConversationMock).not.toHaveBeenCalled();
  });
});
