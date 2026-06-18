import { NextRequest, NextResponse } from "next/server";
import { requireAppAuth } from "@/lib/server/routeAuth";
import { searchMemoryContext } from "@/lib/server/memory/indexStore";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json().catch(() => ({}));
    const query = typeof body.query === "string" ? body.query : "";
    if (!query.trim()) {
      return NextResponse.json({ results: [] });
    }

    const topK =
      typeof body.topK === "number"
        ? Math.min(Math.max(Math.round(body.topK), 1), 10)
        : 5;
    const excludeConversationId =
      typeof body.excludeConversationId === "string"
        ? body.excludeConversationId
        : undefined;

    const results = await searchMemoryContext(query, {
      topK,
      excludeConversationId,
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[memory/search] POST error", error);
    return NextResponse.json(
      { error: "Failed to search memory" },
      { status: 500 }
    );
  }
}
