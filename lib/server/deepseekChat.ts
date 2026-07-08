import OpenAI from "openai";
import type { ChatRequestBody } from "@/lib/server/chatRequest";
import type { AssistantStreamEvent } from "@/lib/chat/streamMachine";
import { extractResponseOutput } from "@/lib/chat/responseToMessagePatch";

export const DEEPSEEK_MODEL = "deepseek-v4-pro";
export const FRESH_WEB_CONTEXT_TOOL_NAME = "fresh_web_context";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEFAULT_WEB_CONTEXT_MODEL = "gpt-5.4-mini";

type TextPart = { type: "input_text"; text: string };
type ImagePart = { type: "input_image"; image_url: string };
type InputMessage =
  | { role: string; content: string }
  | { role: string; content: Array<TextPart | ImagePart> };

type DeepSeekChatCompletionParams =
  Omit<
    OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
    "reasoning_effort"
  > & {
    extra_body: { thinking: { type: "enabled" } };
    reasoning_effort: "max";
  };

export type DeepSeekToolCall = {
  index: number;
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type DeepSeekAssistantTurn = {
  content: string;
  reasoningContent: string;
  toolCalls: DeepSeekToolCall[];
};

type DeepSeekChunkLike = {
  choices?: Array<{
    delta?: {
      content?: string | null;
      reasoning_content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: "function";
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  } | null;
};

function toDeepSeekRole(role: string): "user" | "assistant" | "system" {
  if (role === "assistant" || role === "system") return role;
  return "user";
}

function stringifyContent(content: InputMessage["content"]): string {
  if (typeof content === "string") return content;

  return content
    .map((part) => {
      if (part.type === "input_image") {
        throw new Error(
          "DeepSeek V4 Pro ainda esta habilitado apenas para texto neste chat."
        );
      }

      return part.text;
    })
    .filter(Boolean)
    .join("\n\n");
}

export function createDeepSeekClient(): OpenAI | null {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({ apiKey, baseURL: DEEPSEEK_BASE_URL });
}

function createOpenAIWebContextClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

function buildFreshWebContextTool(): OpenAI.Chat.Completions.ChatCompletionTool {
  return {
    type: "function",
    function: {
      name: FRESH_WEB_CONTEXT_TOOL_NAME,
      description:
        "Busca contexto web fresco usando o harness OpenAI do servidor. Use quando precisar de fatos atuais, links, versoes, precos, noticias, documentacao recente ou validacao externa.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          query: {
            type: "string",
            description:
              "Consulta objetiva para buscar na web. Inclua entidades, datas e contexto relevante.",
          },
          reason: {
            type: "string",
            description:
              "Motivo curto pelo qual a resposta precisa de contexto atualizado.",
          },
        },
        required: ["query"],
      },
    },
  };
}

export function buildDeepSeekChatCompletionParams({
  input,
  instructions,
  maxOutputTokens,
}: Pick<
  ChatRequestBody,
  "input" | "instructions" | "maxOutputTokens" | "stream"
>): DeepSeekChatCompletionParams {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

  if (instructions?.trim()) {
    messages.push({ role: "system", content: instructions });
  }

  for (const item of (input ?? []) as InputMessage[]) {
    const content = stringifyContent(item.content).trim();
    if (!content) continue;
    messages.push({
      role: toDeepSeekRole(item.role),
      content,
    });
  }

  return {
    model: DEEPSEEK_MODEL,
    messages,
    max_tokens: Math.max(Math.round(maxOutputTokens ?? 4096), 1),
    reasoning_effort: "max",
    stream: true,
    stream_options: { include_usage: true },
    tools: [buildFreshWebContextTool()],
    tool_choice: "auto",
    parallel_tool_calls: false,
    extra_body: { thinking: { type: "enabled" } },
  } as DeepSeekChatCompletionParams;
}

