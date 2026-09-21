import OpenAI from "openai";
import type { ChatRequestBody } from "@/lib/server/chatRequest";
import {
  MEMORY_TOOL_NAMES,
  buildResponseCreateParams,
} from "@/lib/server/chatRequest";

export const GROK_MODEL = "grok-4.7";
export const XAI_BASE_URL = "https://api.x.ai/v1";

const MAX_XAI_TOOL_ROUNDS = 2;
const IMAGE_BRIDGE_TOOL_NAME = "generate_image";

type ResponseCreateBaseParams = Omit<
  OpenAI.Responses.ResponseCreateParamsStreaming,
  "stream"
>;

type UsageLike = Partial<OpenAI.Responses.ResponseUsage> & {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
  completion_tokens_details?: { reasoning_tokens?: number };
};

type UsageAccumulator = {
  seen: boolean;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
  totalTokens: number;
};

type ImageOutputItem = OpenAI.Responses.ResponseOutputItem & {
  type: "image_generation_call";
  result: string;
};

type ToolExecutionResult = {
  outputs: OpenAI.Responses.ResponseInputItem.FunctionCallOutput[];
  images: ImageOutputItem[];
};

type EventSink = (event: Record<string, unknown>) => void;

/** O SDK OpenAI fala a superfície Responses compatível da xAI; a chave nunca sai do servidor. */
export function createXAIClient(): OpenAI | null {
  const apiKey = process.env.XAI_API_KEY?.trim() || process.env.GROK_API_KEY?.trim();
  return apiKey ? new OpenAI({ apiKey, baseURL: XAI_BASE_URL }) : null;
}

export function buildXAIResponseCreateParams(body: ChatRequestBody) {
  const responseMode = body.responseMode ?? "default";
  const params = buildResponseCreateParams({
    ...body,
    model: GROK_MODEL,
    responseMode,
  });
  const tools = (params.tools ?? []).flatMap((tool) => {
    if (tool.type === "image_generation") return [];
    if (tool.type === "web_search_preview") return [{ type: "web_search" } as never];
    if (tool.type === "code_interpreter") return [{ type: "code_execution" } as never];
    return [tool];
  });
  const imageBridge = responseMode === "default"
    ? [{
        type: "function",
        name: IMAGE_BRIDGE_TOOL_NAME,
        description: "Gera uma imagem quando o usuário pede explicitamente uma imagem.",
        strict: true,
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            prompt: {
              type: "string",
              description: "Descrição da imagem a gerar.",
            },
          },
          required: ["prompt"],
        },
      }]
    : [];

  return {
    ...params,
    model: GROK_MODEL,
    tools: [...tools, ...imageBridge] as never,
    reasoning: { effort: "medium" as const },
  };
}

/** Executa Grok sem streaming, preservando o mesmo loop finito de tools do streaming. */
export async function createXAIResponse(
  xai: OpenAI,
  body: ChatRequestBody,
  signal?: AbortSignal
): Promise<OpenAI.Responses.Response> {
  const baseParams = buildXAIResponseCreateParams(body) as ResponseCreateBaseParams;
  const allowedFunctions = getAllowedFunctionNames(baseParams);
  const usage = createUsageAccumulator();
  const images: ImageOutputItem[] = [];
  let params = baseParams;

  for (let round = 0; round <= MAX_XAI_TOOL_ROUNDS; round += 1) {
    throwIfAborted(signal);
    const response = await xai.responses.create(params, { signal });
    throwIfAborted(signal);
    assertCompletedResponse(response);
    addUsage(usage, response.usage as UsageLike | null);

    const calls = getFunctionCalls(response);
    if (calls.length === 0) {
      return finalizeResponse(response, usage, images);
    }

    if (round === MAX_XAI_TOOL_ROUNDS) {
      throw new Error(
        `xAI excedeu o limite de ${MAX_XAI_TOOL_ROUNDS} rodadas de ferramentas.`
      );
    }

    const execution = await executeToolCalls(
      calls,
      allowedFunctions,
      body,
      signal
    );
    images.push(...execution.images);
    params = buildFollowUpParams(baseParams, response.id, execution.outputs);
  }

  throw new Error("Loop de ferramentas xAI terminou sem resposta final.");
}

