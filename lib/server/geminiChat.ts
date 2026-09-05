import { GoogleGenAI } from "@google/genai";
import type { ChatRequestBody } from "@/lib/server/chatRequest";
import type { AssistantStreamEvent } from "@/lib/chat/streamMachine";

export const GEMINI_MODEL = "gemini-3.8-flash";
const GEMINI_MAX_OUTPUT_TOKENS = 65_536;

type GeminiThinkingLevel = "low" | "medium" | "high";

type OpenAIInputPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string };

type OpenAIInputMessage = {
  role: string;
  content: string | OpenAIInputPart[];
};

type GeminiContent =
  | { type: "text"; text: string }
  | { type: "image"; data?: string; uri?: string; mime_type?: string };

type GeminiInputStep = {
  type: "user_input" | "model_output";
  content: GeminiContent[];
};

export type GeminiInteractionParams = {
  model: typeof GEMINI_MODEL;
  input: GeminiInputStep[];
  system_instruction?: string;
  tools: Array<{ type: "google_search" } | { type: "url_context" }>;
  stream: true;
  store: false;
  generation_config: {
    max_output_tokens: number;
    thinking_level: GeminiThinkingLevel;
    thinking_summaries: "auto";
  };
};

type GeminiUrlCitation = {
  type: "url_citation";
  title?: string;
  url?: string;
};

type GeminiInteractionEvent = {
  event_type: string;
  index?: number;
  step?: { type?: string; [key: string]: unknown };
  delta?: {
    type?: string;
    text?: string;
    content?: { type?: string; text?: string };
    annotations?: GeminiUrlCitation[];
    [key: string]: unknown;
  };
  interaction?: {
    id?: string;
    status?: string;
    usage?: {
      total_input_tokens?: number;
      total_output_tokens?: number;
      total_cached_tokens?: number;
      total_thought_tokens?: number;
    };
  };
  error?: { message?: string };
};

type GeminiSdkStream = AsyncIterable<GeminiInteractionEvent> & {
  cancel: (reason?: unknown) => Promise<void>;
};

function parseImageInput(imageUrl: string): GeminiContent | null {
  const dataUrlMatch = imageUrl.match(
    /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/
  );
  if (dataUrlMatch) {
    return {
      type: "image",
      mime_type: dataUrlMatch[1],
      data: dataUrlMatch[2],
    };
  }

  if (/^https?:\/\//i.test(imageUrl)) {
    return { type: "image", uri: imageUrl };
  }

  return null;
}

function toGeminiInputStep(
  message: OpenAIInputMessage
): GeminiInputStep | null {
  const type = message.role === "assistant" ? "model_output" : "user_input";
  if (typeof message.content === "string") {
    const content = message.content.trim();
    return content
      ? { type, content: [{ type: "text", text: content }] }
      : null;
  }

  const content = message.content.flatMap((part): GeminiContent[] => {
    if (part.type === "input_text") {
      return part.text ? [{ type: "text", text: part.text }] : [];
    }

    const image = parseImageInput(part.image_url);
    return image ? [image] : [];
  });

  return content.length > 0 ? { type, content } : null;
}

function resolveGeminiThinkingLevel(
  body: Pick<ChatRequestBody, "reasoning">
): GeminiThinkingLevel {
  const effort = body.reasoning?.effort;
  if (
    effort === "low" ||
    effort === "medium" ||
    effort === "high"
  ) {
    return effort;
  }

  return "medium";
}

export function buildGeminiInteractionParams(
  body: ChatRequestBody
): GeminiInteractionParams {
  const input = ((body.input ?? []) as OpenAIInputMessage[])
    .map(toGeminiInputStep)
    .filter((step): step is GeminiInputStep => step !== null);
  const requestedMaxTokens = body.maxOutputTokens ?? GEMINI_MAX_OUTPUT_TOKENS;

  return {
    model: GEMINI_MODEL,
    input,
    ...(body.instructions?.trim() && {
      system_instruction: body.instructions.trim(),
    }),
    tools: [{ type: "google_search" }, { type: "url_context" }],
    stream: true,
    store: false,
    generation_config: {
      max_output_tokens: Math.min(
        Math.max(Math.round(requestedMaxTokens), 1),
        GEMINI_MAX_OUTPUT_TOKENS
      ),
      thinking_level: resolveGeminiThinkingLevel(body),
      thinking_summaries: "auto",
    },
  };
}

