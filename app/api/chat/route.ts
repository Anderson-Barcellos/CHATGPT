import OpenAI from "openai";
import { NextRequest } from "next/server";
import type { ResponseMode, ResponseVerbosity } from "@/types";
import { jsonError } from "@/lib/api/errors";
import {
  MODELS,
  isReasoningModel,
  modelSupportsCodeInterpreter,
  modelSupportsTemperature,
  modelSupportsVerbosity,
} from "@/lib/models/modelConfig";
import { isAuthenticatedRequest, isAuthEnabled } from "@/lib/server/auth";
import {
  QUIZ_FORCED_MODEL,
  QUIZ_FORCED_REASONING_EFFORT,
  quizResponseSchema,
} from "@/lib/artifacts/quizArtifacts";

type ChatRequestBody = {
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
};

const ALLOWED_MODELS = new Set(
  Object.keys(MODELS).filter((id) => {
    const model = MODELS[id];
    return model.capabilities.includes("chat") || model.capabilities.includes("reasoning");
  })
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function buildTools(
  model: string,
  codeInterpreterEnabled: boolean,
  responseMode: ResponseMode
) {
  if (responseMode === "quiz") {
    return [];
  }

  const tools: OpenAI.Responses.Tool[] = [
    { type: "image_generation" },
    {
      type: "web_search_preview",
      search_context_size: "medium",
      user_location: { type: "approximate", country: "BR" },
    },
  ];

  if (codeInterpreterEnabled && modelSupportsCodeInterpreter(model)) {
    tools.push({
      type: "code_interpreter",
      container: { type: "auto" },
    });
  }

  return tools;
}

function buildRequestParams(body: ChatRequestBody) {
  const {
    input,
    model = "gpt-5.3-chat-latest",
    instructions,
    maxOutputTokens,
    temperature,
    topP,
    verbosity,
    reasoning,
    codeInterpreterEnabled = false,
    responseMode = "default",
  } = body;

  const effectiveModel = responseMode === "quiz" ? QUIZ_FORCED_MODEL : model;
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
    tools: buildTools(effectiveModel, codeInterpreterEnabled, responseMode),
  };

  if (modelSupportsTemperature(effectiveModel)) {
    if (temperature !== undefined) {
      requestParams.temperature = temperature;
    }
    if (topP !== undefined) {
      requestParams.top_p = topP;
    }
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

export async function POST(request: NextRequest) {
  try {
    if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
      return jsonError(401, "Unauthorized", {
        message: "Faça login para continuar.",
        code: "unauthorized",
      });
    }

    const body = (await request.json()) as ChatRequestBody;
    const {
      input,
      model = "gpt-5.3-chat-latest",
      stream = true,
      responseMode = "default",
    } = body;
    const effectiveModel = responseMode === "quiz" ? QUIZ_FORCED_MODEL : model;

    if (!input) {
      return jsonError(400, "Input is required", {
        message: "Input e obrigatorio.",
        code: "chat_input_required",
      });
    }

    if (!ALLOWED_MODELS.has(effectiveModel)) {
      return jsonError(400, "Model not allowed", {
        message: "Modelo nao permitido.",
        code: "chat_model_not_allowed",
      });
    }

    const requestParams = buildRequestParams(body);

    if (stream && responseMode !== "quiz") {
      const streamResponse = await openai.responses.create(
        { ...requestParams, stream: true },
        { signal: request.signal }
      );

      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const event of streamResponse) {
              if (request.signal.aborted) {
                break;
              }
              const data = JSON.stringify(event);
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }

            if (!request.signal.aborted) {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            }
            controller.close();
          } catch (error) {
            if (
              error instanceof Error &&
              (error.name === "AbortError" || request.signal.aborted)
            ) {
              console.info("[chat] Stream abortado pelo cliente — fechando upstream.");
              try {
                controller.close();
              } catch {
                // controller já pode estar fechado
              }
              return;
            }
            controller.error(error);
          }
        },
        cancel() {
          console.info("[chat] ReadableStream.cancel — cliente desconectou.");
        },
      });

      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    const response = await openai.responses.create(requestParams, {
      signal: request.signal,
    });

    return Response.json(response);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" || request.signal.aborted)
    ) {
      return new Response(null, { status: 499 });
    }

    console.error("Chat API error:", error);

    if (error instanceof OpenAI.APIError) {
      return jsonError(error.status || 500, error.message, {
        code: error.code ?? "openai_api_error",
      });
    }

    return jsonError(500, "Internal server error", {
      message: "Falha interna ao processar a conversa.",
      code: "chat_internal_error",
    });
  }
}
