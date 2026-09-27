import type OpenAI from "openai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const memoryMocks = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock("@/lib/server/memory/toolExecutor", () => ({
  executeMemoryToolCall: memoryMocks.execute,
}));

import {
  buildXAIResponseCreateParams,
  createXAIClient,
  createXAIEventStream,
  createXAIResponse,
  GROK_MODEL,
  XAI_BASE_URL,
} from "./xaiChat";

const originalXaiKey = process.env.XAI_API_KEY;
const originalGrokKey = process.env.GROK_API_KEY;
const originalOpenAIKey = process.env.OPENAI_API_KEY;

type FunctionCall = OpenAI.Responses.ResponseFunctionToolCall;

function functionCall(
  name: string,
  callId: string,
  args: Record<string, unknown>
): FunctionCall {
  return {
    type: "function_call",
    name,
    call_id: callId,
    arguments: JSON.stringify(args),
    status: "completed",
  };
}

function usage(input: number, output: number, cached = 0, reasoning = 0) {
  return {
    input_tokens: input,
    output_tokens: output,
    total_tokens: input + output,
    input_tokens_details: { cached_tokens: cached, cache_write_tokens: 0 },
    output_tokens_details: { reasoning_tokens: reasoning },
  };
}

function response(
  id: string,
  output: OpenAI.Responses.ResponseOutputItem[] = [],
  overrides: Partial<OpenAI.Responses.Response> = {}
): OpenAI.Responses.Response {
  return {
    id,
    object: "response",
    created_at: 1,
    model: GROK_MODEL,
    status: "completed",
    output,
    output_text: "",
    error: null,
    incomplete_details: null,
    instructions: null,
    metadata: null,
    parallel_tool_calls: true,
    temperature: null,
    tool_choice: "auto",
    tools: [],
    top_p: null,
    usage: usage(1, 1),
    ...overrides,
  } as OpenAI.Responses.Response;
}

function completedStream(
  completedResponse: OpenAI.Responses.Response,
  events: Array<Record<string, unknown>> = []
): AsyncIterable<OpenAI.Responses.ResponseStreamEvent> {
  return (async function* () {
    for (const event of events) {
      yield event as unknown as OpenAI.Responses.ResponseStreamEvent;
    }
    yield {
      type: "response.completed",
      sequence_number: events.length,
      response: completedResponse,
    };
  })();
}

function mockClient(
  ...results: Array<unknown>
): { client: OpenAI; create: ReturnType<typeof vi.fn> } {
  const create = vi.fn();
  for (const result of results) create.mockResolvedValueOnce(result);
  return {
    client: { responses: { create } } as unknown as OpenAI,
    create,
  };
}

async function readSse(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let raw = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    raw += decoder.decode(value, { stream: true });
  }

  return raw
    .split("\n\n")
    .filter(Boolean)
    .map((entry) => entry.replace(/^data: /, ""))
    .filter((entry) => entry !== "[DONE]")
    .map((entry) => JSON.parse(entry) as Record<string, unknown>);
}

function imageApiResponse(result = "imagem-base64") {
  return response("openai-image", [
    {
      type: "image_generation_call",
      id: "image-1",
      status: "completed",
      result,
    } as unknown as OpenAI.Responses.ResponseOutputItem,
  ]);
}