function isGeminiWebToolStep(stepType: string | undefined): boolean {
  return (
    stepType === "google_search_call" ||
    stepType === "google_search_result" ||
    stepType === "url_context_call" ||
    stepType === "url_context_result"
  );
}

export function geminiEventToAssistantStreamEvents(
  event: GeminiInteractionEvent,
  activeStepTypes: Map<number, string>
): AssistantStreamEvent[] {
  if (
    event.event_type === "step.start" &&
    typeof event.index === "number" &&
    typeof event.step?.type === "string"
  ) {
    const stepType = event.step.type;
    activeStepTypes.set(event.index, stepType);
    if (isGeminiWebToolStep(stepType)) {
      return [
        {
          type: "response.output_item.added",
          item: { type: "web_search_call" },
        },
      ];
    }
    return [];
  }

  if (event.event_type === "step.stop" && typeof event.index === "number") {
    const stepType = activeStepTypes.get(event.index);
    activeStepTypes.delete(event.index);
    if (isGeminiWebToolStep(stepType)) {
      return [
        {
          type: "response.output_item.done",
          item: { type: "web_search_call" },
        },
      ];
    }
    return [];
  }

  if (event.event_type === "step.delta" && event.delta) {
    if (event.delta.type === "text") {
      return [
        {
          type: "response.output_text.delta",
          delta: event.delta.text,
        },
      ];
    }

    if (
      event.delta.type === "thought_summary" &&
      event.delta.content?.type === "text" &&
      event.delta.content.text
    ) {
      return [
        {
          type: "response.reasoning_summary_text.delta",
          delta: event.delta.content.text,
        },
      ];
    }

    if (event.delta.type === "text_annotation_delta") {
      return (event.delta.annotations ?? [])
        .filter(
          (annotation): annotation is GeminiUrlCitation & { url: string } =>
            annotation.type === "url_citation" &&
            typeof annotation.url === "string" &&
            annotation.url.length > 0
        )
        .map((annotation) => ({
          type: "response.output_text.annotation.added" as const,
          annotation: {
            type: "url_citation",
            title: annotation.title ?? "",
            url: annotation.url,
          },
        }));
    }

    return [];
  }

  if (event.event_type === "interaction.completed") {
    const usage = event.interaction?.usage;
    return [
      {
        type: "response.completed",
        response: {
          usage: {
            input_tokens: usage?.total_input_tokens,
            output_tokens: usage?.total_output_tokens,
            input_tokens_details: {
              cached_tokens: usage?.total_cached_tokens,
            },
            output_tokens_details: {
              reasoning_tokens: usage?.total_thought_tokens,
            },
          },
        },
      },
    ];
  }

  return [];
}

export function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

function encodeSsePayload(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

export async function createGeminiEventStream(
  client: GoogleGenAI,
  body: ChatRequestBody,
  signal: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
  const params = buildGeminiInteractionParams(body);
  const createInteraction = client.interactions.create.bind(
    client.interactions
  ) as unknown as (
    interactionParams: GeminiInteractionParams,
    options: { fetchOptions: { signal: AbortSignal } }
  ) => Promise<GeminiSdkStream>;
  const sdkStream = await createInteraction(params, {
    fetchOptions: { signal },
  });

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const activeStepTypes = new Map<number, string>();
      try {
        for await (const event of sdkStream) {
          if (signal.aborted) break;
          if (event.event_type === "error") {
            throw new Error(
              event.error?.message || "A API Gemini interrompeu a resposta."
            );
          }

          for (const translatedEvent of geminiEventToAssistantStreamEvents(
            event,
            activeStepTypes
          )) {
            controller.enqueue(encodeSsePayload(translatedEvent));
          }
        }

        if (!signal.aborted) {
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller.close();
        }
      } catch (error) {
        controller.error(error);
      }
    },
    cancel() {
      if (!signal.aborted) {
        void sdkStream.cancel().catch(() => undefined);
      }
    },
  });
}
