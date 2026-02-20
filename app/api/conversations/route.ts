import { NextResponse } from "next/server";
import {
  listConversations,
  createConversation,
} from "./data";

export const dynamic = "force-dynamic";

export async function GET() {
  const conversations = await listConversations();
  return NextResponse.json(conversations);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const conv = await createConversation(body.title);
    return NextResponse.json(conv, { status: 201 });
  } catch (err) {
    console.error("[conversations] POST error", err);
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
  }
}
