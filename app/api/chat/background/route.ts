import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { isAuthenticatedRequest, isAuthEnabled } from "@/lib/server/auth";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";
import {
  ALLOWED_CHAT_MODELS,
  ChatRequestBody,
  buildResponseCreateParams,
  createOpenAIClient,
  resolveRequestedModel,
} from "@/lib/server/chatRequest";
import {
  applyBackgroundResponseToConversation,
  isBackgroundResponseMode,
} from "@/lib/server/chatBackgroundJob";

type BackgroundCreateBody = ChatRequestBody & {
  conversationId?: string;
  assistantMessageId?: string;
};

const CHAT_BACKGROUND_BODY_LIMIT_BYTES = 10 * 1024 * 1024;

function unauthorized() {
  return jsonError(401, "Unauthorized", {
    message: "Faça login para continuar.",
    code: "unauthorized",
  });
}

export async function POST(request: NextRequest) {
  try {
    if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
      return unauthorized();
    }

    const parsedBody = await readJsonWithLimit<BackgroundCreateBody>(request, {
      limitBytes: CHAT_BACKGROUND_BODY_LIMIT_BYTES,
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
    const { conversationId, assistantMessageId, input, responseMode = "default" } = body;

    if (!conversationId || !assistantMessageId) {
      return jsonError(400, "Missing background identifiers", {
        message: "Conversa e mensagem do assistente sao obrigatorias.",
        code: "background_identifiers_required",
      });
    }

    if (!input) {
      return jsonError(400, "Input is required", {
        message: "Input e obrigatorio.",
        code: "chat_input_required",
      });
    }

    if (!isBackgroundResponseMode(responseMode)) {
      return jsonError(400, "Mode does not support background", {
        message: "Background so esta habilitado para respostas longas.",
        code: "background_mode_not_supported",
      });
    }

    const effectiveModel = resolveRequestedModel(body.model);
    if (!ALLOWED_CHAT_MODELS.has(effectiveModel)) {
      return jsonError(400, "Model not allowed", {
        message: "Modelo nao permitido.",
        code: "chat_model_not_allowed",
      });
    }

    const openai = createOpenAIClient();
    if (!openai) {
      return jsonError(503, "OpenAI API key is missing", {
        message: "OPENAI_API_KEY nao configurada no servidor.",
        code: "chat_openai_api_key_missing",
      });
    }

    const response = await openai.responses.create({
      ...buildResponseCreateParams(body),
      background: true,
      stream: false,
    });

    const message = await applyBackgroundResponseToConversation({
      conversationId,
      assistantMessageId,
      response,
    });
    if (!message) {
      return jsonError(404, "Conversation message not found", {
        message: "Nao encontrei a mensagem para vincular o job.",
        code: "background_message_not_found",
      });
    }

    return NextResponse.json({
      responseId: response.id,
      status: response.status,
      message,
    });
  } catch (error) {
    console.error("[chat/background] create error:", error);

    if (error instanceof OpenAI.APIError) {
      return jsonError(error.status || 500, error.message, {
        code: error.code ?? "openai_api_error",
      });
    }

    return jsonError(500, "Internal server error", {
      message: "Falha interna ao iniciar resposta em segundo plano.",
      code: "background_internal_error",
    });
  }
}
