import { NextRequest, NextResponse } from "next/server";
import { requireAppAuth } from "@/lib/server/routeAuth";
import { readDiscoverState } from "@/lib/discover/store";
import { SUGGESTED_TOPICS } from "@/lib/discover/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;
  const state = await readDiscoverState();
  return NextResponse.json({ ...state, suggestedTopics: SUGGESTED_TOPICS }, { headers: { "Cache-Control": "private, no-store" } });
}
