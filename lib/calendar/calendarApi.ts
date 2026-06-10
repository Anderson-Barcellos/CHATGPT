import { ClientApiError, parseApiErrorResponse } from "@/lib/api/errors";
import { apiUrl } from "@/lib/utils";

export interface GoogleCalendarIntegrationStatus {
  connected: boolean;
  tokenStoreConfigured: boolean;
  hasRefreshToken: boolean;
  expiresAt?: string;
  scope?: string;
  tokenType?: string;
  defaultCalendarId: string;
  error?: string;
  oauthConfigured: boolean;
  redirectUri: string | null;
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

export type CalendarDraftAction = "create" | "update" | "cancel";
export type CalendarDraftStatus = "pending" | "confirmed" | "discarded" | "failed";

export interface CalendarDateTime {
  dateTime: string;
  timeZone: string;
}

export interface CalendarDraftEditInput {
  summary?: string;
  description?: string;
  location?: string;
  start?: CalendarDateTime;
  end?: CalendarDateTime;
  durationMinutes?: number;
}

export interface CalendarEventDraft {
  id: string;
  action: CalendarDraftAction;
  calendarId: string;
  eventId?: string;
  summary: string;
  description?: string;
  location?: string;
  start?: CalendarDateTime;
  end?: CalendarDateTime;
  source: "chat" | "panel" | "stt";
  conversationId?: string;
  sourceMessageId?: string;
  status: CalendarDraftStatus;
  googleEventId?: string;
  failureMessage?: string;
  confirmedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEventListOptions {
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
}

export interface CalendarDraftFromTextInput {
  text: string;
  source?: "chat" | "stt";
  conversationId?: string;
  sourceMessageId?: string;
}

export interface CalendarDraftFromTextResult {
  draft: CalendarEventDraft;
  missingFields: string[];
  confidence: "low" | "medium" | "high";
}

async function safeJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return (text ? JSON.parse(text) : {}) as T;
}

async function assertOk(response: Response): Promise<void> {
  if (!response.ok) {
    throw await parseApiErrorResponse(response);
  }
}

export function isGoogleCalendarNotConnectedError(error: unknown): boolean {
  return (
    error instanceof ClientApiError &&
    error.status === 409 &&
    error.code === "google_calendar_not_connected"
  );
}

export async function getGoogleIntegrationStatus(): Promise<GoogleCalendarIntegrationStatus> {
  const response = await fetch(apiUrl("/api/integrations/google/status"), {
    cache: "no-store",
  });
  await assertOk(response);
  return safeJson<GoogleCalendarIntegrationStatus>(response);
}

export function googleAuthStartUrl(): string {
  return apiUrl("/api/integrations/google/auth/start");
}

export async function disconnectGoogleIntegration(): Promise<GoogleCalendarIntegrationStatus> {
  const response = await fetch(apiUrl("/api/integrations/google/disconnect"), {
    method: "POST",
  });
  await assertOk(response);
  return safeJson<GoogleCalendarIntegrationStatus>(response);
}

export async function listCalendarEvents({
  timeMin,
  timeMax,
  maxResults,
}: CalendarEventListOptions = {}): Promise<GoogleCalendarEvent[]> {
  const params = new URLSearchParams();
  if (timeMin) params.set("timeMin", timeMin);
  if (timeMax) params.set("timeMax", timeMax);
  if (maxResults) params.set("maxResults", String(maxResults));

  const query = params.toString();
  const response = await fetch(
    apiUrl(`/api/calendar/events${query ? `?${query}` : ""}`),
    { cache: "no-store" }
  );
  await assertOk(response);
  const data = await safeJson<{ events?: GoogleCalendarEvent[] }>(response);
  return Array.isArray(data.events) ? data.events : [];
}

export async function listCalendarDrafts(
  status?: CalendarDraftStatus
): Promise<CalendarEventDraft[]> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);

  const query = params.toString();
  const response = await fetch(
    apiUrl(`/api/calendar/events/drafts${query ? `?${query}` : ""}`),
    { cache: "no-store" }
  );
  await assertOk(response);
  const data = await safeJson<{ drafts?: CalendarEventDraft[] }>(response);
  return Array.isArray(data.drafts) ? data.drafts : [];
}

export async function confirmCalendarDraft(
  draftId: string
): Promise<CalendarEventDraft | undefined> {
  const response = await fetch(apiUrl("/api/calendar/events/confirm"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ draftId, sendUpdates: "none" }),
  });
  await assertOk(response);
  const data = await safeJson<{ draft?: CalendarEventDraft }>(response);
  return data.draft;
}

export async function updateCalendarDraft(
  draftId: string,
  input: CalendarDraftEditInput
): Promise<CalendarEventDraft | undefined> {
  const response = await fetch(
    apiUrl(`/api/calendar/events/drafts/${encodeURIComponent(draftId)}`),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );
  await assertOk(response);
  const data = await safeJson<{ draft?: CalendarEventDraft }>(response);
  return data.draft;
}

export async function discardCalendarDraft(
  draftId: string
): Promise<CalendarEventDraft | undefined> {
  const response = await fetch(
    apiUrl(
      `/api/calendar/events/drafts/${encodeURIComponent(draftId)}/discard`
    ),
    { method: "POST" }
  );
  await assertOk(response);
  const data = await safeJson<{ draft?: CalendarEventDraft }>(response);
  return data.draft;
}

export async function createCalendarDraftFromText(
  input: CalendarDraftFromTextInput
): Promise<CalendarDraftFromTextResult> {
  const response = await fetch(apiUrl("/api/calendar/events/draft-from-text"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await assertOk(response);
  return safeJson<CalendarDraftFromTextResult>(response);
}
