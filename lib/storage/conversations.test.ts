import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientApiError } from "@/lib/api/errors";
import {
  createConversation,
  listConversations,
  saveConversationMessages,
} from "@/lib/storage/conversations";

describe("conversation storage client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lists and deserializes conversations from the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              id: "conv-1",
              title: "Teste",
              messages: [],
              createdAt: "2026-04-14T10:00:00.000Z",
              updatedAt: "2026-04-14T10:00:00.000Z",
            },
          ]),
          { status: 200 }
        )
      )
    );

    const conversations = await listConversations();

    expect(conversations).toHaveLength(1);
    expect(conversations[0].createdAt).toBeInstanceOf(Date);
    expect(conversations[0].title).toBe("Teste");
  });

  it("throws a clear error when createConversation fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: "Failed to create conversation",
            message: "Nao consegui criar uma nova conversa agora.",
            code: "conversation_create_failed",
          }),
          { status: 500 }
        )
      )
    );

    await expect(createConversation("Nova conversa")).rejects.toMatchObject({
      name: "ClientApiError",
      status: 500,
      code: "conversation_create_failed",
      message: "Nao consegui criar uma nova conversa agora.",
    } satisfies Partial<ClientApiError>);
  });

  it("throws when saving messages fails instead of swallowing the error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: "Failed to update conversation",
            message: "Nao consegui salvar essa conversa agora.",
            code: "conversation_update_failed",
          }),
          { status: 500 }
        )
      )
    );

    await expect(
      saveConversationMessages("conv-1", [
        {
          id: "msg-1",
          role: "user",
          content: "Oi",
          timestamp: new Date("2026-04-14T10:00:00.000Z"),
        },
      ])
    ).rejects.toMatchObject({
      name: "ClientApiError",
      status: 500,
      code: "conversation_update_failed",
    } satisfies Partial<ClientApiError>);
  });
});
