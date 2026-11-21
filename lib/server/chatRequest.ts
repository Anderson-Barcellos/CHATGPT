import OpenAI from "openai";
import type { ResponseMode, ResponseVerbosity } from "@/types";
import {
  MODELS,
  getSupportedReasoningEfforts,
  modelSupportsReasoningMode,
} from "@/lib/models/modelConfig";
import { getChatModel, type ChatModelInfo } from "@/lib/models/chatModelCatalog";
import {
  QUIZ_FORCED_MODEL,
  QUIZ_FORCED_REASONING_EFFORT,
  quizResponseSchema,
} from "@/lib/artifacts/quizArtifacts";
import { buildWebSearchTool } from "@/lib/server/webSearchTool";

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

export const DEFAULT_CHAT_MODEL = "gpt-6-luna";
const DEFAULT_IMAGE_GENERATION_MODEL = "gpt-image-2.6-sunburst";
export const MEMORY_TOOL_NAMES = {
  remember: "remember_memory",
  search: "search_memory",
} as const;

export type MemoryToolName = (typeof MEMORY_TOOL_NAMES)[keyof typeof MEMORY_TOOL_NAMES];

const LEGACY_MODEL_FALLBACKS: Record<string, string> = {
  "gpt-6-sol": "gpt-6.1-sol",
  "gpt-5.6-luna": "gpt-6-luna",
  "gpt-5.6-terra": "gpt-6.1-sol",
  "deepseek-v4-pro": "deepseek-flash",
  "gemini-3.7-flash": "gemini-3.8-flash",
  "gpt-chat-latest": "chat-latest",
  "gpt-5-chat-latest": "chat-latest",
  "gpt-5.1-chat-latest": DEFAULT_CHAT_MODEL,
  "gpt-5.3-chat-latest": DEFAULT_CHAT_MODEL,
  "gpt-5.1": DEFAULT_CHAT_MODEL,
  "gpt-4.1": DEFAULT_CHAT_MODEL,
  o3: DEFAULT_CHAT_MODEL,
  // Conversas, rascunhos e rotinas já persistidos com o mini ou o Grok seguem
  // abrindo; a execução nova vai ao Luna, sem reescrever dados runtime.
  "gpt-5.4-mini": DEFAULT_CHAT_MODEL,
  "grok-4.7": DEFAULT_CHAT_MODEL,
};

export function createOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export function resolveRequestedModel(model: string | undefined): string {
  if (!model) return DEFAULT_CHAT_MODEL;
  if (Object.hasOwn(LEGACY_MODEL_FALLBACKS, model)) return LEGACY_MODEL_FALLBACKS[model];
  return model;
}

function supportsImageGenerationTool(responseMode: ResponseMode): boolean {
  return responseMode === "default";
}

function supportsMemoryTools(responseMode: ResponseMode): boolean {
  return responseMode === "default";
}

export function buildMemoryTools(): OpenAI.Responses.FunctionTool[] {
  return [
    {
      type: "function",
      name: MEMORY_TOOL_NAMES.remember,
      description:
        "Save a durable active memory only when the user explicitly asks you to remember, memorize, or keep a specific fact for future chats.",
      strict: true,
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          content: {
            type: "string",
            description:
              "A concise, standalone memory in Portuguese or the user's language. Include only the fact the user asked to remember.",
          },
          category: {
            type: "string",
            enum: [
              "personal",
              "professional",
              "preferences",
              "projects",
              "technical",
              "other",
            ],
          },
          priority: {
            type: "number",
            description:
              "Importance from 0 to 20. Use higher values only for stable identity, preferences, projects, or recurring work context.",
          },
        },
        required: ["content", "category", "priority"],
      },
    },
    {
      type: "function",
      name: MEMORY_TOOL_NAMES.search,
      description:
        "Search current personal sources when omitted details are needed to answer accurately, and prior conversation chunks when the user asks for history or evidence.",
      strict: true,
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          query: {
            type: "string",
            description:
              "The focused semantic search query for prior conversation memory.",
          },
          topK: {
            type: "integer",
            minimum: 1,
            maximum: 8,
            description: "Maximum number of chunks to retrieve.",
          },
        },
        required: ["query", "topK"],
      },
    },
  ];
}

