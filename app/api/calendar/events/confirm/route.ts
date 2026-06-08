import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors";
import {
  getCalendarEventDraft,
  updateCalendarEventDraft,
} from "@/lib/calendar/eventDrafts";
import {
  confirmGoogleCalendarDraft,
  GoogleCalendarApiError,
  GoogleCalendarConnectionError,
} from "@/lib/google/calendarClient";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";
import { requireAppAuth } from "@/lib/server/routeAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseSendUpdates(value: unknown): "all" | "externalOnly" | "none" {
  if (value === "all" || value === "externalOnly" || value === "none") {
    return value;
  }

  return "none";
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;

  const body = await readJsonWithLimit<Record<string, unknown>>(request, {
    limitBytes: 64 * 1024,
  });

  if (!body.ok) {
    return jsonError(body.status, "Invalid calendar confirmation payload", {
      message:
        body.reason === "too_large"
          ? "Payload de confirmacao ficou grande demais."
          : "JSON invalido para confirmacao de agenda.",
      code: `calendar_confirm_${body.reason}`,
    });
  }

  const draftId =
    typeof body.value.draftId === "string" ? body.value.draftId.trim() : "";
  if (!draftId) {
    return jsonError(400, "Calendar draft id required", {
      message: "ID do rascunho e obrigatorio para confirmar.",
      code: "calendar_draft_id_required",
    });
  }

  const draft = await getCalendarEventDraft(draftId);
  if (!draft) {
    return jsonError(404, "Calendar draft not found", {
      message: "Rascunho de agenda nao encontrado.",
      code: "calendar_draft_not_found",
    });
  }

  if (draft.status !== "pending") {
    return jsonError(409, "Calendar draft already handled", {
      message: "Esse rascunho ja foi processado.",
      code: "calendar_draft_not_pending",
    });
  }

  try {
    const result = await confirmGoogleCalendarDraft(
      draft,
      parseSendUpdates(body.value.sendUpdates)
    );
    const googleEventId =
      result.action === "cancel" ? result.eventId : result.event.id;
    const updatedDraft = await updateCalendarEventDraft(draft.id, {
      status: "confirmed",
      ...(googleEventId ? { googleEventId } : {}),
      confirmedAt: new Date().toISOString(),
    });

    return NextResponse.json({ draft: updatedDraft, result });
  } catch (error) {
    if (error instanceof GoogleCalendarConnectionError) {
      return jsonError(409, "Google Calendar not connected", {
        message: error.message,
        code: "google_calendar_not_connected",
      });
    }

    if (error instanceof GoogleCalendarApiError) {
      await updateCalendarEventDraft(draft.id, {
        status: "failed",
        failureMessage: error.message,
      });
      return jsonError(
        error.status >= 500 ? 502 : error.status,
        "Google Calendar request failed",
        {
          message: error.message,
          code: "google_calendar_request_failed",
        }
      );
    }

    console.error("[calendar] confirm draft error", error);
    await updateCalendarEventDraft(draft.id, {
      status: "failed",
      failureMessage: "Erro interno ao confirmar rascunho.",
    });
    return jsonError(500, "Failed to confirm calendar draft", {
      message: "Nao consegui confirmar o rascunho de agenda agora.",
      code: "calendar_draft_confirm_failed",
    });
  }
}
