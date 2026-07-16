import { NextRequest, NextResponse } from "next/server";
import { getConversation, listConversations } from "@/app/api/conversations/data";
import { requireAppAuth } from "@/lib/server/routeAuth";
import {
  getMemoryIndexStats,
  indexConversation,
  reconcileMemoryIndex,
} from "@/lib/server/memory/indexStore";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json().catch(() => ({}));
    const conversationId =
      typeof body.conversationId === "string" ? body.conversationId : undefined;
    const limit =
      typeof body.limit === "number"
        ? Math.min(Math.max(Math.round(body.limit), 1), 200)
        : 50;

    const allConversations = conversationId ? null : await listConversations();
    const reconciliation = allConversations
      ? await reconcileMemoryIndex(
          allConversations.map((conversation) => conversation.id)
        )
      : undefined;
    const conversations = conversationId
      ? [await getConversation(conversationId)]
      : allConversations!.slice(0, limit);

    const results = [];
    for (const conversation of conversations) {
      if (!conversation) continue;
      results.push(await indexConversation(conversation));
    }

    return NextResponse.json({
      results,
      stats: await getMemoryIndexStats(),
      ...(reconciliation && { reconciliation }),
    });
  } catch (error) {
    console.error("[memory/index] POST error", error);
    return NextResponse.json(
      { error: "Failed to index memory" },
      { status: 500 }
    );
  }
}
