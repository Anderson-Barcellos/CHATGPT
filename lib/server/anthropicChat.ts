import Anthropic from "@anthropic-ai/sdk";
import type OpenAI from "openai";
import type { AssistantStreamEvent } from "@/lib/chat/streamMachine";
import {
  buildMemoryTools,
  MEMORY_TOOL_NAMES,
  type ChatRequestBody,
} from "@/lib/server/chatRequest";
import { executeMemoryToolCall } from "@/lib/server/memory/toolExecutor";

export const ANTHROPIC_MODELS = [
  "claude-sonnet-5-5",
  "claude-opus-5-5",
] as const;

export type AnthropicModel = (typeof ANTHROPIC_MODELS)[number];

const MAX_TOOL_ROUNDS = 2;
const REQUEST_TIMEOUT_MS = 180_000;
const DEFAULT_MAX_TOKENS = 8_192;
const MAX_TOKENS = 128_000;

type OpenAIInputPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string };

type OpenAIInputMessage = {
  role: string;
  content: string | OpenAIInputPart[];
};

type ClaudeUsage = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  output_tokens_details?: { thinking_tokens?: number | null } | null;
};

type UsageTotals = {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
};

class AnthropicInputError extends Error {}
class AnthropicStreamError extends Error {}

function asNonEmptyText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AnthropicInputError(`${field} precisa conter texto.`);
  }
  return value;
}

function toClaudeImage(imageUrl: string): Anthropic.Messages.ImageBlockParam {
  const dataUrl = imageUrl.match(
    /^data:(image\/(?:jpeg|png|gif|webp));base64,([A-Za-z0-9+/=]+)$/
  );
  if (dataUrl) {
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: dataUrl[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data: dataUrl[2],
      },
    };
  }

  if (/^https:\/\//i.test(imageUrl)) {
    return {
      type: "image",
      source: { type: "url", url: imageUrl },
    };
  }

  throw new AnthropicInputError(
    "A imagem do Claude precisa ser uma URL HTTPS ou um data URL PNG, JPEG, GIF ou WebP."
  );
}

function toClaudeContent(
  content: OpenAIInputMessage["content"]
): Anthropic.Messages.ContentBlockParam[] {
  if (typeof content === "string") {
    return [{ type: "text", text: asNonEmptyText(content, "A mensagem") }];
  }

  if (!Array.isArray(content) || content.length === 0) {
    throw new AnthropicInputError("A mensagem do Claude não pode ficar vazia.");
  }

  return content.map((part) => {
    if (part?.type === "input_text") {
      return { type: "text", text: asNonEmptyText(part.text, "A mensagem") };
    }
    if (part?.type === "input_image") {
      return toClaudeImage(asNonEmptyText(part.image_url, "A imagem"));
    }
    throw new AnthropicInputError(
      "Este anexo não é compatível com Claude neste chat e não foi descartado."
    );
  });
}

export function buildAnthropicMessages(
  input: ChatRequestBody["input"]
): Anthropic.Messages.MessageParam[] {
  const rawMessages =
    typeof input === "string"
      ? [{ role: "user", content: input }]
      : Array.isArray(input)
        ? (input as OpenAIInputMessage[])
        : null;

  if (!rawMessages || rawMessages.length === 0) {
    throw new AnthropicInputError("Input do Claude precisa conter ao menos uma mensagem.");
  }

  return rawMessages.map((message) => {
    if (message?.role !== "user" && message?.role !== "assistant") {
      throw new AnthropicInputError(
        `O papel ${String(message?.role)} não é compatível com Claude neste chat.`
      );
    }

    return {
      role: message.role,
      content: toClaudeContent(message.content),
    };
  });
}

export function resolveAnthropicEffort(
  body: Pick<ChatRequestBody, "reasoning">
): "low" | "medium" | "high" {
  const effort = body.reasoning?.effort;
  if (effort === "low" || effort === "medium" || effort === "high") {
    return effort;
  }
  if (effort === "xhigh" || effort === "max") return "high";

  return "medium";
}

