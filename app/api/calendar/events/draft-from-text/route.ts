import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors";
import {
  CalendarDraftExtractionError,
  createCalendarDraftFromNaturalLanguage,
} from "@/lib/calendar/naturalLanguageDraft";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";
import { requireAppAuth } from "@/lib/server/routeAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;

  const body = await readJsonWithLimit<Record<string, unknown>>(request, {
    limitBytes: 128 * 1024,
  });

  if (!body.ok) {
    return jsonError(body.status, "Invalid calendar draft text payload", {
      message:
        body.reason === "too_large"
          ? "Texto para rascunhar agenda ficou grande demais."
          : "JSON invalido para rascunhar agenda.",
      code: `calendar_draft_from_text_${body.reason}`,
    });
  }

  try {
    const result = await createCalendarDraftFromNaturalLanguage(body.value);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof CalendarDraftExtractionError) {
      const missingSuffix =
        error.missingFields.length > 0
          ? ` Campos faltantes: ${error.missingFields.join(", ")}.`
          : "";
      return jsonError(error.status, "Calendar draft extraction failed", {
        message: `${error.message}${missingSuffix}`,
        code: error.code,
      });
    }

    if (error instanceof OpenAI.APIError) {
      return jsonError(error.status || 500, error.message, {
        code: error.code ?? "openai_api_error",
      });
    }

    console.error("[calendar] draft from text error", error);
    return jsonError(500, "Failed to create calendar draft from text", {
      message: "Nao consegui transformar esse texto em rascunho de agenda agora.",
      code: "calendar_draft_from_text_failed",
    });
  }
}
