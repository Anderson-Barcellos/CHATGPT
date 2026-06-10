import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { defaultCalendarId } from "@/lib/calendar/eventDrafts";
import {
  GoogleCalendarApiError,
  GoogleCalendarConnectionError,
  listGoogleCalendarEvents,
} from "@/lib/google/calendarClient";
import { requireAppAuth } from "@/lib/server/routeAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validDateParam(value: string | null): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : value;
}

export async function GET(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const params = request.nextUrl.searchParams;
    const events = await listGoogleCalendarEvents({
      calendarId: params.get("calendarId") || defaultCalendarId(),
      timeMin: validDateParam(params.get("timeMin")),
      timeMax: validDateParam(params.get("timeMax")),
      maxResults: Number(params.get("maxResults")) || 20,
    });

    return NextResponse.json({ events });
  } catch (error) {
    if (error instanceof GoogleCalendarConnectionError) {
      return jsonError(409, "Google Calendar not connected", {
        message: error.message,
        code: "google_calendar_not_connected",
      });
    }

    if (error instanceof GoogleCalendarApiError) {
      return jsonError(error.status, "Google Calendar request failed", {
        message: error.message,
        code: "google_calendar_request_failed",
      });
    }

    console.error("[calendar] list events error", error);
    return jsonError(500, "Failed to list calendar events", {
      message: "Nao consegui listar eventos do Google Calendar agora.",
      code: "calendar_events_list_failed",
    });
  }
}