function buildTools(
  model: ChatModelInfo | undefined,
  codeInterpreterEnabled: boolean,
  responseMode: ResponseMode,
  imageQuality: ChatRequestBody["imageQuality"],
  imageSize: ChatRequestBody["imageSize"],
  stream: boolean
) {
  if (responseMode === "quiz") return [];
  if (model?.supportsResponsesTools === false) {
    return model.provider === "openai" && model.supportsWebSearch
      ? [{ ...buildWebSearchTool(), type: "web_search" } satisfies OpenAI.Responses.WebSearchTool]
      : [];
  }

  const tools: OpenAI.Responses.Tool[] = [];

  if (supportsImageGenerationTool(responseMode)) {
    tools.push({
      type: "image_generation",
      model: DEFAULT_IMAGE_GENERATION_MODEL,
      quality: imageQuality ?? "high",
      size: imageSize ?? "auto",
      background: "auto",
      ...(stream ? { partial_images: 2 } : {}),
      output_format: "png",
    });
  }

  if (supportsMemoryTools(responseMode)) {
    tools.push(...buildMemoryTools());
  }

  tools.push(buildWebSearchTool());

  if (codeInterpreterEnabled && model?.supportsCodeInterpreter) {
    tools.push({
      type: "code_interpreter",
      container: { type: "auto" },
    });
  }

  return tools;
}

export function buildResponseCreateParams(body: ChatRequestBody, registeredModel?: ChatModelInfo) {
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
    stream = true,
  } = body;

  const effectiveModel =
    responseMode === "quiz" ? QUIZ_FORCED_MODEL : resolveRequestedModel(model);
  const modelInfo = registeredModel ?? getChatModel(effectiveModel);
  const modelMaxOutput = modelInfo?.maxOutput;
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
      modelInfo,
      codeInterpreterEnabled,
      responseMode,
      imageQuality,
      imageSize,
      stream
    ),
  };

  if (modelInfo?.supportsTemperature) {
    if (temperature !== undefined) requestParams.temperature = temperature;
    if (topP !== undefined) requestParams.top_p = topP;
  }

  const fixedReasoningEffort = modelInfo?.fixedReasoningEffort;
  if (modelInfo?.capabilities.includes("reasoning") && (reasoning || fixedReasoningEffort)) {
    const { effort, mode, ...supportedReasoning } = reasoning ?? {};
    const sanitizedReasoning = {
      ...(modelInfo.supportsResponsesTools !== false && supportedReasoning),
      ...(fixedReasoningEffort
        ? { effort: fixedReasoningEffort }
        : effort && getSupportedReasoningEfforts(effectiveModel, modelInfo).includes(effort)
        ? { effort }
        : {}),
      ...(mode === "pro" && modelSupportsReasoningMode(effectiveModel, "pro", modelInfo) && {
        mode,
      }),
    };
    requestParams.reasoning = responseMode === "quiz"
      ? { ...sanitizedReasoning, effort: QUIZ_FORCED_REASONING_EFFORT }
      : sanitizedReasoning;
  }

  if (responseMode === "quiz") {
    requestParams.text = {
      ...requestParams.text,
      format: quizResponseSchema,
    };
  }

  const fixedVerbosity = modelInfo?.fixedVerbosity;
  const effectiveVerbosity = fixedVerbosity ?? verbosity;
  if (
    responseMode !== "quiz" &&
    modelInfo?.supportsVerbosity &&
    effectiveVerbosity
  ) {
    requestParams.text = {
      ...requestParams.text,
      verbosity: effectiveVerbosity,
    };
  }

  return requestParams;
}
