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

    const openai = createOpenAIClient();
    if (!openai) {
      return jsonError(503, "OpenAI API key is missing", {
        message: "OPENAI_API_KEY nao configurada no servidor.",
        code: "chat_openai_api_key_missing",
      });
    }

    const requestParams = buildResponseCreateParams(body);

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
