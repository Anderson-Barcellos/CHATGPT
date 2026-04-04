import { NextRequest, NextResponse } from "next/server";
import {
  getConversation,
  updateConversation,
  deleteConversation,
} from "../data";
import { isAuthEnabled, isAuthenticatedRequest } from "@/lib/server/auth";
import { deserializeMessage, serializeConversation } from "@/lib/storage/serializers";

function unauthorized() {
  return NextResponse.json(
    { error: "Unauthorized", message: "Faça login para continuar." },
    { status: 401 }
  );
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
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(serializeConversation(updated));
  } catch (err) {
    console.error("[conversations] PUT error", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
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
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[conversations] DELETE error", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
