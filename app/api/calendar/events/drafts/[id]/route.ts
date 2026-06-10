import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors";
import {
  CalendarDraftStateError,
  CalendarDraftValidationError,
  editPendingCalendarEventDraft,
} from "@/lib/calendar/eventDrafts";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";
import { requireAppAuth } from "@/lib/server/routeAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const draftId = id.trim();
  if (!draftId) {
    return jsonError(400, "Calendar draft id required", {
      message: "ID do rascunho e obrigatorio para editar.",
      code: "calendar_draft_id_required",
    });
  }

  const body = await readJsonWithLimit<Record<string, unknown>>(request, {
    limitBytes: 128 * 1024,
  });

  if (!body.ok) {
    return jsonError(body.status, "Invalid calendar draft update payload", {
      message:
        body.reason === "too_large"
          ? "Payload de edicao ficou grande demais."
          : "JSON invalido para editar rascunho de agenda.",
      code: `calendar_draft_update_${body.reason}`,
    });
  }

  try {
    const draft = await editPendingCalendarEventDraft(draftId, body.value);
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

    if (error instanceof CalendarDraftValidationError) {
      return jsonError(400, "Invalid calendar draft update", {
        message: error.message,
        code: error.code,
      });
    }

    console.error("[calendar] update draft error", error);
    return jsonError(500, "Failed to update calendar draft", {
      message: "Nao consegui salvar a edicao do rascunho agora.",
      code: "calendar_draft_update_failed",
    });
  }
}
