import OpenAI from "openai";
import type { ResponseMode, ResponseVerbosity } from "@/types";
import {
  MODELS,
  getFixedReasoningEffort,
  getFixedVerbosity,
  getSupportedReasoningEfforts,
  isReasoningModel,
  modelSupportsCodeInterpreter,
  modelSupportsTemperature,
  modelSupportsVerbosity,
  modelSupportsReasoningMode,
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

export const DEFAULT_CHAT_MODEL = "gpt-5.6-luna";
const DEFAULT_IMAGE_GENERATION_MODEL = "gpt-image-2";
export const MEMORY_TOOL_NAMES = {
  remember: "remember_memory",
  search: "search_memory",
} as const;

export type MemoryToolName = (typeof MEMORY_TOOL_NAMES)[keyof typeof MEMORY_TOOL_NAMES];

const LEGACY_MODEL_FALLBACKS: Record<string, string> = {
  "gemini-3.7-flash": "gemini-3.8-flash",
  "gpt-chat-latest": "chat-latest",
  "gpt-5-chat-latest": "chat-latest",
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
  if (LEGACY_MODEL_FALLBACKS[model]) return LEGACY_MODEL_FALLBACKS[model];
  if (ALLOWED_CHAT_MODELS.has(model)) return model;
  return model;
}

function supportsImageGenerationTool(responseMode: ResponseMode): boolean {
  return responseMode === "default";
}

function supportsMemoryTools(responseMode: ResponseMode): boolean {
  return responseMode === "default";
}

function buildMemoryTools(): OpenAI.Responses.FunctionTool[] {
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
        "Search prior conversation chunks when the user explicitly asks to recover more detail, history, evidence, or context from previous chats.",
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
  model: string,
  codeInterpreterEnabled: boolean,
  responseMode: ResponseMode,
  imageQuality: ChatRequestBody["imageQuality"],
  imageSize: ChatRequestBody["imageSize"],
  stream: boolean
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
      ...(stream ? { partial_images: 2 } : {}),
      output_format: "png",
    });
  }

  if (supportsMemoryTools(responseMode)) {
    tools.push(...buildMemoryTools());
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
    stream = true,
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
      imageSize,
      stream
    ),
  };

  if (modelSupportsTemperature(effectiveModel)) {
    if (temperature !== undefined) requestParams.temperature = temperature;
    if (topP !== undefined) requestParams.top_p = topP;
  }

  const fixedReasoningEffort = getFixedReasoningEffort(effectiveModel);
  if (isReasoningModel(effectiveModel) && (reasoning || fixedReasoningEffort)) {
    const { effort, mode, ...supportedReasoning } = reasoning ?? {};
    const sanitizedReasoning = {
      ...supportedReasoning,
      ...(fixedReasoningEffort
        ? { effort: fixedReasoningEffort }
        : effort && effort !== "minimal" && getSupportedReasoningEfforts(effectiveModel).includes(effort)
        ? { effort }
        : {}),
      ...(mode === "pro" && modelSupportsReasoningMode(effectiveModel, "pro") && {
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

  const fixedVerbosity = getFixedVerbosity(effectiveModel);
  const effectiveVerbosity = fixedVerbosity ?? verbosity;
  if (
    responseMode !== "quiz" &&
    modelSupportsVerbosity(effectiveModel) &&
    effectiveVerbosity
  ) {
    requestParams.text = {
      ...requestParams.text,
      verbosity: effectiveVerbosity,
    };
  }

  return requestParams;
}