export function createXAIEventStream(
  xai: OpenAI,
  body: ChatRequestBody,
  signal?: AbortSignal
) {
  const encoder = new TextEncoder();
  const upstreamAbort = new AbortController();
  const abortUpstream = () => upstreamAbort.abort(signal?.reason);

  if (signal?.aborted) abortUpstream();
  else signal?.addEventListener("abort", abortUpstream, { once: true });

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const baseParams = buildXAIResponseCreateParams(body) as ResponseCreateBaseParams;
      const allowedFunctions = getAllowedFunctionNames(baseParams);
      const usage = createUsageAccumulator();
      const images: ImageOutputItem[] = [];
      let params = baseParams;

      const sendEvent: EventSink = (event) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      };

      try {
        for (let round = 0; round <= MAX_XAI_TOOL_ROUNDS; round += 1) {
          throwIfAborted(upstreamAbort.signal);
          const stream = await xai.responses.create(
            { ...params, stream: true },
            { signal: upstreamAbort.signal }
          );
          let terminalEvent: OpenAI.Responses.ResponseCompletedEvent | null = null;

          for await (const event of stream) {
            throwIfAborted(upstreamAbort.signal);

            if (event.type === "response.completed") {
              terminalEvent = event;
              continue;
            }

            if (event.type === "response.failed") {
              throw responseFailure(event.response, "falhou");
            }

            if (event.type === "response.incomplete") {
              throw responseFailure(event.response, "terminou incompleta");
            }

            if (event.type === "error") {
              throw new Error(`Stream xAI falhou: ${event.message}`);
            }

            sendEvent(event as unknown as Record<string, unknown>);
          }

          throwIfAborted(upstreamAbort.signal);
          if (!terminalEvent) {
            throw new Error("Stream xAI terminou sem evento terminal.");
          }

          const response = terminalEvent.response;
          assertCompletedResponse(response);
          addUsage(usage, response.usage as UsageLike | null);
          const calls = getFunctionCalls(response);

          if (calls.length === 0) {
            sendEvent({
              ...terminalEvent,
              response: finalizeResponse(response, usage, images),
            });
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }

          if (round === MAX_XAI_TOOL_ROUNDS) {
            throw new Error(
              `xAI excedeu o limite de ${MAX_XAI_TOOL_ROUNDS} rodadas de ferramentas.`
            );
          }

          const execution = await executeToolCalls(
            calls,
            allowedFunctions,
            body,
            upstreamAbort.signal,
            sendEvent
          );
          images.push(...execution.images);
          params = buildFollowUpParams(baseParams, response.id, execution.outputs);
        }
      } catch (error) {
        if (upstreamAbort.signal.aborted || isAbortError(error)) {
          closeStream(controller);
          return;
        }
        controller.error(error);
      } finally {
        signal?.removeEventListener("abort", abortUpstream);
      }
    },
    cancel(reason) {
      upstreamAbort.abort(reason);
      signal?.removeEventListener("abort", abortUpstream);
    },
  });
}

function buildFollowUpParams(
  baseParams: ResponseCreateBaseParams,
  previousResponseId: string,
  outputs: OpenAI.Responses.ResponseInputItem.FunctionCallOutput[]
): ResponseCreateBaseParams {
  return {
    ...baseParams,
    input: outputs,
    previous_response_id: previousResponseId,
  };
}

function getAllowedFunctionNames(params: ResponseCreateBaseParams): Set<string> {
  return new Set(
    (params.tools ?? []).flatMap((tool) =>
      tool.type === "function" && typeof tool.name === "string" ? [tool.name] : []
    )
  );
}

function getFunctionCalls(
  response: OpenAI.Responses.Response
): OpenAI.Responses.ResponseFunctionToolCall[] {
  return response.output.filter(
    (item): item is OpenAI.Responses.ResponseFunctionToolCall =>
      item.type === "function_call"
  );
}

async function executeToolCalls(
  calls: OpenAI.Responses.ResponseFunctionToolCall[],
  allowedFunctions: ReadonlySet<string>,
  body: ChatRequestBody,
  signal?: AbortSignal,
  sendEvent?: EventSink
): Promise<ToolExecutionResult> {
  const unexpected = calls.find((call) => !allowedFunctions.has(call.name));
  if (unexpected) {
    throw new Error(
      `xAI solicitou uma ferramenta não oferecida: ${unexpected.name}.`
    );
  }

  const outputs: OpenAI.Responses.ResponseInputItem.FunctionCallOutput[] = [];
  const images: ImageOutputItem[] = [];
  let memoryExecutor:
    | typeof import("@/lib/server/memory/toolExecutor")
    | undefined;

  for (const call of calls) {
    throwIfAborted(signal);

    if (
      call.name === MEMORY_TOOL_NAMES.remember ||
      call.name === MEMORY_TOOL_NAMES.search
    ) {
      memoryExecutor ??= await import("@/lib/server/memory/toolExecutor");
      outputs.push(await memoryExecutor.executeMemoryToolCall(call));
      throwIfAborted(signal);
      continue;
    }

    if (call.name === IMAGE_BRIDGE_TOOL_NAME) {
      const image = await executeImageToolCall(call, body, signal, sendEvent);
      outputs.push(image.output);
      if (image.image) images.push(image.image);
      continue;
    }

    // Toda function declarada pelo adaptador precisa ter executor local explícito.
    throw new Error(`Ferramenta xAI sem executor local: ${call.name}.`);
  }

  return { outputs, images };
}

