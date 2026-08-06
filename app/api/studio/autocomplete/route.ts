import OpenAI from "openai";
import { NextRequest } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { isAuthenticatedRequest, isAuthEnabled } from "@/lib/server/auth";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";
import {
  createStudioFimClient,
  parseStudioAutocompleteRequest,
  requestStudioFimCompletion,
} from "@/lib/server/studioAutocomplete";

const BODY_LIMIT_BYTES = 256 * 1024;
const UPSTREAM_TIMEOUT_MS = 8_000;

export async function POST(request: NextRequest) {
  let timeoutSignal: AbortSignal | undefined;

  try {
    if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
      return jsonError(401, "Unauthorized", {
        message: "Faça login para continuar.",
        code: "unauthorized",
      });
    }

    const body = await readJsonWithLimit<unknown>(request, {
      limitBytes: BODY_LIMIT_BYTES,
    });
    if (!body.ok) {
      return jsonError(body.status, "Request body error", {
        message: "Corpo do autocomplete inválido.",
        code: "studio_autocomplete_body_invalid",
      });
    }

    const parsed = parseStudioAutocompleteRequest(body.value);
    if (!parsed.ok) {
      return jsonError(400, "Autocomplete request invalid", {
        message: parsed.message,
        code: parsed.code,
      });
    }

    const client = createStudioFimClient();
    if (!client) {
      return jsonError(503, "Autocomplete unavailable", {
        message: "Autocomplete temporariamente indisponível.",
        code: "studio_autocomplete_unavailable",
      });
    }

    timeoutSignal = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
    const signal = AbortSignal.any([request.signal, timeoutSignal]);
    const response = await requestStudioFimCompletion(
      client,
      parsed.value,
      signal
    );

    return Response.json(response);
  } catch (error) {
    if (request.signal.aborted) {
      return new Response(null, { status: 499 });
    }

    if (
      timeoutSignal?.aborted ||
      (error instanceof Error && error.name === "TimeoutError")
    ) {
      return jsonError(504, "Autocomplete timeout", {
        message: "Autocomplete temporariamente indisponível.",
        code: "studio_autocomplete_timeout",
      });
    }

    if (error instanceof Error && error.name === "AbortError") {
      return new Response(null, { status: 499 });
    }

    if (error instanceof OpenAI.APIError && error.status === 429) {
      const retryAfter = error.headers?.get("retry-after") ?? "30";
      return Response.json(
        {
          error: "Too Many Requests",
          code: "studio_autocomplete_rate_limited",
        },
        {
          status: 429,
          headers: { "Retry-After": retryAfter },
        }
      );
    }

    console.error("Studio autocomplete upstream failure", {
      status: error instanceof OpenAI.APIError ? error.status : undefined,
      name: error instanceof Error ? error.name : "UnknownError",
    });

    return jsonError(502, "Autocomplete upstream error", {
      message: "Autocomplete temporariamente indisponível.",
      code: "studio_autocomplete_upstream_error",
    });
  }
}
