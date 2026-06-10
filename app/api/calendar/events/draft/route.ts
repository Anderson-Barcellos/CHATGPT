import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors";
import {
  CalendarDraftValidationError,
  createCalendarEventDraft,
} from "@/lib/calendar/eventDrafts";
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
    return jsonError(body.status, "Invalid calendar draft payload", {
      message:
        body.reason === "too_large"
          ? "Payload do rascunho ficou grande demais."
          : "JSON invalido para rascunho de agenda.",
      code: `calendar_draft_${body.reason}`,
    });
  }

  try {
    const draft = await createCalendarEventDraft(body.value);
    return NextResponse.json(draft, { status: 201 });
  } catch (error) {
    if (error instanceof CalendarDraftValidationError) {
      return jsonError(400, "Invalid calendar draft", {
        message: error.message,
        code: error.code,
      });
    }

    console.error("[calendar] create draft error", error);
    return jsonError(500, "Failed to create calendar draft", {
      message: "Nao consegui criar o rascunho de agenda agora.",
      code: "calendar_draft_create_failed",
    });
  }
}
