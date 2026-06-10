import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  class MockGoogleCalendarApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }

  class MockGoogleCalendarConnectionError extends Error {}

  return {
    requireAppAuth: vi.fn(),
    getCalendarEventDraft: vi.fn(),
    updateCalendarEventDraft: vi.fn(),
    confirmGoogleCalendarDraft: vi.fn(),
    MockGoogleCalendarApiError,
    MockGoogleCalendarConnectionError,
  };
});

vi.mock("@/lib/server/routeAuth", () => ({
  requireAppAuth: mocks.requireAppAuth,
}));

vi.mock("@/lib/calendar/eventDrafts", () => ({
  getCalendarEventDraft: mocks.getCalendarEventDraft,
  updateCalendarEventDraft: mocks.updateCalendarEventDraft,
}));

vi.mock("@/lib/google/calendarClient", () => ({
  confirmGoogleCalendarDraft: mocks.confirmGoogleCalendarDraft,
  GoogleCalendarApiError: mocks.MockGoogleCalendarApiError,
  GoogleCalendarConnectionError: mocks.MockGoogleCalendarConnectionError,
}));

describe("/api/calendar/events/confirm route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireAppAuth.mockResolvedValue(null);
  });

  it("rejects drafts that are not pending", async () => {
    mocks.getCalendarEventDraft.mockResolvedValueOnce({
      id: "draft-1",
      status: "confirmed",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/calendar/events/confirm", {
        method: "POST",
        body: JSON.stringify({ draftId: "draft-1" }),
      })
    );

    expect(response.status).toBe(409);
    expect(mocks.confirmGoogleCalendarDraft).not.toHaveBeenCalled();
  });

  it("marks a draft as failed when Google returns an upstream error", async () => {
    mocks.getCalendarEventDraft.mockResolvedValueOnce({
      id: "draft-1",
      action: "create",
      status: "pending",
      summary: "Consulta",
      calendarId: "primary",
    });
    mocks.confirmGoogleCalendarDraft.mockRejectedValueOnce(
      new mocks.MockGoogleCalendarApiError("upstream failed", 500)
    );

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/calendar/events/confirm", {
        method: "POST",
        body: JSON.stringify({ draftId: "draft-1" }),
      })
    );

    expect(response.status).toBe(502);
    expect(mocks.updateCalendarEventDraft).toHaveBeenCalledWith("draft-1", {
      status: "failed",
      failureMessage: "upstream failed",
    });
  });
});
