import OpenAI from "openai";
import { NextRequest } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { isAuthenticatedRequest, isAuthEnabled } from "@/lib/server/auth";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";
import {
  ALLOWED_CHAT_MODELS,
  ChatRequestBody,
  DEFAULT_CHAT_MODEL,
  buildResponseCreateParams,
  createOpenAIClient,
  resolveRequestedModel,
} from "@/lib/server/chatRequest";
import {
  DEEPSEEK_MODEL,
  createDeepSeekClient,
  createDeepSeekEventStream,
} from "@/lib/server/deepseekChat";
import {
  GEMINI_MODEL,
  createGeminiClient,
  createGeminiEventStream,
} from "@/lib/server/geminiChat";
import {
  createMemoryToolEventStream,
  createResponseWithMemoryTools,
} from "@/lib/server/chatToolOrchestrator";
import { QUIZ_FORCED_MODEL } from "@/lib/artifacts/quizArtifacts";

const CHAT_REQUEST_BODY_LIMIT_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
      return jsonError(401, "Unauthorized", {
        message: "Faça login para continuar.",
        code: "unauthorized",
      });
    }

    const parsedBody = await readJsonWithLimit<ChatRequestBody>(request, {
      limitBytes: CHAT_REQUEST_BODY_LIMIT_BYTES,
    });
    if (!parsedBody.ok) {
      return jsonError(parsedBody.status, "Request body error", {
        message:
          parsedBody.reason === "too_large"
            ? "Arquivo(s) muito grande(s). Reduza o tamanho ou a quantidade de anexos (maximo ~10MB total)."
            : "Corpo da requisicao invalido.",
        code:
          parsedBody.reason === "too_large"
            ? "chat_body_too_large"
            : "chat_body_invalid",
      });
    }

    const body = parsedBody.value;
    const {
      input,
      model = DEFAULT_CHAT_MODEL,
      stream = true,
      responseMode = "default",
    } = body;
    const effectiveModel =
      responseMode === "quiz" ? QUIZ_FORCED_MODEL : resolveRequestedModel(model);

    if (!input) {
      return jsonError(400, "Input is required", {
        message: "Input e obrigatorio.",
        code: "chat_input_required",
      });
    }

    if (!ALLOWED_CHAT_MODELS.has(effectiveModel)) {
      return jsonError(400, "Model not allowed", {
        message: "Modelo nao permitido.",
        code: "chat_model_not_allowed",
      });
    }

    if (effectiveModel === GEMINI_MODEL) {
      if (responseMode !== "default") {
        return jsonError(400, "Gemini mode not supported", {
          message: "Gemini 3.8 Flash esta habilitado somente para chat padrao.",
          code: "chat_gemini_mode_not_supported",
        });
      }

      if (!stream) {
        return jsonError(400, "Gemini requires streaming", {
          message: "Gemini 3.8 Flash esta habilitado somente no fluxo de chat com streaming.",
          code: "chat_gemini_stream_required",
        });
      }

      const gemini = createGeminiClient();
      if (!gemini) {
        return jsonError(503, "Gemini API key is missing", {
          message: "GEMINI_API_KEY nao configurada no servidor.",
          code: "chat_gemini_api_key_missing",
        });
      }

      const readableStream = await createGeminiEventStream(
        gemini,
        body,
        request.signal
      );

      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    if (effectiveModel === DEEPSEEK_MODEL) {
      if (responseMode !== "default") {
        return jsonError(400, "DeepSeek mode not supported", {
          message: "DeepSeek V4 Pro esta habilitado somente para chat padrao.",
          code: "chat_deepseek_mode_not_supported",
        });
      }

      if (!stream) {
        return jsonError(400, "DeepSeek requires streaming", {
          message: "DeepSeek V4 Pro esta habilitado somente no fluxo de chat com streaming.",
          code: "chat_deepseek_stream_required",
        });
      }

      const deepseek = createDeepSeekClient();
      if (!deepseek) {
        return jsonError(503, "DeepSeek API key is missing", {
          message: "DEEPSEEK_API_KEY nao configurada no servidor.",
          code: "chat_deepseek_api_key_missing",
        });
      }

      const readableStream = await createDeepSeekEventStream(
        deepseek,
        body,
        request.signal
      );

      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    const openai = createOpenAIClient();
    if (!openai) {
      return jsonError(503, "OpenAI API key is missing", {
        message: "OPENAI_API_KEY nao configurada no servidor.",
        code: "chat_openai_api_key_missing",
      });
    }

    const requestParams = buildResponseCreateParams(body);

    if (stream && responseMode !== "quiz") {
      const readableStream = createMemoryToolEventStream(
        openai,
        requestParams,
        request.signal
      );

      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    const response = await createResponseWithMemoryTools(
      openai,
      requestParams,
      request.signal
    );

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
