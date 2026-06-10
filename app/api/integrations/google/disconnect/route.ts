import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { defaultCalendarId } from "@/lib/calendar/eventDrafts";
import {
  clearGoogleCalendarToken,
  getGoogleCalendarConnectionStatus,
} from "@/lib/google/tokenStore";
import { requireAppAuth } from "@/lib/server/routeAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;

  try {
    await clearGoogleCalendarToken();
    return NextResponse.json(
      await getGoogleCalendarConnectionStatus(defaultCalendarId())
    );
  } catch (error) {
    console.error("[google-oauth] disconnect error", error);
    return jsonError(500, "Failed to disconnect Google", {
      message: "Nao consegui desconectar o Google agora.",
      code: "google_disconnect_failed",
    });
  }
}
