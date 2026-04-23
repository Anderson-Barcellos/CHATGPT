import { NextRequest, NextResponse } from "next/server";
import {
  listConversations,
  createConversation,
} from "./data";
import { jsonError } from "@/lib/api/errors";
import { isAuthEnabled, isAuthenticatedRequest } from "@/lib/server/auth";
import { serializeConversation } from "@/lib/storage/serializers";

function unauthorized() {
  return jsonError(401, "Unauthorized", {
    message: "Faça login para continuar.",
    code: "unauthorized",
  });
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
    return unauthorized();
  }

  const conversations = await listConversations();
  return NextResponse.json(
    conversations.map((conversation) => serializeConversation(conversation))
  );
}

export async function POST(request: NextRequest) {
  if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
    return unauthorized();
  }

  try {
    const body = await request.json().catch(() => ({}));
    const conv = await createConversation(body.title);
    return NextResponse.json(serializeConversation(conv), { status: 201 });
  } catch (err) {
    console.error("[conversations] POST error", err);
    return jsonError(500, "Failed to create conversation", {
      message: "Nao consegui criar uma nova conversa agora.",
      code: "conversation_create_failed",
    });
  }
}