function resolveMaxTokens(value: number | undefined): number {
  const requested = value ?? DEFAULT_MAX_TOKENS;
  if (!Number.isFinite(requested)) return DEFAULT_MAX_TOKENS;
  return Math.min(Math.max(Math.round(requested), 1), MAX_TOKENS);
}

function buildAnthropicMemoryTools(): Anthropic.Messages.Tool[] {
  return buildMemoryTools().map((tool) => ({
    name: tool.name,
    description: tool.description ?? undefined,
    input_schema: tool.parameters as Anthropic.Messages.Tool.InputSchema,
  }));
}

export function buildAnthropicMessageParams(
  body: ChatRequestBody
): Anthropic.Messages.MessageCreateParamsStreaming {
  const model = body.model as AnthropicModel;
  if (!ANTHROPIC_MODELS.includes(model)) {
    throw new AnthropicInputError("Modelo Claude não suportado.");
  }

  if (body.responseMode && body.responseMode !== "default") {
    throw new AnthropicInputError("Claude está habilitado somente para chat padrão.");
  }

  if (body.stream === false) {
    throw new AnthropicInputError("Claude exige streaming neste chat.");
  }

  if (body.temperature !== undefined && body.temperature !== 1) {
    throw new AnthropicInputError("Claude 5.5 não aceita temperatura personalizada.");
  }

  if (body.topP !== undefined && body.topP < 0.99) {
    throw new AnthropicInputError("Claude 5.5 não aceita topP personalizado.");
  }

  return {
    model,
    stream: true,
    max_tokens: resolveMaxTokens(body.maxOutputTokens),
    messages: buildAnthropicMessages(body.input),
    ...(body.instructions?.trim() ? { system: body.instructions.trim() } : {}),
    output_config: { effort: resolveAnthropicEffort(body) },
    thinking: { type: "adaptive" },
    tools: [
      ...buildAnthropicMemoryTools(),
      {
        type: "web_search_20260318",
        name: "web_search",
        allowed_callers: ["direct"],
        user_location: { type: "approximate", country: "BR" },
      },
      {
        type: "web_fetch_20260318",
        name: "web_fetch",
        allowed_callers: ["direct"],
        citations: { enabled: true },
      },
    ],
  };
}

function cloneContentBlock<T>(block: T): T {
  return JSON.parse(JSON.stringify(block)) as T;
}

function isWebToolBlock(
  block: Record<string, unknown>
): block is Record<string, unknown> & { name: "web_search" | "web_fetch" } {
  return block.name === "web_search" || block.name === "web_fetch";
}

function citationFromDelta(
  delta: unknown,
  fetchedDocumentUrls: ReadonlyMap<number, string>
): { title: string; url: string } | null {
  if (!delta || typeof delta !== "object" || !("citation" in delta)) return null;
  const citation = (delta as { citation?: unknown }).citation;
  if (!citation || typeof citation !== "object") return null;
  const { url, title, document_index: documentIndex, document_title: documentTitle } = citation as {
    url?: unknown;
    title?: unknown;
    document_index?: unknown;
    document_title?: unknown;
  };
  const resolvedUrl =
    typeof url === "string" && url.length > 0
      ? url
      : typeof documentIndex === "number"
        ? fetchedDocumentUrls.get(documentIndex)
        : undefined;
  return resolvedUrl
    ? {
        url: resolvedUrl,
        title:
          typeof title === "string"
            ? title
            : typeof documentTitle === "string"
              ? documentTitle
              : "",
      }
    : null;
}

