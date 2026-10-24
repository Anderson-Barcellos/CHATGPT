import { NextRequest, NextResponse } from "next/server";
import { requireAppAuth } from "@/lib/server/routeAuth";
import { readDiscoverState, deleteDiscoverArticles, DiscoverDeleteError } from "@/lib/discover/store";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";
import { jsonError } from "@/lib/api/errors";
import { nextDiscoverScheduledAt } from "@/lib/discover/schedule";
import { SUGGESTED_TOPICS } from "@/lib/discover/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;
  const state = await readDiscoverState();
  return NextResponse.json({
    ...state,
    nextScheduledAt: nextDiscoverScheduledAt(state.schedule, state.lastDailyDate),
    suggestedTopics: SUGGESTED_TOPICS,
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;
  const body = await readJsonWithLimit<{ ids?: unknown }>(request, { limitBytes: 16384 });
  if (!body.ok) return jsonError(body.status, "Invalid deletion", { message: "Seleção de notícias inválida." });
  try {
    const result = await deleteDiscoverArticles(body.value?.ids);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof DiscoverDeleteError) return jsonError(error.status, "Deletion unavailable", { message: error.message });
    return jsonError(500, "Deletion failed", { message: "Não foi possível apagar as notícias. Tente novamente." });
  }
}
