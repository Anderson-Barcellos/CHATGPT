import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { isAuthenticatedRequest, isAuthEnabled } from "@/lib/server/auth";
import { createOpenAIClient } from "@/lib/server/chatRequest";
import {
  applyBackgroundResponseToConversation,
  toBackgroundJobStatus,
} from "@/lib/server/chatBackgroundJob";
import { updateBackgroundJobByResponseId } from "@/lib/server/chatBackgroundJobStore";

type BackgroundCancelBody = {
  conversationId?: string;
  assistantMessageId?: string;
  responseId?: string;
};

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

    const body = (await request.json().catch(() => ({}))) as BackgroundCancelBody;
    const { conversationId, assistantMessageId, responseId } = body;

    if (!conversationId || !assistantMessageId || !responseId) {
      return jsonError(400, "Missing cancel identifiers", {
        message: "Conversa, mensagem e response_id sao obrigatorios.",
        code: "background_cancel_identifiers_required",
      });
    }

    const openai = createOpenAIClient();
    if (!openai) {
      return jsonError(503, "OpenAI API key is missing", {
        message: "OPENAI_API_KEY nao configurada no servidor.",
        code: "chat_openai_api_key_missing",
      });
    }

    const response = await openai.responses.cancel(responseId);
    const message = await applyBackgroundResponseToConversation({
      conversationId,
      assistantMessageId,
      response,
    });
    await updateBackgroundJobByResponseId(response.id, {
      status: message ? toBackgroundJobStatus(response.status) : "failed",
      lastSyncedAt: new Date().toISOString(),
      error: message ? response.error?.message : "Mensagem vinculada nao encontrada.",
    });
    if (!message) {
      return jsonError(404, "Conversation message not found", {
        message: "Nao encontrei a mensagem vinculada a esse job.",
        code: "background_message_not_found",
      });
    }

    return NextResponse.json({
      responseId: response.id,
      status: response.status,
      message,
    });
  } catch (error) {
    console.error("[chat/background/cancel] error:", error);

    if (error instanceof OpenAI.APIError) {
      return jsonError(error.status || 500, error.message, {
        code: error.code ?? "openai_api_error",
      });
    }

    return jsonError(500, "Internal server error", {
      message: "Falha interna ao cancelar resposta em segundo plano.",
      code: "background_cancel_internal_error",
    });
  }
}
