import { beforeEach, describe, expect, it, vi } from "vitest";

const memoryMocks = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock("@/lib/server/memory/toolExecutor", () => ({
  executeMemoryToolCall: memoryMocks.execute,
}));

import {
  buildAnthropicMessageParams,
  buildAnthropicMessages,
  createAnthropicEventStream,
  resolveAnthropicEffort,
} from "@/lib/server/anthropicChat";

function eventStream(events: unknown[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const event of events) yield event;
    },
  };
}

type FakeAnthropicClient = {
  messages: { create: ReturnType<typeof vi.fn> };
};

function clientFor(...streams: unknown[][]) {
  return {
    messages: {
      create: vi.fn().mockImplementation(() => {
        const events = streams.shift();
        if (!events) throw new Error("stream não esperado");
        return Promise.resolve(eventStream(events));
      }),
    },
  } as FakeAnthropicClient;
}

function baseBody(overrides: Record<string, unknown> = {}) {
  return {
    model: "claude-sonnet-5-5",
    stream: true,
    responseMode: "default",
    input: [{ role: "user", content: "Oi" }],
    ...overrides,
  } as never;
}

async function payloads(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let raw = "";
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    raw += decoder.decode(next.value, { stream: true });
  }
  return raw
    .trim()
    .split("\n\n")
    .filter(Boolean)
    .map((entry) => entry.replace(/^data: /, ""))
    .map((entry) => (entry === "[DONE]" ? entry : JSON.parse(entry)));
}

