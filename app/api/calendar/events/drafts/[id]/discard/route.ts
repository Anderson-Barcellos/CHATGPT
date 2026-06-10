import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors";
import {
  CalendarDraftStateError,
  discardPendingCalendarEventDraft,
} from "@/lib/calendar/eventDrafts";
import { requireAppAuth } from "@/lib/server/routeAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const draftId = id.trim();
  if (!draftId) {
    return jsonError(400, "Calendar draft id required", {
      message: "ID do rascunho e obrigatorio para descartar.",
      code: "calendar_draft_id_required",
    });
  }

  try {
    const draft = await discardPendingCalendarEventDraft(draftId);
    if (!draft) {
      return jsonError(404, "Calendar draft not found", {
        message: "Rascunho de agenda nao encontrado.",
        code: "calendar_draft_not_found",
      });
    }

    return NextResponse.json({ draft });
  } catch (error) {
    if (error instanceof CalendarDraftStateError) {
      return jsonError(409, "Calendar draft already handled", {
        message: error.message,
        code: error.code,
      });
    }

    console.error("[calendar] discard draft error", error);
    return jsonError(500, "Failed to discard calendar draft", {
      message: "Nao consegui descartar o rascunho agora.",
      code: "calendar_draft_discard_failed",
    });
  }
}
