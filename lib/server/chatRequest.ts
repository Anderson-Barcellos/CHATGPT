import OpenAI from "openai";
import type { ResponseMode, ResponseVerbosity } from "@/types";
import {
  MODELS,
  isReasoningModel,
  modelSupportsCodeInterpreter,
  modelSupportsTemperature,
  modelSupportsVerbosity,
} from "@/lib/models/modelConfig";
import {
  QUIZ_FORCED_MODEL,
  QUIZ_FORCED_REASONING_EFFORT,
  quizResponseSchema,
} from "@/lib/artifacts/quizArtifacts";

export type ChatRequestBody = {
  input?: OpenAI.Responses.ResponseInput;
  model?: string;
  instructions?: string;
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  verbosity?: ResponseVerbosity;
  stream?: boolean;
  reasoning?: OpenAI.Responses.ResponseCreateParams["reasoning"];
  codeInterpreterEnabled?: boolean;
  responseMode?: ResponseMode;
  imageQuality?: "low" | "medium" | "high" | "auto";
  imageSize?: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
};

export const ALLOWED_CHAT_MODELS = new Set(
  Object.keys(MODELS).filter((id) => {
    const model = MODELS[id];
    return model.capabilities.includes("chat") || model.capabilities.includes("reasoning");
  })
);

export const DEFAULT_CHAT_MODEL = "gpt-5.4-mini";
const DEFAULT_IMAGE_GENERATION_MODEL = "gpt-image-2";
const LEGACY_MODEL_FALLBACKS: Record<string, string> = {
  "gpt-5.1-chat-latest": DEFAULT_CHAT_MODEL,
  "gpt-5.3-chat-latest": DEFAULT_CHAT_MODEL,
  "gpt-5.1": DEFAULT_CHAT_MODEL,
  "gpt-4.1": DEFAULT_CHAT_MODEL,
  o3: DEFAULT_CHAT_MODEL,
};

export function createOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export function resolveRequestedModel(model: string | undefined): string {
  if (!model) return DEFAULT_CHAT_MODEL;
  if (ALLOWED_CHAT_MODELS.has(model)) return model;
  return LEGACY_MODEL_FALLBACKS[model] ?? model;
}

function supportsImageGenerationTool(responseMode: ResponseMode): boolean {
  return responseMode === "default";
}

function buildTools(
  model: string,
  codeInterpreterEnabled: boolean,
  responseMode: ResponseMode,
  imageQuality: ChatRequestBody["imageQuality"],
  imageSize: ChatRequestBody["imageSize"]
) {
  if (responseMode === "quiz") return [];

  const tools: OpenAI.Responses.Tool[] = [];

  if (supportsImageGenerationTool(responseMode)) {
    tools.push({
      type: "image_generation",
      model: DEFAULT_IMAGE_GENERATION_MODEL,
      quality: imageQuality ?? "high",
      size: imageSize ?? "auto",
      background: "auto",
      partial_images: 2,
      output_format: "png",
    });
  }

  tools.push({
    type: "web_search_preview",
    search_context_size: "medium",
    user_location: { type: "approximate", country: "BR" },
  });

  if (codeInterpreterEnabled && modelSupportsCodeInterpreter(model)) {
    tools.push({
      type: "code_interpreter",
      container: { type: "auto" },
    });
  }

  return tools;
}

export function buildResponseCreateParams(body: ChatRequestBody) {
  const {
    input,
    model = DEFAULT_CHAT_MODEL,
    instructions,
    maxOutputTokens,
    temperature,
    topP,
    verbosity,
    reasoning,
    codeInterpreterEnabled = false,
    responseMode = "default",
    imageQuality,
    imageSize,
  } = body;

  const effectiveModel =
    responseMode === "quiz" ? QUIZ_FORCED_MODEL : resolveRequestedModel(model);
  const modelMaxOutput = MODELS[effectiveModel]?.maxOutput;
  const effectiveMaxTokens = maxOutputTokens ?? modelMaxOutput ?? 4096;
  const clampedMaxTokens = modelMaxOutput
    ? Math.min(Math.max(Math.round(effectiveMaxTokens), 1), modelMaxOutput)
    : Math.max(Math.round(effectiveMaxTokens), 1);

  const requestParams: Omit<
    OpenAI.Responses.ResponseCreateParamsStreaming,
    "stream"
  > = {
    model: effectiveModel,
    instructions,
    input: input!,
    max_output_tokens: clampedMaxTokens,
    tools: buildTools(
      effectiveModel,
      codeInterpreterEnabled,
      responseMode,
      imageQuality,
      imageSize
    ),
  };

  if (modelSupportsTemperature(effectiveModel)) {
    if (temperature !== undefined) requestParams.temperature = temperature;
    if (topP !== undefined) requestParams.top_p = topP;
  }

  if (isReasoningModel(effectiveModel) && reasoning) {
    requestParams.reasoning =
      responseMode === "quiz"
        ? {
            ...reasoning,
            effort: QUIZ_FORCED_REASONING_EFFORT,
          }
        : reasoning;
  }

  if (responseMode === "quiz") {
    requestParams.text = {
      ...requestParams.text,
      format: quizResponseSchema,
    };
  }

  if (responseMode !== "quiz" && modelSupportsVerbosity(effectiveModel) && verbosity) {
    requestParams.text = {
      ...requestParams.text,
      verbosity,
    };
  }

  return requestParams;
}