function applyBlockDelta(block: Record<string, unknown>, delta: Record<string, unknown>) {
  if (delta.type === "text_delta" && typeof delta.text === "string") {
    block.text = `${typeof block.text === "string" ? block.text : ""}${delta.text}`;
  }
  if (delta.type === "thinking_delta" && typeof delta.thinking === "string") {
    block.thinking = `${typeof block.thinking === "string" ? block.thinking : ""}${delta.thinking}`;
  }
  if (delta.type === "signature_delta" && typeof delta.signature === "string") {
    block.signature = `${typeof block.signature === "string" ? block.signature : ""}${delta.signature}`;
  }
  if (delta.type === "input_json_delta" && typeof delta.partial_json === "string") {
    const partialJson = `${typeof block.__partialJson === "string" ? block.__partialJson : ""}${delta.partial_json}`;
    block.__partialJson = partialJson;
    try {
      block.input = JSON.parse(partialJson);
    } catch {
      // O JSON parcial só fica completo no content_block_stop.
    }
  }
  if (delta.type === "citations_delta" && delta.citation !== undefined) {
    const citations = Array.isArray(block.citations) ? block.citations : [];
    block.citations = [...citations, cloneContentBlock(delta.citation)];
  }
}

function registerFetchedDocument(
  block: Record<string, unknown>,
  fetchedDocumentUrls: Map<number, string>,
  nextDocumentIndex: { value: number }
) {
  if (block.type !== "web_fetch_tool_result") return;
  const result = block.content;
  if (!result || typeof result !== "object") return;
  const { url, content, document_index: resultDocumentIndex } = result as {
    url?: unknown;
    content?: unknown;
    document_index?: unknown;
  };
  if (typeof url !== "string" || !url) return;

  const contentDocumentIndex =
    content && typeof content === "object"
      ? (content as { document_index?: unknown }).document_index
      : undefined;
  const documentIndex =
    typeof contentDocumentIndex === "number"
      ? contentDocumentIndex
      : typeof resultDocumentIndex === "number"
        ? resultDocumentIndex
        : nextDocumentIndex.value;

  fetchedDocumentUrls.set(documentIndex, url);
  nextDocumentIndex.value = Math.max(nextDocumentIndex.value, documentIndex + 1);
}

function finalizeBlocks(blocks: Array<Record<string, unknown> | undefined>) {
  return blocks.flatMap((block) => {
    if (!block) return [];
    const { __partialJson, ...completeBlock } = block;
    if (typeof __partialJson === "string" && completeBlock.type === "tool_use") {
      try {
        completeBlock.input = JSON.parse(__partialJson);
      } catch {
        throw new AnthropicStreamError("Claude retornou argumentos de tool incompletos.");
      }
    }
    return [completeBlock] as unknown as Anthropic.Messages.ContentBlockParam[];
  });
}

function addUsage(totals: UsageTotals, usage: ClaudeUsage | undefined) {
  if (!usage) return;
  const input = usage.input_tokens ?? 0;
  const cached = usage.cache_read_input_tokens ?? 0;
  totals.inputTokens += input + cached;
  totals.cachedTokens += cached;
  totals.outputTokens += usage.output_tokens ?? 0;
  totals.reasoningTokens += usage.output_tokens_details?.thinking_tokens ?? 0;
}

function mergeUsage(
  previous: ClaudeUsage | undefined,
  next: ClaudeUsage
): ClaudeUsage {
  return {
    input_tokens: next.input_tokens ?? previous?.input_tokens,
    output_tokens: next.output_tokens ?? previous?.output_tokens,
    cache_read_input_tokens:
      next.cache_read_input_tokens ?? previous?.cache_read_input_tokens,
    output_tokens_details:
      next.output_tokens_details ?? previous?.output_tokens_details,
  };
}

function completedEvent(totals: UsageTotals): AssistantStreamEvent {
  return {
    type: "response.completed",
    response: {
      usage: {
        input_tokens: totals.inputTokens,
        output_tokens: totals.outputTokens,
        input_tokens_details: { cached_tokens: totals.cachedTokens },
        output_tokens_details: { reasoning_tokens: totals.reasoningTokens },
      },
    },
  };
}

function asMemoryToolCall(block: Record<string, unknown>) {
  return {
    type: "function_call",
    id: `anthropic_${String(block.id)}`,
    call_id: String(block.id),
    name: String(block.name),
    arguments: JSON.stringify(block.input ?? {}),
    status: "completed",
  } as unknown as OpenAI.Responses.ResponseFunctionToolCall;
}

