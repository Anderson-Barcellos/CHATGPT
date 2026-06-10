import { NextRequest, NextResponse } from "next/server";
import {
  CalendarDraftStatus,
  listCalendarEventDrafts,
} from "@/lib/calendar/eventDrafts";
import { requireAppAuth } from "@/lib/server/routeAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseStatus(value: string | null): CalendarDraftStatus | undefined {
  if (
    value === "pending" ||
    value === "confirmed" ||
    value === "discarded" ||
    value === "failed"
  ) {
    return value;
  }

  return undefined;
}

export async function GET(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;

  const status = parseStatus(request.nextUrl.searchParams.get("status"));
  const drafts = await listCalendarEventDrafts(status);
  return NextResponse.json({ drafts });
}