beforeEach(() => {
  memoryMocks.execute.mockReset();
  memoryMocks.execute.mockImplementation(async (call: FunctionCall) => ({
    type: "function_call_output",
    call_id: call.call_id,
    output: JSON.stringify({ ok: true, name: call.name }),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalXaiKey === undefined) delete process.env.XAI_API_KEY;
  else process.env.XAI_API_KEY = originalXaiKey;
  if (originalGrokKey === undefined) delete process.env.GROK_API_KEY;
  else process.env.GROK_API_KEY = originalGrokKey;
  if (originalOpenAIKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalOpenAIKey;
});

describe("adaptador xAI Responses", () => {
  it("prioriza XAI_API_KEY e aceita GROK_API_KEY legado", () => {
    process.env.XAI_API_KEY = "synthetic-xai-key";
    process.env.GROK_API_KEY = "synthetic-grok-key";
    const preferred = createXAIClient();
    expect(preferred).not.toBeNull();
    expect(preferred?.baseURL).toBe(XAI_BASE_URL);
    expect((preferred as unknown as { apiKey: string }).apiKey).toBe("synthetic-xai-key");

    delete process.env.XAI_API_KEY;
    const legacy = createXAIClient();
    expect((legacy as unknown as { apiKey: string }).apiKey).toBe("synthetic-grok-key");
  });

  it("fixa grok-4.7/medium e trata responseMode omitido como default", () => {
    const params = buildXAIResponseCreateParams({
      input: [{ role: "user", content: "Pesquise e gere uma imagem" }],
      model: "gpt-5.4-mini",
      codeInterpreterEnabled: true,
      reasoning: { effort: "high" },
    });
    expect(params.model).toBe(GROK_MODEL);
    expect(params.reasoning).toEqual({ effort: "medium" });
    const tools = (params.tools ?? []) as Array<{ type: string; name?: string }>;
    expect(tools.map((tool) => tool.type)).toEqual(
      expect.arrayContaining(["web_search", "code_execution", "function"])
    );
    expect(tools).not.toContainEqual(expect.objectContaining({ type: "image_generation" }));
    expect(tools).toContainEqual(expect.objectContaining({ name: "generate_image" }));
    expect(tools).toContainEqual(expect.objectContaining({ name: "remember_memory" }));
  });

  it("não oferece memória nem imagem fora do modo default", () => {
    const params = buildXAIResponseCreateParams({
      input: [{ role: "user", content: "Documento" }],
      responseMode: "document",
    });
    const tools = (params.tools ?? []) as Array<{ type: string }>;
    const functions = tools.filter((tool) => tool.type === "function");
    expect(functions).toEqual([]);
    expect(params.tools).toContainEqual(expect.objectContaining({ type: "web_search" }));
  });

  it("executa memória em duas chamadas, preserva citação e agrega usage no stream", async () => {
    const first = response("resp-1", [
      functionCall("search_memory", "memory-1", { query: "projeto", topK: 3 }),
    ], { usage: usage(10, 2, 4, 1) });
    const final = response("resp-2", [], { usage: usage(7, 5, 2, 3) });
    const { client, create } = mockClient(
      completedStream(first),
      completedStream(final, [
        { type: "response.output_text.delta", delta: "Resposta final" },
        {
          type: "response.output_text.annotation.added",
          annotation: {
            type: "url_citation",
            title: "Fonte",
            url: "https://fonte.test",
          },
        },
      ])
    );

    const events = await readSse(createXAIEventStream(client, {
      input: [{ role: "user", content: "Recupere o projeto" }],
    }));

    expect(memoryMocks.execute).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][0]).toMatchObject({
      previous_response_id: "resp-1",
      input: [expect.objectContaining({
        type: "function_call_output",
        call_id: "memory-1",
      })],
      stream: true,
    });
    expect(events).toContainEqual(expect.objectContaining({
      type: "response.output_text.annotation.added",
    }));
    const completed = events.filter((event) => event.type === "response.completed");
    expect(completed).toHaveLength(1);
    expect(completed[0]).toMatchObject({
      response: {
        usage: {
          input_tokens: 17,
          output_tokens: 7,
          total_tokens: 24,
          input_tokens_details: { cached_tokens: 6 },
          output_tokens_details: { reasoning_tokens: 4 },
        },
      },
    });
  });

  it("executa a ponte de imagem OpenAI e reemite o resultado no stream", async () => {
    process.env.OPENAI_API_KEY = "synthetic-openai-key";
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify(imageApiResponse()),
      { status: 200, headers: { "Content-Type": "application/json" } }
    ));
    vi.stubGlobal("fetch", fetchMock);
    const first = response("resp-image-1", [
      functionCall("generate_image", "image-call", { prompt: "um quero-quero" }),
    ]);
    const final = response("resp-image-2", []);
    const { client, create } = mockClient(
      completedStream(first),
      completedStream(final, [
        { type: "response.output_text.delta", delta: "Imagem pronta" },
      ])
    );

    const events = await readSse(createXAIEventStream(client, {
      input: [{ role: "user", content: "Gere uma imagem" }],
      imageQuality: "medium",
    }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const imageRequest = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(imageRequest).toMatchObject({
      model: "gpt-6-luna",
      tool_choice: { type: "image_generation" },
      tools: [{ type: "image_generation", model: "gpt-image-2", quality: "medium" }],
    });
    expect(events).toContainEqual(expect.objectContaining({
      type: "response.output_item.done",
      item: expect.objectContaining({
        type: "image_generation_call",
        result: "imagem-base64",
      }),
    }));
    expect(create.mock.calls[1][0]).toMatchObject({
      previous_response_id: "resp-image-1",
      input: [expect.objectContaining({ call_id: "image-call" })],
    });
  });

  it("faz o mesmo loop no nonstream e devolve usage agregado", async () => {
    const first = response("nonstream-1", [
      functionCall("remember_memory", "remember-1", {
        content: "Preferência sintética",
        category: "preferences",
        priority: 3,
      }),
    ], { usage: usage(8, 2, 1, 1) });
    const message = {
      type: "message",
      id: "msg-final",
      role: "assistant",
      status: "completed",
      content: [{
        type: "output_text",
        text: "Memória salva",
        annotations: [{
          type: "url_citation",
          title: "Fonte",
          url: "https://fonte.test/memoria",
          start_index: 0,
          end_index: 7,
        }],
      }],
    } as unknown as OpenAI.Responses.ResponseOutputItem;
    const final = response("nonstream-2", [message], {
      output_text: "Memória salva",
      usage: usage(5, 4, 2, 2),
    });
    const { client, create } = mockClient(first, final);

    const result = await createXAIResponse(client, {
      input: [{ role: "user", content: "Lembre disso" }],
      stream: false,
    });

    expect(result.output_text).toBe("Memória salva");
    expect(result.output).toContain(message);
    expect(result.usage).toMatchObject({
      input_tokens: 13,
      output_tokens: 6,
      total_tokens: 19,
      input_tokens_details: { cached_tokens: 3 },
      output_tokens_details: { reasoning_tokens: 3 },
    });
    expect(create.mock.calls[1][0]).toMatchObject({
      previous_response_id: "nonstream-1",
      input: [expect.objectContaining({ call_id: "remember-1" })],
    });
  });

  it("não executa uma tool que não foi oferecida pelo modo", async () => {
    const illegal = response("illegal", [
      functionCall("remember_memory", "forbidden", {
        content: "não grave",
        category: "other",
        priority: 0,
      }),
    ]);
    const { client } = mockClient(illegal);

    await expect(createXAIResponse(client, {
      input: [{ role: "user", content: "Documento" }],
      responseMode: "document",
      stream: false,
    })).rejects.toThrow("ferramenta não oferecida");
    expect(memoryMocks.execute).not.toHaveBeenCalled();
  });

  it("não executa efeito depois do limite finito de tools", async () => {
    const call1 = response("limit-1", [functionCall("search_memory", "call-1", { query: "1", topK: 1 })]);
    const call2 = response("limit-2", [functionCall("search_memory", "call-2", { query: "2", topK: 1 })]);
    const call3 = response("limit-3", [functionCall("search_memory", "call-3", { query: "3", topK: 1 })]);
    const { client, create } = mockClient(call1, call2, call3);

    await expect(createXAIResponse(client, {
      input: [{ role: "user", content: "Loop" }],
      stream: false,
    })).rejects.toThrow("limite de 2 rodadas");
    expect(create).toHaveBeenCalledTimes(3);
    expect(memoryMocks.execute).toHaveBeenCalledTimes(2);
    expect(memoryMocks.execute).not.toHaveBeenCalledWith(
      expect.objectContaining({ call_id: "call-3" })
    );
  });

  it.each([
    ["sem terminal", (async function* () {})(), "sem evento terminal"],
    [
      "incompleto",
      (async function* () {
        yield {
          type: "response.incomplete",
          sequence_number: 0,
          response: response("incomplete", [], {
            status: "incomplete",
            incomplete_details: { reason: "max_output_tokens" },
          }),
        } as OpenAI.Responses.ResponseStreamEvent;
      })(),
      "max_output_tokens",
    ],
    [
      "falha",
      (async function* () {
        yield {
          type: "response.failed",
          sequence_number: 0,
          response: response("failed", [], {
            status: "failed",
            error: { code: "server_error", message: "upstream indisponível" },
          }),
        } as OpenAI.Responses.ResponseStreamEvent;
      })(),
      "upstream indisponível",
    ],
  ])("propaga stream %s como falha", async (_label, providerStream, message) => {
    const { client } = mockClient(providerStream);
    await expect(readSse(createXAIEventStream(client, {
      input: [{ role: "user", content: "Teste" }],
    }))).rejects.toThrow(message);
  });

  it("aborta o upstream quando o reader é cancelado", async () => {
    let providerSignal: AbortSignal | undefined;
    const create = vi.fn().mockImplementation(async (
      _params: unknown,
      options: { signal?: AbortSignal }
    ) => {
      providerSignal = options.signal;
      return (async function* () {
        await new Promise<void>((_resolve, reject) => {
          options.signal?.addEventListener("abort", () => {
            const error = new Error("abortado");
            error.name = "AbortError";
            reject(error);
          }, { once: true });
        });
      })();
    });
    const client = { responses: { create } } as unknown as OpenAI;
    const reader = createXAIEventStream(client, {
      input: [{ role: "user", content: "Cancelar" }],
    }).getReader();

    await reader.cancel("cliente desconectou");

    expect(providerSignal?.aborted).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("fecha o leitor quando o AbortSignal externo cancela durante imagem", async () => {
    process.env.OPENAI_API_KEY = "synthetic-openai-key";
    let imageStarted!: () => void;
    const imageStartedPromise = new Promise<void>((resolve) => {
      imageStarted = resolve;
    });
    const fetchMock = vi.fn().mockImplementation(
      async (_url: unknown, init?: { signal?: AbortSignal }) => {
        imageStarted();
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("imagem abortada");
            error.name = "AbortError";
            reject(error);
          }, { once: true });
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);
    const first = response("abort-image", [
      functionCall("generate_image", "abort-call", { prompt: "imagem" }),
    ]);
    const { client, create } = mockClient(completedStream(first));
    const abort = new AbortController();
    const reader = createXAIEventStream(client, {
      input: [{ role: "user", content: "Imagem" }],
    }, abort.signal).getReader();

    const pendingRead = reader.read();
    await imageStartedPromise;
    abort.abort();
    await expect(pendingRead).resolves.toMatchObject({ done: false });
    await expect(reader.read()).resolves.toEqual({ done: true, value: undefined });
    expect(create).toHaveBeenCalledTimes(1);
  });
});
