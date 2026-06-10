import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientApiError } from "@/lib/api/errors";
import {
  confirmCalendarDraft,
  createCalendarDraftFromText,
  discardCalendarDraft,
  getGoogleIntegrationStatus,
  isGoogleCalendarNotConnectedError,
  listCalendarEvents,
  updateCalendarDraft,
} from "@/lib/calendar/calendarApi";

const fetchMock = vi.fn();

function jsonResponse(payload: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(payload), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("calendarApi client wrappers", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    process.env.NEXT_PUBLIC_BASE_PATH = "/chat";
  });

  it("loads Google integration status through the configured basePath", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        connected: false,
        tokenStoreConfigured: true,
        hasRefreshToken: false,
        defaultCalendarId: "primary",
        oauthConfigured: true,
        redirectUri: "https://ultrassom.ai/chat/api/integrations/google/auth/callback",
      })
    );

    const status = await getGoogleIntegrationStatus();

    expect(fetchMock).toHaveBeenCalledWith(
      "/chat/api/integrations/google/status",
      { cache: "no-store" }
    );
    expect(status.connected).toBe(false);
    expect(status.oauthConfigured).toBe(true);
  });

  it("surfaces not-connected calendar errors as recoverable client errors", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          error: "Google Calendar not connected",
          message: "Google Calendar nao conectado.",
          code: "google_calendar_not_connected",
        },
        { status: 409 }
      )
    );

    let thrown: unknown;
    try {
      await listCalendarEvents();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      status: 409,
      code: "google_calendar_not_connected",
    });
    expect(isGoogleCalendarNotConnectedError(thrown)).toBe(true);
  });

  it("confirms drafts with explicit no-update notifications", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        draft: {
          id: "draft-1",
          action: "create",
          calendarId: "primary",
          summary: "Consulta",
          source: "panel",
          status: "confirmed",
          createdAt: "2026-06-03T12:00:00.000Z",
          updatedAt: "2026-06-03T12:01:00.000Z",
        },
        result: { action: "create", event: { id: "event-1" } },
      })
    );

    const draft = await confirmCalendarDraft("draft-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/chat/api/calendar/events/confirm",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ draftId: "draft-1", sendUpdates: "none" }),
      })
    );
    expect(draft?.status).toBe("confirmed");
  });

  it("creates a local draft from natural-language text", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          draft: {
            id: "draft-voice",
            action: "create",
            calendarId: "primary",
            summary: "Cardio",
            source: "stt",
            status: "pending",
            createdAt: "2026-06-03T12:00:00.000Z",
            updatedAt: "2026-06-03T12:00:00.000Z",
          },
          missingFields: [],
          confidence: "high",
        },
        { status: 201 }
      )
    );

    const result = await createCalendarDraftFromText({
      text: "Marca cardio amanha as 9",
      source: "stt",
      conversationId: "conv-1",
      sourceMessageId: "note-1",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/chat/api/calendar/events/draft-from-text",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          text: "Marca cardio amanha as 9",
          source: "stt",
          conversationId: "conv-1",
          sourceMessageId: "note-1",
        }),
      })
    );
    expect(result.draft.status).toBe("pending");
  });

  it("updates a local pending draft through the configured basePath", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        draft: {
          id: "draft-1",
          action: "create",
          calendarId: "primary",
          summary: "Cardio revisado",
          source: "panel",
          status: "pending",
          createdAt: "2026-06-03T12:00:00.000Z",
          updatedAt: "2026-06-03T12:05:00.000Z",
        },
      })
    );

    const draft = await updateCalendarDraft("draft-1", {
      summary: "Cardio revisado",
      durationMinutes: 30,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/chat/api/calendar/events/drafts/draft-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          summary: "Cardio revisado",
          durationMinutes: 30,
        }),
      })
    );
    expect(draft?.summary).toBe("Cardio revisado");
  });

  it("discards a local pending draft through the configured basePath", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        draft: {
          id: "draft-1",
          action: "create",
          calendarId: "primary",
          summary: "Cardio",
          source: "panel",
          status: "discarded",
          createdAt: "2026-06-03T12:00:00.000Z",
          updatedAt: "2026-06-03T12:05:00.000Z",
        },
      })
    );

    const draft = await discardCalendarDraft("draft-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/chat/api/calendar/events/drafts/draft-1/discard",
      { method: "POST" }
    );
    expect(draft?.status).toBe("discarded");
  });

  it("keeps ApiError shape for unexpected failures", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { error: "Failed", message: "Falha temporaria.", code: "temporary" },
        { status: 503 }
      )
    );

    await expect(listCalendarEvents()).rejects.toBeInstanceOf(ClientApiError);
  });
});
