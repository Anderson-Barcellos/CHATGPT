import { CalendarEventDraft } from "@/lib/calendar/eventDrafts";
import { refreshGoogleOAuthAccessToken } from "@/lib/google/oauth";
import {
  readGoogleCalendarToken,
  saveGoogleCalendarToken,
} from "@/lib/google/tokenStore";

const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";
const TOKEN_REFRESH_MARGIN_MS = 60_000;

export class GoogleCalendarConnectionError extends Error {
  constructor(message = "Google Calendar nao conectado.") {
    super(message);
    this.name = "GoogleCalendarConnectionError";
  }
}

export class GoogleCalendarApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GoogleCalendarApiError";
    this.status = status;
  }
}

export interface GoogleCalendarEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
}

interface GoogleEventsListResponse {
  items?: GoogleCalendarEvent[];
  nextPageToken?: string;
}

export interface CalendarEventListOptions {
  calendarId: string;
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
}

export type CalendarConfirmResult =
  | { action: "create" | "update"; event: GoogleCalendarEvent }
  | { action: "cancel"; eventId: string };

async function authorizedAccessToken(): Promise<string> {
  const token = await readGoogleCalendarToken();
  if (!token) {
    throw new GoogleCalendarConnectionError();
  }

  const expiresAt = new Date(token.expiresAt).getTime();
  if (expiresAt - Date.now() > TOKEN_REFRESH_MARGIN_MS) {
    return token.accessToken;
  }

  if (!token.refreshToken) {
    throw new GoogleCalendarConnectionError(
      "Google Calendar conectado sem refresh token. Reconecte a conta."
    );
  }

  const refreshed = await refreshGoogleOAuthAccessToken(token.refreshToken);
  const saved = await saveGoogleCalendarToken(refreshed);
  return saved.accessToken;
}

async function googleCalendarFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const accessToken = await authorizedAccessToken();
  const response = await fetch(`${GOOGLE_CALENDAR_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};

  if (!response.ok) {
    const message =
      typeof payload.error === "object" &&
      payload.error &&
      "message" in payload.error &&
      typeof payload.error.message === "string"
        ? payload.error.message
        : "Falha ao chamar Google Calendar.";
    throw new GoogleCalendarApiError(message, response.status);
  }

  return payload as T;
}

function eventPath(calendarId: string, eventId?: string): string {
  const calendar = encodeURIComponent(calendarId);
  return eventId
    ? `/calendars/${calendar}/events/${encodeURIComponent(eventId)}`
    : `/calendars/${calendar}/events`;
}

export async function listGoogleCalendarEvents({
  calendarId,
  timeMin,
  timeMax,
  maxResults = 20,
}: CalendarEventListOptions): Promise<GoogleCalendarEvent[]> {
  const now = new Date();
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(maxResults),
    timeMin: timeMin || now.toISOString(),
    timeMax:
      timeMax || new Date(now.getTime() + 7 * 24 * 60 * 60_000).toISOString(),
  });

  const response = await googleCalendarFetch<GoogleEventsListResponse>(
    `${eventPath(calendarId)}?${params.toString()}`
  );

  return Array.isArray(response.items) ? response.items : [];
}

function draftToGoogleEventBody(draft: CalendarEventDraft): Record<string, unknown> {
  return {
    summary: draft.summary,
    ...(draft.description ? { description: draft.description } : {}),
    ...(draft.location ? { location: draft.location } : {}),
    ...(draft.start ? { start: draft.start } : {}),
    ...(draft.end ? { end: draft.end } : {}),
    ...(draft.attendees ? { attendees: draft.attendees } : {}),
    extendedProperties: {
      private: {
        gauchoChatDraftId: draft.id,
        ...(draft.conversationId
          ? { gauchoChatConversationId: draft.conversationId }
          : {}),
        ...(draft.sourceMessageId
          ? { gauchoChatSourceMessageId: draft.sourceMessageId }
          : {}),
      },
    },
  };
}

export async function confirmGoogleCalendarDraft(
  draft: CalendarEventDraft,
  sendUpdates: "all" | "externalOnly" | "none" = "none"
): Promise<CalendarConfirmResult> {
  const params = new URLSearchParams({ sendUpdates });

  if (draft.action === "cancel") {
    if (!draft.eventId) {
      throw new GoogleCalendarApiError("Rascunho sem eventId para cancelar.", 400);
    }

    await googleCalendarFetch<void>(
      `${eventPath(draft.calendarId, draft.eventId)}?${params.toString()}`,
      { method: "DELETE" }
    );

    return { action: "cancel", eventId: draft.eventId };
  }

  if (draft.action === "update") {
    if (!draft.eventId) {
      throw new GoogleCalendarApiError("Rascunho sem eventId para atualizar.", 400);
    }

    const event = await googleCalendarFetch<GoogleCalendarEvent>(
      `${eventPath(draft.calendarId, draft.eventId)}?${params.toString()}`,
      {
        method: "PATCH",
        body: JSON.stringify(draftToGoogleEventBody(draft)),
      }
    );

    return { action: "update", event };
  }

  const event = await googleCalendarFetch<GoogleCalendarEvent>(
    `${eventPath(draft.calendarId)}?${params.toString()}`,
    {
      method: "POST",
      body: JSON.stringify(draftToGoogleEventBody(draft)),
    }
  );

  return { action: "create", event };
}
