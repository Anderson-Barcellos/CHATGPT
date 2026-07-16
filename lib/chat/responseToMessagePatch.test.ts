import { describe, expect, it } from "vitest";
import type OpenAI from "openai";
import { responseToMessagePatch } from "@/lib/chat/responseToMessagePatch";

function response(overrides: Partial<OpenAI.Responses.Response>) {
  return {
    id: "resp_test",
    object: "response",
    created_at: 1,
    status: "completed",
    error: null,
    incomplete_details: null,
    instructions: null,
    max_output_tokens: null,
    model: "gpt-5.4-mini",
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

describe("responseToMessagePatch", () => {
  it("extracts text, citations and usage from a completed response", () => {
    const patch = responseToMessagePatch(
      response({
        output: [
          {
            type: "web_search_call",
            id: "ws_1",
            status: "completed",
            action: { type: "search", queries: ["teste"] },
          },
          {
            type: "message",
            id: "msg_1",
            status: "completed",
            role: "assistant",
            content: [
              {
                type: "output_text",
                text: "Resposta final (example.com)",
                annotations: [
                  {
                    type: "url_citation",
                    url: "https://example.com",
                    title: "Fonte",
                    start_index: 0,
                    end_index: 6,
                  },
                ],
              },
            ],
          },
        ],
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          input_tokens_details: { cached_tokens: 3, cache_write_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 4 },
        },
      })
    );

    expect(patch).toMatchObject({
      content: "Resposta final [1]",
      streamStatus: "completed",
      citations: [{ title: "Fonte", url: "https://example.com" }],
      inputTokens: 10,
      outputTokens: 20,
      cachedTokens: 3,
      reasoningTokens: 4,
      isSearching: false,
      isGeneratingImage: false,
    });
  });

  it("extracts final generated image output", () => {
    const patch = responseToMessagePatch(
      response({
        output: [
          {
            type: "image_generation_call",
            id: "ig_1",
            status: "completed",
            result: "base64-final",
          },
        ],
      })
    );

    expect(patch).toMatchObject({
      streamStatus: "completed",
      imageBase64: "base64-final",
      imageMimeType: "image/png",
    });
  });

  it("keeps in-progress responses as streaming pending work", () => {
    const patch = responseToMessagePatch(
      response({
        status: "in_progress",
      })
    );

    expect(patch).toMatchObject({
      streamStatus: "streaming",
      isSearching: true,
    });
  });

  it("turns failed responses into failed messages", () => {
    const patch = responseToMessagePatch(
      response({
        status: "failed",
        error: {
          code: "server_error",
          message: "Falhou upstream",
        },
      })
    );

    expect(patch).toMatchObject({
      streamStatus: "failed",
      content: "Falhou upstream",
    });
  });

  it("explains incomplete responses caused by output token exhaustion", () => {
    const patch = responseToMessagePatch(
      response({
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
      })
    );

    expect(patch).toMatchObject({
      streamStatus: "failed",
      content:
        "❌ A geração em segundo plano esgotou o limite de tokens antes de produzir texto final.",
    });
  });

  it("preserves partial text from incomplete responses", () => {
    const patch = responseToMessagePatch(
      response({
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        output: [
          {
            type: "message",
            id: "msg_partial",
            status: "incomplete",
            role: "assistant",
            content: [
              {
                type: "output_text",
                text: "Texto parcial recuperavel.",
                annotations: [],
              },
            ],
          },
        ],
      })
    );

    expect(patch).toMatchObject({
      streamStatus: "failed",
      content: "Texto parcial recuperavel.",
    });
  });
});
