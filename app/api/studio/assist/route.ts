import OpenAI from "openai";
import { NextRequest } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { isAuthenticatedRequest, isAuthEnabled } from "@/lib/server/auth";
import { createOpenAIClient } from "@/lib/server/chatRequest";
import { createXAIClient, GROK_MODEL } from "@/lib/server/xaiChat";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";
import {
  buildStudioResponseParams,
  createStudioAssistantEventStream,
  parseStudioAssistantRequest,
} from "@/lib/server/studioAssistant";

const STUDIO_REQUEST_BODY_LIMIT_BYTES = 512 * 1024;

export async function POST(request: NextRequest) {
  try {
    if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
      return jsonError(401, "Unauthorized", {
        message: "Faça login para continuar.",
        code: "unauthorized",
      });
    }

    const parsedBody = await readJsonWithLimit<unknown>(request, {
      limitBytes: STUDIO_REQUEST_BODY_LIMIT_BYTES,
    });
    if (!parsedBody.ok) {
      return jsonError(parsedBody.status, "Request body error", {
        message:
          parsedBody.reason === "too_large"
            ? "O arquivo ativo excede o limite de contexto do Studio."
            : "Corpo da requisição inválido.",
        code:
          parsedBody.reason === "too_large"
            ? "studio_body_too_large"
            : "studio_body_invalid",
      });
    }

    const studioRequest = parseStudioAssistantRequest(parsedBody.value);
    if (!studioRequest.ok) {
      return jsonError(400, "Studio request invalid", {
        message: studioRequest.message,
        code: studioRequest.code,
      });
    }

    const provider = studioRequest.value.model === GROK_MODEL ? "xai" : "openai";
    const openai = provider === "xai" ? createXAIClient() : createOpenAIClient();
    if (!openai) {
      return jsonError(503, `${provider === "xai" ? "xAI" : "OpenAI"} API key is missing`, {
        message: provider === "xai" ? "XAI_API_KEY não configurada no servidor." : "OPENAI_API_KEY não configurada no servidor.",
        code: provider === "xai" ? "studio_xai_api_key_missing" : "studio_openai_api_key_missing",
      });
    }

    const stream = createStudioAssistantEventStream(
      openai,
      buildStudioResponseParams(studioRequest.value, provider),
      request.signal
    );

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" || request.signal.aborted)
    ) {
      return new Response(null, { status: 499 });
    }

    console.error("Studio assistant API error:", error);

    if (error instanceof OpenAI.APIError) {
      return jsonError(error.status || 500, error.message, {
        code: error.code ?? "studio_openai_api_error",
      });
    }

    return jsonError(500, "Internal server error", {
      message: "Falha interna ao consultar o assistente do Studio.",
      code: "studio_internal_error",
    });
  }
}
