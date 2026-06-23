import { beforeEach, describe, expect, it, vi } from "vitest";
import type OpenAI from "openai";
import type { Conversation } from "@/types";

const getConversationMock = vi.fn();
const updateConversationMock = vi.fn();

vi.mock("@/app/api/conversations/data", () => ({
  getConversation: getConversationMock,
  updateConversation: updateConversationMock,
}));

function response(overrides: Partial<OpenAI.Responses.Response>) {
  return {
    id: "resp-test",
    object: "response",
    created_at: 1,
    status: "completed",
    error: null,
    incomplete_details: null,
    instructions: null,
    max_output_tokens: null,
    model: "gpt-5.4",
    output: [],
    parallel_tool_calls: true,
    previous_response_id: null,
    reasoning: null,
    store: true,
    temperature: null,
    text: null,
    tool_choice: "auto",
    tools: [],
    top_p: null,
    truncation: "disabled",
    usage: null,
    ...overrides,
  } as OpenAI.Responses.Response;
}

function conversation(): Conversation {
  return {
    id: "conv-1",
    title: "Teste",
    createdAt: new Date("2026-06-22T10:00:00.000Z"),
    updatedAt: new Date("2026-06-22T10:00:00.000Z"),
    messages: [
      {
        id: "msg-assistant",
        role: "assistant",
        content: "Processando no servidor.",
        timestamp: new Date("2026-06-22T10:00:00.000Z"),
        responseMode: "deepsearch_high",
        streamStatus: "streaming",
        backgroundJob: {
          responseId: "resp-test",
          status: "in_progress",
          startedAt: "2026-06-22T10:00:00.000Z",
          updatedAt: "2026-06-22T10:00:00.000Z",
        },
      },
    ],
  };
}

describe("chatBackgroundJob", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "artifact-id"),
    });
    getConversationMock.mockResolvedValue(conversation());
    updateConversationMock.mockImplementation(async (_id, updates) => ({
      ...conversation(),
      ...updates,
    }));
  });

  it("keeps queued and in-progress jobs pending", async () => {
    const { applyBackgroundResponseToConversation } = await import("./chatBackgroundJob");

    const message = await applyBackgroundResponseToConversation({
      conversationId: "conv-1",
      assistantMessageId: "msg-assistant",
      response: response({ status: "in_progress" }),
    });

    expect(message).toMatchObject({
      streamStatus: "streaming",
      isSearching: true,
      backgroundJob: {
        responseId: "resp-test",
        status: "in_progress",
      },
    });
  });

  it("turns completed document-like jobs into document artifacts", async () => {
    const { applyBackgroundResponseToConversation } = await import("./chatBackgroundJob");

    const message = await applyBackgroundResponseToConversation({
      conversationId: "conv-1",
      assistantMessageId: "msg-assistant",
      response: response({
        output: [
          {
            type: "message",
            id: "out-1",
            status: "completed",
            role: "assistant",
            content: [
              {
                type: "output_text",
                text: "# Relatorio\n\n## Achados\n\nTexto final bem estruturado.",
                annotations: [],
              },
            ],
          },
        ],
      }),
    });

    expect(message?.streamStatus).toBe("completed");
    expect(message?.artifact).toMatchObject({
      id: "artifact-id",
      kind: "document",
      displayMode: "document",
    });
  });

  it("marks incomplete responses as failed instead of pending forever", async () => {
    const { applyBackgroundResponseToConversation } = await import("./chatBackgroundJob");

    const message = await applyBackgroundResponseToConversation({
      conversationId: "conv-1",
      assistantMessageId: "msg-assistant",
      response: response({ status: "incomplete" }),
    });

    expect(message).toMatchObject({
      streamStatus: "failed",
      backgroundJob: {
        status: "failed",
        error: "A resposta terminou incompleta antes de concluir.",
      },
    });
  });
});