async function executeImageToolCall(
  call: OpenAI.Responses.ResponseFunctionToolCall,
  body: ChatRequestBody,
  signal?: AbortSignal,
  sendEvent?: EventSink
): Promise<{
  output: OpenAI.Responses.ResponseInputItem.FunctionCallOutput;
  image?: ImageOutputItem;
}> {
  sendEvent?.({
    type: "response.output_item.added",
    item: { type: "image_generation_call" },
  });

  let result: string | undefined;
  let output: Record<string, unknown>;

  try {
    const parsed = JSON.parse(call.arguments) as { prompt?: unknown };
    const prompt = typeof parsed.prompt === "string" ? parsed.prompt.trim() : "";
    if (!prompt) throw new Error("prompt_required");
    throwIfAborted(signal);

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) throw new Error("OPENAI_API_KEY não configurada no servidor.");

    const openai = new OpenAI({ apiKey });
    const imageResponse = await openai.responses.create({
      model: "gpt-5.6-luna",
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
      tools: [{
        type: "image_generation",
        model: "gpt-image-2",
        quality: bodyImageQuality(body),
        size: body.imageSize ?? "auto",
        background: "auto",
        output_format: "png",
      }],
      tool_choice: { type: "image_generation" },
    }, { signal });
    throwIfAborted(signal);

    const imageCall = imageResponse.output.find(
      (item) => item.type === "image_generation_call"
    ) as { result?: string } | undefined;
    result = imageCall?.result;
    if (!result) throw new Error("image_generation_empty");

    output = { ok: true, image_generated: true };
  } catch (error) {
    if (signal?.aborted || isAbortError(error)) throw error;
    output = {
      ok: false,
      error: error instanceof Error ? error.message : "image_generation_failed",
    };
  }

  const image = result
    ? ({
        type: "image_generation_call",
        id: `xai_image_${call.call_id}`,
        status: "completed",
        result,
      } as unknown as ImageOutputItem)
    : undefined;

  sendEvent?.({
    type: "response.output_item.done",
    item: image ?? { type: "image_generation_call" },
  });

  return {
    output: {
      type: "function_call_output",
      call_id: call.call_id,
      output: JSON.stringify(output),
    },
    ...(image ? { image } : {}),
  };
}

function createUsageAccumulator(): UsageAccumulator {
  return {
    seen: false,
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
  };
}

function finiteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function addUsage(total: UsageAccumulator, usage: UsageLike | null | undefined) {
  if (!usage) return;
  const inputTokens = finiteNumber(usage.input_tokens ?? usage.prompt_tokens);
  const outputTokens = finiteNumber(usage.output_tokens ?? usage.completion_tokens);

  total.seen = true;
  total.inputTokens += inputTokens;
  total.outputTokens += outputTokens;
  total.cachedTokens += finiteNumber(
    usage.input_tokens_details?.cached_tokens ??
      usage.prompt_tokens_details?.cached_tokens
  );
  total.cacheWriteTokens += finiteNumber(
    usage.input_tokens_details?.cache_write_tokens
  );
  total.reasoningTokens += finiteNumber(
    usage.output_tokens_details?.reasoning_tokens ??
      usage.completion_tokens_details?.reasoning_tokens
  );
  total.totalTokens += finiteNumber(
    usage.total_tokens ?? inputTokens + outputTokens
  );
}

function finalizedUsage(
  total: UsageAccumulator
): OpenAI.Responses.ResponseUsage | undefined {
  if (!total.seen) return undefined;
  return {
    input_tokens: total.inputTokens,
    output_tokens: total.outputTokens,
    total_tokens: total.totalTokens,
    input_tokens_details: {
      cached_tokens: total.cachedTokens,
      cache_write_tokens: total.cacheWriteTokens,
    },
    output_tokens_details: {
      reasoning_tokens: total.reasoningTokens,
    },
  };
}

function finalizeResponse(
  response: OpenAI.Responses.Response,
  usage: UsageAccumulator,
  images: ImageOutputItem[]
): OpenAI.Responses.Response {
  return {
    ...response,
    output: [...response.output, ...images],
    usage: finalizedUsage(usage),
  };
}

function assertCompletedResponse(response: OpenAI.Responses.Response) {
  if (response.status !== "completed") {
    throw responseFailure(response, `terminou com status ${response.status}`);
  }
}

function responseFailure(
  response: OpenAI.Responses.Response,
  description: string
): Error {
  const reason = response.error?.message || response.incomplete_details?.reason;
  return new Error(
    `Resposta xAI ${description}${reason ? `: ${reason}` : "."}`
  );
}

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return;
  const error = new Error("Operação xAI abortada.");
  error.name = "AbortError";
  throw error;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function closeStream(
  controller: ReadableStreamDefaultController<Uint8Array>
) {
  try {
    controller.close();
  } catch {
    // O consumidor pode já ter cancelado e fechado o ReadableStream.
  }
}

function bodyImageQuality(body: ChatRequestBody): "low" | "medium" | "high" | "auto" {
  return body.imageQuality ?? "high";
}
