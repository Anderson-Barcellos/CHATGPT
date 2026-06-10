import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors";
import {
  deleteWorkspaceNote,
  updateWorkspaceNote,
  WorkspaceNoteValidationError,
} from "@/lib/storage/workspaceNotes";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";
import { requireAppAuth } from "@/lib/server/routeAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;

  const body = await readJsonWithLimit<Record<string, unknown>>(request, {
    limitBytes: 256 * 1024,
  });

  if (!body.ok) {
    return jsonError(body.status, "Invalid workspace note payload", {
      message:
        body.reason === "too_large"
          ? "Payload da nota ficou grande demais."
          : "JSON invalido para nota local.",
      code: `workspace_note_${body.reason}`,
    });
  }

  try {
    const { id } = await params;
    const note = await updateWorkspaceNote(id, body.value);
    if (!note) {
      return jsonError(404, "Workspace note not found", {
        message: "Nota local nao encontrada.",
        code: "workspace_note_not_found",
      });
    }

    return NextResponse.json(note);
  } catch (error) {
    if (error instanceof WorkspaceNoteValidationError) {
      return jsonError(400, "Invalid workspace note", {
        message: error.message,
        code: error.code,
      });
    }

    console.error("[workspace-notes] update error", error);
    return jsonError(500, "Failed to update workspace note", {
      message: "Nao consegui atualizar a nota local agora.",
      code: "workspace_note_update_failed",
    });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const deleted = await deleteWorkspaceNote(id);
    if (!deleted) {
      return jsonError(404, "Workspace note not found", {
        message: "Nota local nao encontrada.",
        code: "workspace_note_not_found",
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[workspace-notes] delete error", error);
    return jsonError(500, "Failed to delete workspace note", {
      message: "Nao consegui excluir a nota local agora.",
      code: "workspace_note_delete_failed",
    });
  }
}
