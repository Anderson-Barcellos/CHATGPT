import { describe, expect, it } from "vitest";
import {
  FRESH_WEB_CONTEXT_TOOL_NAME,
  accumulateDeepSeekAssistantTurn,
  buildDeepSeekChatCompletionParams,
  buildDeepSeekToolContinuationMessages,
  buildOpenAIWebContextParams,
  createInitialDeepSeekAssistantTurn,
  deepSeekChunkToAssistantStreamEvent,
} from "./deepseekChat";

describe("DeepSeek chat adapter", () => {
  it("builds a text-only DeepSeek V4 Pro request with max reasoning", () => {
    const params = buildDeepSeekChatCompletionParams({
      input: [{ role: "user", content: "Bah, resume isso." }],
      instructions: "Responda em portugues.",
      maxOutputTokens: 2048,
      stream: true,
    });

    expect(params).toMatchObject({
      model: "deepseek-v4-pro",
      max_tokens: 2048,
      reasoning_effort: "max",
      stream: true,
      parallel_tool_calls: false,
      tool_choice: "auto",
      messages: [
        { role: "system", content: "Responda em portugues." },
        { role: "user", content: "Bah, resume isso." },
      ],
    });
    expect(params.tools?.[0]).toMatchObject({
      type: "function",
      function: {
        name: FRESH_WEB_CONTEXT_TOOL_NAME,
      },
    });
  });

  it("rejects image input before calling DeepSeek", () => {
    expect(() =>
      buildDeepSeekChatCompletionParams({
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: "Analisa essa imagem." },
              {
                type: "input_image",
                image_url: "data:image/png;base64,abc",
                detail: "auto",
              },
            ],
          },
        ],
        stream: true,
      })
    ).toThrow("DeepSeek V4 Pro ainda esta habilitado apenas para texto");
  });

  it("maps DeepSeek streaming chunks to the internal assistant stream events", () => {
    expect(
      deepSeekChunkToAssistantStreamEvent({
        choices: [{ delta: { reasoning_content: "pensando" } }],
      })
    ).toEqual({ type: "response.reasoning_text.delta", delta: "pensando" });

    expect(
      deepSeekChunkToAssistantStreamEvent({
        choices: [{ delta: { content: "resposta" } }],
      })
    ).toEqual({ type: "response.output_text.delta", delta: "resposta" });

    expect(
      deepSeekChunkToAssistantStreamEvent({
        choices: [{ delta: {} }],
        usage: { prompt_tokens: 10, completion_tokens: 20 },
      })
    ).toEqual({
      type: "response.completed",
      response: {
        usage: {
          input_tokens: 10,
          output_tokens: 20,
        },
      },
    });
  });

  it("accumulates streamed DeepSeek tool calls", () => {
    const turn = createInitialDeepSeekAssistantTurn();
    accumulateDeepSeekAssistantTurn(turn, {
      choices: [
        {
          delta: {
            reasoning_content: "preciso pesquisar",
            tool_calls: [
              {
                index: 0,
                id: "call_1",
                type: "function",
                function: {
                  name: FRESH_WEB_CONTEXT_TOOL_NAME,
                  arguments: "{\"query\":\"DeepSeek V4 web search",
                },
              },
            ],
          },
        },
      ],
    });
    accumulateDeepSeekAssistantTurn(turn, {
      choices: [
        {
          delta: {
            tool_calls: [
              {
                index: 0,
                function: {
                  arguments: " docs\"}",
                },
              },
            ],
          },
        },
      ],
    });

    expect(turn.reasoningContent).toBe("preciso pesquisar");
    expect(turn.toolCalls).toEqual([
      {
        index: 0,
        id: "call_1",
        type: "function",
        function: {
          name: FRESH_WEB_CONTEXT_TOOL_NAME,
          arguments: "{\"query\":\"DeepSeek V4 web search docs\"}",
        },
      },
    ]);
  });

  it("builds DeepSeek continuation messages with the OpenAI web context result", () => {
    const messages = buildDeepSeekToolContinuationMessages(
      [{ role: "user", content: "O que mudou hoje?" }],
      {
        content: "",
        reasoningContent: "vou buscar",
        toolCalls: [
          {
            index: 0,
            id: "call_1",
            type: "function",
            function: {
              name: FRESH_WEB_CONTEXT_TOOL_NAME,
              arguments: "{\"query\":\"mudancas hoje\"}",
            },
          },
        ],
      },
      [{ toolCallId: "call_1", content: "Resumo fresco com fontes." }]
    );

    expect(messages).toEqual([
      { role: "user", content: "O que mudou hoje?" },
      {
        role: "assistant",
        content: "",
        reasoning_content: "vou buscar",
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: {
              name: FRESH_WEB_CONTEXT_TOOL_NAME,
              arguments: "{\"query\":\"mudancas hoje\"}",
            },
          },
        ],
      },
      {
        role: "tool",
        tool_call_id: "call_1",
        content: "Resumo fresco com fontes.",
      },
    ]);
  });

  it("builds the OpenAI web context request with web search and low reasoning", () => {
    const params = buildOpenAIWebContextParams("noticias de IA hoje", {
      model: "gpt-5.4-mini",
    });

    expect(params).toMatchObject({
      model: "gpt-5.4-mini",
      input: "noticias de IA hoje",
      reasoning: { effort: "low" },
      text: { verbosity: "high" },
      tools: [
        {
          type: "web_search_preview",
          search_context_size: "medium",
          user_location: { type: "approximate", country: "BR" },
        },
      ],
    });
  });
});