async function buildMemoryToolResults(blocks: Anthropic.Messages.ContentBlockParam[]) {
  const calls = blocks.filter(
    (block): block is Anthropic.Messages.ToolUseBlockParam =>
      block.type === "tool_use" &&
      (block.name === MEMORY_TOOL_NAMES.remember || block.name === MEMORY_TOOL_NAMES.search)
  );

  if (calls.length === 0) return null;

  const outputs = await Promise.all(
    calls.map((call) => executeMemoryToolCall(asMemoryToolCall(call as unknown as Record<string, unknown>)))
  );

  return outputs.map((output) => ({
    type: "tool_result" as const,
    tool_use_id: output.call_id,
    content:
      typeof output.output === "string"
        ? output.output
        : JSON.stringify(output.output),
  }));
}

function appendContinuation(
  baseMessages: Anthropic.Messages.MessageParam[],
  assistantContent: Anthropic.Messages.ContentBlockParam[],
  toolResults?: Anthropic.Messages.ToolResultBlockParam[]
): Anthropic.Messages.MessageParam[] {
  const messages: Anthropic.Messages.MessageParam[] = [
    ...baseMessages,
    { role: "assistant", content: assistantContent },
  ];
  if (toolResults && toolResults.length > 0) {
    messages.push({ role: "user", content: toolResults });
  }
  return messages;
}

function encodeSse(payload: AssistantStreamEvent | "[DONE]") {
  return new TextEncoder().encode(
    payload === "[DONE]" ? "data: [DONE]\n\n" : `data: ${JSON.stringify(payload)}\n\n`
  );
}

function createAbortBridge(source: AbortSignal) {
  const controller = new AbortController();
  const abortSource = () => controller.abort(source.reason);
  if (source.aborted) abortSource();
  else source.addEventListener("abort", abortSource, { once: true });
  return { controller, dispose: () => source.removeEventListener("abort", abortSource) };
}

function sanitizeStreamError(error: unknown): AnthropicStreamError {
  if (error instanceof AnthropicStreamError) return error;
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new AnthropicStreamError("A conexão com Claude excedeu o tempo limite.");
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new AnthropicStreamError("Não foi possível conectar ao Claude.");
  }
  if (error instanceof Anthropic.APIError) {
    return new AnthropicStreamError("A API Claude interrompeu a resposta.");
  }
  return new AnthropicStreamError("A resposta do Claude falhou antes de concluir.");
}

export function createAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  return apiKey ? new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS }) : null;
}