export function deepSeekChunkToAssistantStreamEvent(
  chunk: DeepSeekChunkLike
): AssistantStreamEvent | null {
  const delta = chunk.choices?.[0]?.delta;
  const reasoningDelta = delta?.reasoning_content;
  if (reasoningDelta) {
    return { type: "response.reasoning_text.delta", delta: reasoningDelta };
  }

  if (delta?.content) {
    return { type: "response.output_text.delta", delta: delta.content };
  }

  if (chunk.usage) {
    return {
      type: "response.completed",
      response: {
        usage: {
          input_tokens: chunk.usage.prompt_tokens,
          output_tokens: chunk.usage.completion_tokens,
        },
      },
    };
  }

  return null;
}

export function createInitialDeepSeekAssistantTurn(): DeepSeekAssistantTurn {
  return {
    content: "",
    reasoningContent: "",
    toolCalls: [],
  };
}

function getToolCallByIndex(
  turn: DeepSeekAssistantTurn,
  index: number
): DeepSeekToolCall {
  let toolCall = turn.toolCalls.find((call) => call.index === index);
  if (!toolCall) {
    toolCall = {
      index,
      id: "",
      type: "function",
      function: { name: "", arguments: "" },
    };
    turn.toolCalls.push(toolCall);
  }

  return toolCall;
}

export function accumulateDeepSeekAssistantTurn(
  turn: DeepSeekAssistantTurn,
  chunk: DeepSeekChunkLike
): DeepSeekAssistantTurn {
  const delta = chunk.choices?.[0]?.delta;
  if (!delta) return turn;

  if (delta.reasoning_content) {
    turn.reasoningContent += delta.reasoning_content;
  }

  if (delta.content) {
    turn.content += delta.content;
  }

  for (const toolCallDelta of delta.tool_calls ?? []) {
    const toolCall = getToolCallByIndex(turn, toolCallDelta.index);
    if (toolCallDelta.id) toolCall.id = toolCallDelta.id;
    if (toolCallDelta.type) toolCall.type = toolCallDelta.type;
    if (toolCallDelta.function?.name) {
      toolCall.function.name = toolCallDelta.function.name;
    }
    if (toolCallDelta.function?.arguments) {
      toolCall.function.arguments += toolCallDelta.function.arguments;
    }
  }

  return turn;
}

export function buildDeepSeekToolContinuationMessages(
  baseMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  assistantTurn: DeepSeekAssistantTurn,
  toolOutputs: Array<{ toolCallId: string; content: string }>
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const assistantMessage = {
    role: "assistant",
    content: assistantTurn.content,
    ...(assistantTurn.reasoningContent
      ? { reasoning_content: assistantTurn.reasoningContent }
      : {}),
    tool_calls: assistantTurn.toolCalls.map((call) => ({
      id: call.id,
      type: call.type,
      function: {
        name: call.function.name,
        arguments: call.function.arguments,
      },
    })),
  };

  return [
    ...baseMessages,
    assistantMessage as OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam,
    ...toolOutputs.map(
      (output): OpenAI.Chat.Completions.ChatCompletionToolMessageParam => ({
        role: "tool",
        tool_call_id: output.toolCallId,
        content: output.content,
      })
    ),
  ];
}

export function buildOpenAIWebContextParams(
  query: string,
  { model = process.env.DEEPSEEK_WEB_CONTEXT_MODEL?.trim() || DEFAULT_WEB_CONTEXT_MODEL } = {}
): OpenAI.Responses.ResponseCreateParamsNonStreaming {
  return {
    model,
    instructions:
      "Pesquise na web e devolva contexto factual compacto para outro modelo responder ao usuario. Inclua pontos relevantes, datas, nomes proprios e fontes. Nao escreva a resposta final ao usuario; entregue apenas material de contexto.",
    input: query,
    max_output_tokens: 3000,
    reasoning: { effort: "low" },
    text: { verbosity: "high" },
    tools: [
      {
        type: "web_search_preview",
        search_context_size: "medium",
        user_location: { type: "approximate", country: "BR" },
      },
    ],
  } as OpenAI.Responses.ResponseCreateParamsNonStreaming;
}

