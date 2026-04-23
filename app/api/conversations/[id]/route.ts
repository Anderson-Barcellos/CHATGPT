import { NextRequest, NextResponse } from "next/server";
import {
  getConversation,
  updateConversation,
  deleteConversation,
} from "../data";
import { jsonError } from "@/lib/api/errors";
import { isAuthEnabled, isAuthenticatedRequest } from "@/lib/server/auth";
import { deserializeMessage, serializeConversation } from "@/lib/storage/serializers";

function unauthorized() {
  return jsonError(401, "Unauthorized", {
    message: "Faça login para continuar.",
    code: "unauthorized",
  });
}

export const dynamic = "force-dynamic";

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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
    return unauthorized();
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const updates = {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.messages !== undefined && {
        messages: Array.isArray(body.messages)
          ? body.messages.map(deserializeMessage)
          : undefined,
      }),
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
    console.error("[conversations] PUT error", err);
    return jsonError(500, "Failed to update conversation", {
      message: "Nao consegui salvar essa conversa agora.",
      code: "conversation_update_failed",
    });
  }
}

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
