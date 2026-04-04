import { NextRequest, NextResponse } from "next/server";
import {
  listConversations,
  createConversation,
} from "./data";
import { isAuthEnabled, isAuthenticatedRequest } from "@/lib/server/auth";
import { serializeConversation } from "@/lib/storage/serializers";

function unauthorized() {
  return NextResponse.json(
    { error: "Unauthorized", message: "Faça login para continuar." },
    { status: 401 }
  );
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
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
  }
}