export function createAnthropicEventStream(
  client: Anthropic,
  body: ChatRequestBody,
  requestSignal: AbortSignal
): ReadableStream<Uint8Array> {
  const initialParams = buildAnthropicMessageParams(body);
  const bridge = createAbortBridge(requestSignal);

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const totals: UsageTotals = {
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        reasoningTokens: 0,
      };
      let params = initialParams;
      const fetchedDocumentUrls = new Map<number, string>();
      const nextDocumentIndex = { value: 0 };
      const activeWebToolIds = new Set<string>();

      try {
        for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
          const stream = await client.messages.create(params, {
            signal: bridge.controller.signal,
          });
          const blocks: Array<Record<string, unknown> | undefined> = [];
          let stopReason: string | null = null;
          let turnUsage: ClaudeUsage | undefined;

          for await (const event of stream) {
            if (bridge.controller.signal.aborted) break;

            if (event.type === "message_start") {
              turnUsage = event.message.usage;
              continue;
            }

            if (event.type === "content_block_start") {
              const block = cloneContentBlock(event.content_block) as unknown as Record<string, unknown>;
              blocks[event.index] = block;
              registerFetchedDocument(
                block,
                fetchedDocumentUrls,
                nextDocumentIndex
              );
              if (block.type === "server_tool_use" && isWebToolBlock(block)) {
                activeWebToolIds.add(String(block.id));
                controller.enqueue(
                  encodeSse({ type: "response.output_item.added", item: { type: "web_search_call" } })
                );
              }
              if (
                (block.type === "web_search_tool_result" ||
                  block.type === "web_fetch_tool_result") &&
                typeof block.tool_use_id === "string" &&
                activeWebToolIds.delete(block.tool_use_id)
              ) {
                controller.enqueue(
                  encodeSse({ type: "response.output_item.done", item: { type: "web_search_call" } })
                );
              }
              continue;
            }

            if (event.type === "content_block_delta") {
              const block = blocks[event.index];
              if (block) applyBlockDelta(block, event.delta as unknown as Record<string, unknown>);
              if (event.delta.type === "text_delta") {
                controller.enqueue(
                  encodeSse({ type: "response.output_text.delta", delta: event.delta.text })
                );
              } else if (event.delta.type === "thinking_delta") {
                controller.enqueue(
                  encodeSse({ type: "response.reasoning_text.delta", delta: event.delta.thinking })
                );
              } else if (event.delta.type === "citations_delta") {
                const citation = citationFromDelta(event.delta, fetchedDocumentUrls);
                if (citation) {
                  controller.enqueue(
                    encodeSse({
                      type: "response.output_text.annotation.added",
                      annotation: { type: "url_citation", ...citation },
                    })
                  );
                }
              }
              continue;
            }

            if (event.type === "content_block_stop") continue;

            if (event.type === "message_delta") {
              stopReason = event.delta.stop_reason;
              turnUsage = mergeUsage(turnUsage, event.usage);
            }
          }

          if (bridge.controller.signal.aborted) {
            controller.close();
            return;
          }

          addUsage(totals, turnUsage);
          const assistantContent = finalizeBlocks(blocks);

          if (stopReason === "end_turn" || stopReason === "stop_sequence") {
            for (const toolUseId of activeWebToolIds) {
              activeWebToolIds.delete(toolUseId);
              controller.enqueue(
                encodeSse({ type: "response.output_item.done", item: { type: "web_search_call" } })
              );
            }
            controller.enqueue(encodeSse(completedEvent(totals)));
            controller.enqueue(encodeSse("[DONE]"));
            controller.close();
            return;
          }

          if (stopReason === "tool_use") {
            if (round === MAX_TOOL_ROUNDS) {
              throw new AnthropicStreamError("Claude excedeu o limite de continuações de tools.");
            }
            const memoryResults = await buildMemoryToolResults(assistantContent);
            if (!memoryResults) {
              throw new AnthropicStreamError("Claude solicitou uma ferramenta não disponível neste chat.");
            }
            params = {
              ...initialParams,
              messages: appendContinuation(
                params.messages,
                assistantContent,
                memoryResults
              ),
            };
            continue;
          }

          if (stopReason === "pause_turn") {
            if (round === MAX_TOOL_ROUNDS) {
              throw new AnthropicStreamError("Claude excedeu o limite de continuações pausadas.");
            }
            params = {
              ...initialParams,
              messages: appendContinuation(params.messages, assistantContent),
            };
            continue;
          }

          if (stopReason === "max_tokens") {
            throw new AnthropicStreamError("Claude atingiu o limite de tokens antes de concluir a resposta.");
          }
          if (stopReason === "refusal") {
            throw new AnthropicStreamError("Claude recusou esta solicitação.");
          }
          if (stopReason === "model_context_window_exceeded") {
            throw new AnthropicStreamError("Claude excedeu a janela de contexto desta conversa.");
          }
          throw new AnthropicStreamError("Claude interrompeu a resposta sem uma conclusão válida.");
        }
      } catch (error) {
        if (bridge.controller.signal.aborted) {
          try {
            controller.close();
          } catch {
            // A conexão do cliente já pode ter sido encerrada.
          }
          return;
        }
        controller.error(sanitizeStreamError(error));
      } finally {
        bridge.dispose();
      }
    },
    cancel() {
      bridge.controller.abort("client_cancelled");
      bridge.dispose();
    },
  });
}

export function isAnthropicInputError(error: unknown): error is AnthropicInputError {
  return error instanceof AnthropicInputError;
}