function parseFreshWebContextQuery(toolCall: DeepSeekToolCall): string {
  try {
    const parsed = JSON.parse(toolCall.function.arguments) as {
      query?: unknown;
      reason?: unknown;
    };
    const query = typeof parsed.query === "string" ? parsed.query.trim() : "";
    const reason = typeof parsed.reason === "string" ? parsed.reason.trim() : "";
    return [query, reason && `Motivo: ${reason}`].filter(Boolean).join("\n");
  } catch {
    return toolCall.function.arguments.trim();
  }
}

function formatWebContextResponse(response: OpenAI.Responses.Response): string {
  const output = extractResponseOutput(response);
  const sourceLines = (output.citations ?? [])
    .slice(0, 8)
    .map((citation, index) => `${index + 1}. ${citation.title || citation.url} - ${citation.url}`);

  return [
    "Contexto web fresco obtido pelo harness OpenAI:",
    output.content || "Sem texto retornado pela busca.",
    sourceLines.length > 0 ? `Fontes:\n${sourceLines.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 12000);
}

async function executeFreshWebContextTool(
  toolCall: DeepSeekToolCall,
  signal: AbortSignal
): Promise<{ toolCallId: string; content: string }> {
  if (toolCall.function.name !== FRESH_WEB_CONTEXT_TOOL_NAME) {
    return {
      toolCallId: toolCall.id,
      content: `Ferramenta desconhecida: ${toolCall.function.name}`,
    };
  }

  const openai = createOpenAIWebContextClient();
  if (!openai) {
    throw new Error("OPENAI_API_KEY nao configurada para fresh_web_context.");
  }

  const response = await openai.responses.create(
    buildOpenAIWebContextParams(parseFreshWebContextQuery(toolCall)),
    { signal }
  );

  return {
    toolCallId: toolCall.id,
    content: formatWebContextResponse(response),
  };
}

function encodeSsePayload(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function enqueueSsePayload(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  payload: unknown
) {
  controller.enqueue(encoder.encode(encodeSsePayload(payload)));
}

async function streamDeepSeekTurn(
  client: OpenAI,
  params: DeepSeekChatCompletionParams,
  signal: AbortSignal,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder
): Promise<DeepSeekAssistantTurn> {
  const assistantTurn = createInitialDeepSeekAssistantTurn();
  const stream = (await client.chat.completions.create(
    params as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
    { signal }
  )) as unknown as AsyncIterable<DeepSeekChunkLike> & {
    controller?: { abort: () => void };
  };

  try {
    for await (const chunk of stream) {
      if (signal.aborted) break;
      accumulateDeepSeekAssistantTurn(assistantTurn, chunk);
      const event = deepSeekChunkToAssistantStreamEvent(chunk);
      if (!event) continue;
      enqueueSsePayload(controller, encoder, event);
    }
  } finally {
    if (signal.aborted) stream.controller?.abort();
  }

  return assistantTurn;
}

export async function createDeepSeekEventStream(
  client: OpenAI,
  body: ChatRequestBody,
  signal: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();
  const params = buildDeepSeekChatCompletionParams({
    input: body.input,
    instructions: body.instructions,
    maxOutputTokens: body.maxOutputTokens,
    stream: true,
  });

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const firstTurn = await streamDeepSeekTurn(
          client,
          params,
          signal,
          controller,
          encoder
        );

        if (firstTurn.toolCalls.length > 0 && !signal.aborted) {
          enqueueSsePayload(controller, encoder, {
            type: "response.output_item.added",
            item: { type: "web_search_call" },
          });
          const toolOutputs = [];
          for (const toolCall of firstTurn.toolCalls) {
            toolOutputs.push(await executeFreshWebContextTool(toolCall, signal));
          }
          enqueueSsePayload(controller, encoder, {
            type: "response.output_item.done",
            item: { type: "web_search_call" },
          });

          await streamDeepSeekTurn(
            client,
            {
              ...params,
              messages: buildDeepSeekToolContinuationMessages(
                params.messages,
                firstTurn,
                toolOutputs
              ),
              tools: undefined,
              tool_choice: "none",
            } as DeepSeekChatCompletionParams,
            signal,
            controller,
            encoder
          );
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}
