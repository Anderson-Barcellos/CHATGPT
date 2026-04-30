import { NextRequest, NextResponse } from "next/server";
import {
  getConversation,
  updateConversation,
  deleteConversation,
} from "../data";
import { jsonError } from "@/lib/api/errors";
import { isAuthEnabled, isAuthenticatedRequest } from "@/lib/server/auth";
import { deserializeMessage, serializeConversation } from "@/lib/storage/serializers";
import { ConversationWorkspace } from "@/types";

function unauthorized() {
  return jsonError(401, "Unauthorized", {
    message: "Faça login para continuar.",
    code: "unauthorized",
  });
}

export const dynamic = "force-dynamic";

function normalizeWorkspace(
  value: unknown
): ConversationWorkspace | undefined {
  if (!value || typeof value !== "object") return undefined;

  const rawWorkspace = value as { notes?: unknown };
  if (!rawWorkspace.notes || typeof rawWorkspace.notes !== "object") return undefined;

  const rawNotes = rawWorkspace.notes as {
    objective?: unknown;
    body?: unknown;
    nextSteps?: unknown;
  };

  if (
    rawNotes.objective !== undefined &&
    typeof rawNotes.objective !== "string"
  ) {
    return undefined;
  }

  if (rawNotes.body !== undefined && typeof rawNotes.body !== "string") {
    return undefined;
  }

  if (
    rawNotes.nextSteps !== undefined &&
    !Array.isArray(rawNotes.nextSteps)
  ) {
    return undefined;
  }

  const nextSteps = Array.isArray(rawNotes.nextSteps)
    ? rawNotes.nextSteps
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    : [];

  return {
    notes: {
      objective: (rawNotes.objective ?? "").trim(),
      body: (rawNotes.body ?? "").trim(),
      nextSteps,
      updatedAt: new Date(),
    },
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
    return unauthorized();
  }

  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) {
    return jsonError(404, "Not found", {
      message: "Conversa nao encontrada.",
      code: "conversation_not_found",
    });
  }
  return NextResponse.json(serializeConversation(conversation));
}

async function handleConversationUpdate(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
    return unauthorized();
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const payload =
      body && typeof body === "object"
        ? (body as Record<string, unknown>)
        : {};
    const hasWorkspace = Object.prototype.hasOwnProperty.call(
      payload,
      "workspace"
    );
    const parsedWorkspace = hasWorkspace
      ? normalizeWorkspace(payload.workspace)
      : undefined;
    const titleUpdate =
      typeof payload.title === "string" ? payload.title : undefined;
    const messagesUpdate = Array.isArray(payload.messages)
      ? payload.messages.map((message) =>
          deserializeMessage(message as Parameters<typeof deserializeMessage>[0])
        )
      : undefined;

    if (hasWorkspace && !parsedWorkspace) {
      return jsonError(400, "Invalid workspace payload", {
        message: "Formato inválido para workspace da conversa.",
        code: "invalid_workspace_payload",
      });
    }

    const updates = {
      ...(titleUpdate !== undefined && { title: titleUpdate }),
      ...(Array.isArray(payload.messages) && { messages: messagesUpdate }),
      ...(hasWorkspace && { workspace: parsedWorkspace }),
    };
    const updated = await updateConversation(id, updates);
    if (!updated) {
      return jsonError(404, "Not found", {
        message: "Conversa nao encontrada.",
        code: "conversation_not_found",
      });
    }
    return NextResponse.json(serializeConversation(updated));
  } catch (err) {
    console.error("[conversations] update error", err);
    return jsonError(500, "Failed to update conversation", {
      message: "Nao consegui salvar essa conversa agora.",
      code: "conversation_update_failed",
    });
  }
}

export const PUT = handleConversationUpdate;
export const POST = handleConversationUpdate;

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
    return unauthorized();
  }

  try {
    const { id } = await params;
    const ok = await deleteConversation(id);
    if (!ok) {
      return jsonError(404, "Not found", {
        message: "Conversa nao encontrada.",
        code: "conversation_not_found",
      });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[conversations] DELETE error", err);
    return jsonError(500, "Failed to delete conversation", {
      message: "Nao consegui excluir essa conversa agora.",
      code: "conversation_delete_failed",
    });
  }
}