describe("adaptador Claude", () => {
  beforeEach(() => {
    memoryMocks.execute.mockReset();
  });

  it("traduz texto, raciocínio, busca, citações e uso agregado ao SSE interno", async () => {
    const client = clientFor([
      {
        type: "message_start",
        message: { usage: { input_tokens: 1, output_tokens: 0 } },
      },
      {
        type: "content_block_start",
        index: 0,
        content_block: { type: "thinking", thinking: "", signature: "" },
      },
      {
        type: "content_block_delta",
        index: 0,
        delta: { type: "thinking_delta", thinking: "Analisando." },
      },
      {
        type: "content_block_delta",
        index: 0,
        delta: { type: "signature_delta", signature: "assinatura" },
      },
      { type: "content_block_stop", index: 0 },
      {
        type: "content_block_start",
        index: 1,
        content_block: {
          type: "server_tool_use",
          id: "srv_1",
          name: "web_search",
          input: { query: "Gaucho Chat" },
        },
      },
      { type: "content_block_stop", index: 1 },
      {
        type: "content_block_start",
        index: 2,
        content_block: {
          type: "web_search_tool_result",
          tool_use_id: "srv_1",
          content: {
            type: "web_search_results",
            results: [],
          },
        },
      },
      { type: "content_block_stop", index: 2 },
      {
        type: "content_block_start",
        index: 3,
        content_block: { type: "text", text: "", citations: [] },
      },
      {
        type: "content_block_delta",
        index: 3,
        delta: {
          type: "citations_delta",
          citation: {
            type: "web_search_result_location",
            url: "https://example.test/fonte",
            title: "Fonte",
          },
        },
      },
      {
        type: "content_block_delta",
        index: 3,
        delta: { type: "text_delta", text: "Resposta." },
      },
      {
        type: "message_delta",
        delta: { stop_reason: "end_turn" },
        usage: {
          input_tokens: 10,
          cache_read_input_tokens: 3,
          output_tokens: 7,
          output_tokens_details: { thinking_tokens: 5 },
        },
      },
      { type: "message_stop" },
    ]);

    const result = await payloads(
      createAnthropicEventStream(client as never, baseBody(), new AbortController().signal)
    );

    expect(result).toEqual(expect.arrayContaining([
      { type: "response.reasoning_text.delta", delta: "Analisando." },
      { type: "response.output_item.added", item: { type: "web_search_call" } },
      { type: "response.output_item.done", item: { type: "web_search_call" } },
      {
        type: "response.output_text.annotation.added",
        annotation: {
          type: "url_citation",
          title: "Fonte",
          url: "https://example.test/fonte",
        },
      },
      { type: "response.output_text.delta", delta: "Resposta." },
      {
        type: "response.completed",
        response: {
          usage: {
            input_tokens: 13,
            output_tokens: 7,
            input_tokens_details: { cached_tokens: 3 },
            output_tokens_details: { reasoning_tokens: 5 },
          },
        },
      },
      "[DONE]",
    ]));
    const webStarted = result.findIndex(
      (event) => event !== "[DONE]" && event.type === "response.output_item.added"
    );
    const webFinished = result.findIndex(
      (event) => event !== "[DONE]" && event.type === "response.output_item.done"
    );
    const firstText = result.findIndex(
      (event) => event !== "[DONE]" && event.type === "response.output_text.delta"
    );
    expect(webStarted).toBeLessThan(webFinished);
    expect(webFinished).toBeLessThan(firstText);
    expect(result.filter((event) => event !== "[DONE]" && event.type === "response.completed")).toHaveLength(1);
  });

  it("preserva blocos assinados nas continuações de memória e não conclui a rodada intermediária", async () => {
    memoryMocks.execute.mockResolvedValue({
      type: "function_call_output",
      call_id: "toolu_1",
      output: '{"ok":true}',
    });
    const client = clientFor(
      [
        {
          type: "content_block_start",
          index: 0,
          content_block: { type: "thinking", thinking: "", signature: "" },
        },
        {
          type: "content_block_delta",
          index: 0,
          delta: { type: "thinking_delta", thinking: "Pensando." },
        },
        {
          type: "content_block_delta",
          index: 0,
          delta: { type: "signature_delta", signature: "assinada" },
        },
        { type: "content_block_stop", index: 0 },
        {
          type: "content_block_start",
          index: 1,
          content_block: {
            type: "web_fetch_tool_result",
            tool_use_id: "srv_fetch_1",
            content: {
              type: "web_fetch_result",
              url: "https://example.test/fetch",
              content: {
                type: "document",
                document_index: 7,
                source: { type: "text", media_type: "text/plain", data: "Fonte fetch" },
              },
            },
          },
        },
        { type: "content_block_stop", index: 1 },
        {
          type: "content_block_start",
          index: 2,
          content_block: { type: "text", text: "", citations: [] },
        },
        {
          type: "content_block_delta",
          index: 2,
          delta: {
            type: "citations_delta",
            citation: {
              type: "char_location",
              document_index: 7,
              document_title: "Fonte fetch",
              cited_text: "Fonte fetch",
              start_char_index: 0,
              end_char_index: 11,
            },
          },
        },
        {
          type: "content_block_delta",
          index: 2,
          delta: { type: "text_delta", text: "Usei a fonte fetch. " },
        },
        {
          type: "content_block_start",
          index: 3,
          content_block: {
            type: "tool_use",
            id: "toolu_1",
            name: "search_memory",
            input: {},
          },
        },
        {
          type: "content_block_delta",
          index: 3,
          delta: { type: "input_json_delta", partial_json: '{"query":"Anders","topK":2}' },
        },
        { type: "content_block_stop", index: 3 },
        {
          type: "message_delta",
          delta: { stop_reason: "tool_use" },
          usage: { input_tokens: 4, cache_read_input_tokens: 0, output_tokens: 3 },
        },
      ],
      [
        {
          type: "content_block_start",
          index: 0,
          content_block: { type: "text", text: "", citations: [] },
        },
        {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "Memória encontrada." },
        },
        {
          type: "message_delta",
          delta: { stop_reason: "end_turn" },
          usage: { input_tokens: 5, cache_read_input_tokens: 1, output_tokens: 6 },
        },
      ]
    );

    const result = await payloads(
      createAnthropicEventStream(client as never, baseBody(), new AbortController().signal)
    );

    expect(memoryMocks.execute).toHaveBeenCalledWith(expect.objectContaining({
      call_id: "toolu_1",
      name: "search_memory",
      arguments: '{"query":"Anders","topK":2}',
    }));
    expect(client.messages.create).toHaveBeenCalledTimes(2);
    expect(client.messages.create.mock.calls[1][0].messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        role: "assistant",
        content: expect.arrayContaining([
          expect.objectContaining({ type: "thinking", thinking: "Pensando.", signature: "assinada" }),
          expect.objectContaining({
            type: "text",
            citations: [expect.objectContaining({ document_index: 7 })],
          }),
          expect.objectContaining({ type: "tool_use", id: "toolu_1", input: { query: "Anders", topK: 2 } }),
        ]),
      }),
      expect.objectContaining({
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "toolu_1", content: '{"ok":true}' },
        ],
      }),
    ]));
    expect(result.filter((event) => event !== "[DONE]" && event.type === "response.completed")).toHaveLength(1);
    expect(result).toContainEqual({
      type: "response.output_text.annotation.added",
      annotation: {
        type: "url_citation",
        title: "Fonte fetch",
        url: "https://example.test/fetch",
      },
    });
    expect(result).toContainEqual(expect.objectContaining({
      type: "response.completed",
      response: expect.objectContaining({
        usage: expect.objectContaining({
          input_tokens: 10,
          output_tokens: 9,
          input_tokens_details: { cached_tokens: 1 },
        }),
      }),
    }));
  });

  it("mantém a busca ativa entre uma pausa e o resultado correlato", async () => {
    const client = clientFor(
      [
        {
          type: "content_block_start",
          index: 0,
          content_block: {
            type: "server_tool_use",
            id: "srv_pause_1",
            name: "web_fetch",
            input: { url: "https://example.test/fetch" },
          },
        },
        { type: "content_block_stop", index: 0 },
        {
          type: "message_delta",
          delta: { stop_reason: "pause_turn" },
          usage: { output_tokens: 1 },
        },
      ],
      [
        {
          type: "content_block_start",
          index: 0,
          content_block: {
            type: "web_fetch_tool_result",
            tool_use_id: "srv_pause_1",
            content: {
              type: "web_fetch_result",
              url: "https://example.test/fetch",
              content: { type: "document", source: { type: "text", media_type: "text/plain", data: "ok" } },
            },
          },
        },
        {
          type: "message_delta",
          delta: { stop_reason: "end_turn" },
          usage: { output_tokens: 1 },
        },
      ]
    );

    const result = await payloads(
      createAnthropicEventStream(client as never, baseBody(), new AbortController().signal)
    );

    expect(result.filter(
      (event) => event !== "[DONE]" && event.type === "response.output_item.added"
    )).toHaveLength(1);
    expect(result.filter(
      (event) => event !== "[DONE]" && event.type === "response.output_item.done"
    )).toHaveLength(1);
  });

  it("falha o stream em max_tokens em vez de declarar sucesso", async () => {
    const client = clientFor([
      {
        type: "message_delta",
        delta: { stop_reason: "max_tokens" },
        usage: { input_tokens: 3, output_tokens: 8 },
      },
    ]);

    await expect(
      payloads(createAnthropicEventStream(client as never, baseBody(), new AbortController().signal))
    ).rejects.toThrow("atingiu o limite de tokens");
  });

  it("mantém input e cache do message_start quando o delta só informa saída", async () => {
    const client = clientFor([
      {
        type: "message_start",
        message: {
          usage: { input_tokens: 6, cache_read_input_tokens: 2, output_tokens: 0 },
        },
      },
      {
        type: "message_delta",
        delta: { stop_reason: "end_turn" },
        usage: { output_tokens: 4 },
      },
    ]);

    const result = await payloads(
      createAnthropicEventStream(client as never, baseBody(), new AbortController().signal)
    );

    expect(result).toContainEqual(expect.objectContaining({
      type: "response.completed",
      response: {
        usage: expect.objectContaining({
          input_tokens: 8,
          output_tokens: 4,
          input_tokens_details: { cached_tokens: 2 },
        }),
      },
    }));
  });

  it("não executa uma terceira rodada de memória após atingir o limite", async () => {
    memoryMocks.execute.mockResolvedValue({
      type: "function_call_output",
      call_id: "toolu_1",
      output: '{"ok":true}',
    });
    const toolTurn = (id: string) => [
      {
        type: "content_block_start",
        index: 0,
        content_block: { type: "tool_use", id, name: "search_memory", input: { query: "q", topK: 1 } },
      },
      { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 1 } },
    ];
    const client = clientFor(toolTurn("toolu_1"), toolTurn("toolu_2"), toolTurn("toolu_3"));

    await expect(
      payloads(createAnthropicEventStream(client as never, baseBody(), new AbortController().signal))
    ).rejects.toThrow("limite de continuações");

    expect(memoryMocks.execute).toHaveBeenCalledTimes(2);
  });

  it("fecha o reader quando o sinal do cliente já está abortado", async () => {
    const client = clientFor([]);
    const aborter = new AbortController();
    aborter.abort();

    await expect(
      payloads(createAnthropicEventStream(client as never, baseBody(), aborter.signal))
    ).resolves.toEqual([]);
  });

  it("sanitiza erros inesperados do upstream antes de propagar ao stream", async () => {
    const client = {
      messages: {
        create: vi.fn().mockRejectedValue(new Error("upstream com contexto privado")),
      },
    } as FakeAnthropicClient;

    await expect(
      payloads(createAnthropicEventStream(client as never, baseBody(), new AbortController().signal))
    ).rejects.toThrow("A resposta do Claude falhou antes de concluir.");

    await expect(
      payloads(createAnthropicEventStream(client as never, baseBody(), new AbortController().signal))
    ).rejects.not.toThrow("contexto privado");
  });

  it("não inventa URL quando a citação de fetch não tem documento conhecido", async () => {
    const client = clientFor([
      {
        type: "content_block_start",
        index: 0,
        content_block: { type: "text", text: "", citations: [] },
      },
      {
        type: "content_block_delta",
        index: 0,
        delta: {
          type: "citations_delta",
          citation: {
            type: "char_location",
            document_index: 99,
            document_title: "Documento ausente",
            cited_text: "trecho",
            start_char_index: 0,
            end_char_index: 6,
          },
        },
      },
      {
        type: "message_delta",
        delta: { stop_reason: "end_turn" },
        usage: { output_tokens: 1 },
      },
    ]);

    const result = await payloads(
      createAnthropicEventStream(client as never, baseBody(), new AbortController().signal)
    );

    expect(result).not.toContainEqual(expect.objectContaining({
      type: "response.output_text.annotation.added",
    }));
  });
});

