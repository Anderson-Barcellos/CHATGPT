import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors";
import {
  createWorkspaceNote,
  listWorkspaceNotes,
  WorkspaceNoteSource,
  WorkspaceNoteValidationError,
} from "@/lib/storage/workspaceNotes";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";
import { requireAppAuth } from "@/lib/server/routeAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseSource(value: string | null): WorkspaceNoteSource | undefined {
  if (value === "manual" || value === "chat" || value === "stt" || value === "calendar") {
    return value;
  }

  return undefined;
}

export async function GET(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;

  const params = request.nextUrl.searchParams;
  const notes = await listWorkspaceNotes({
    source: parseSource(params.get("source")),
    conversationId: params.get("conversationId") || undefined,
    calendarEventId: params.get("calendarEventId") || undefined,
  });

  return NextResponse.json({ notes });
}

export async function POST(request: NextRequest) {
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
    const note = await createWorkspaceNote(body.value);
    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    if (error instanceof WorkspaceNoteValidationError) {
      return jsonError(400, "Invalid workspace note", {
        message: error.message,
        code: error.code,
      });
    }

    console.error("[workspace-notes] create error", error);
    return jsonError(500, "Failed to create workspace note", {
      message: "Nao consegui salvar a nota local agora.",
      code: "workspace_note_create_failed",
    });
  }
}
