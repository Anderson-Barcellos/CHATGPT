import { NextRequest, NextResponse } from "next/server";
import { getConversation } from "@/app/api/conversations/data";
import { requireAppAuth } from "@/lib/server/routeAuth";
import { generateMemorySuggestionsForConversation } from "@/lib/server/memory/suggestionGenerator";
import {
  listMemorySuggestions,
  serializeMemorySuggestion,
} from "@/lib/server/memory/suggestionsStore";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;

  const status = request.nextUrl.searchParams.get("status");
  const suggestions = await listMemorySuggestions(
    status === "pending" || status === "accepted" || status === "rejected"
      ? status
      : undefined
  );

  return NextResponse.json(
    suggestions.map((suggestion) => serializeMemorySuggestion(suggestion))
  );
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json().catch(() => ({}));
    const conversationId =
      typeof body.conversationId === "string" ? body.conversationId : "";
    const conversation = conversationId
      ? await getConversation(conversationId)
      : undefined;

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const suggestions = await generateMemorySuggestionsForConversation(
      conversation
    );

    return NextResponse.json(
      suggestions.map((suggestion) => serializeMemorySuggestion(suggestion))
    );
  } catch (error) {
    console.error("[memory/suggestions] POST error", error);
    return NextResponse.json(
      { error: "Failed to create memory suggestions" },
      { status: 500 }
    );
  }
}
