import { NextRequest, NextResponse } from "next/server";
import { createMemory } from "@/app/api/memories/data";
import { requireAppAuth } from "@/lib/server/routeAuth";
import {
  listMemorySuggestions,
  serializeMemorySuggestion,
  updateMemorySuggestionStatus,
} from "@/lib/server/memory/suggestionsStore";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const status = body.status;

    if (status !== "accepted" && status !== "rejected") {
      return NextResponse.json(
        { error: "status must be accepted or rejected" },
        { status: 400 }
      );
    }

    const current = (await listMemorySuggestions()).find(
      (suggestion) => suggestion.id === id
    );
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let memoryId: string | undefined;
    if (status === "accepted" && current.status !== "accepted") {
      const memory = await createMemory({
        content:
          typeof body.content === "string" && body.content.trim()
            ? body.content.trim()
            : current.content,
        category: current.category,
        isActive: true,
        priority: 0,
      });
      memoryId = memory.id;
    }

    const updated = await updateMemorySuggestionStatus(id, status);
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      suggestion: serializeMemorySuggestion(updated),
      memoryId,
    });
  } catch (error) {
    console.error("[memory/suggestions/:id] PATCH error", error);
    return NextResponse.json(
      { error: "Failed to update memory suggestion" },
      { status: 500 }
    );
  }
}