describe("parâmetros Claude", () => {
  it("usa esforço medium como padrão e limita xhigh/max a high", () => {
    expect(resolveAnthropicEffort({})).toBe("medium");
    expect(resolveAnthropicEffort({ reasoning: { effort: "low" } })).toBe("low");
    expect(resolveAnthropicEffort({ reasoning: { effort: "xhigh" } })).toBe("high");
    expect(resolveAnthropicEffort({ reasoning: { effort: "max" } })).toBe("high");
  });

  it("configura somente as tools permitidas e preserva imagens HTTPS", () => {
    const params = buildAnthropicMessageParams(baseBody({
      reasoning: { effort: "high" },
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: "Leia esta imagem" },
          { type: "input_image", image_url: "https://example.test/imagem.png" },
        ],
      }],
    }));

    expect(params.output_config).toEqual({ effort: "high" });
    expect(params.tools).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "web_search_20260318", allowed_callers: ["direct"] }),
      expect.objectContaining({ type: "web_fetch_20260318", allowed_callers: ["direct"] }),
    ]));
    expect(params.tools?.some(
      (tool) => "type" in tool && typeof tool.type === "string" && tool.type.includes("code_execution")
    )).toBe(false);
    expect(params.messages[0].content).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "image", source: { type: "url", url: "https://example.test/imagem.png" } }),
    ]));
  });

  it("rejeita anexo incompatível sem descartá-lo", () => {
    expect(() => buildAnthropicMessages([
      { role: "user", content: [{ type: "input_file", file_id: "file_1" }] },
    ] as never)).toThrow("não é compatível");
  });
});
