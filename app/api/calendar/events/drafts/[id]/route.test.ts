import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  class MockCalendarDraftStateError extends Error {
    code: string;

    constructor(message: string, code = "calendar_draft_not_pending") {
      super(message);
      this.code = code;
    }
  }

  class MockCalendarDraftValidationError extends Error {
    code: string;

    constructor(message: string, code = "invalid_calendar_draft") {
      super(message);
      this.code = code;
    }
  }

  return {
    requireAppAuth: vi.fn(),
    editPendingCalendarEventDraft: vi.fn(),
    MockCalendarDraftStateError,
    MockCalendarDraftValidationError,
  };
});

vi.mock("@/lib/server/routeAuth", () => ({
  requireAppAuth: mocks.requireAppAuth,
}));

vi.mock("@/lib/calendar/eventDrafts", () => ({
  editPendingCalendarEventDraft: mocks.editPendingCalendarEventDraft,
  CalendarDraftStateError: mocks.MockCalendarDraftStateError,
  CalendarDraftValidationError: mocks.MockCalendarDraftValidationError,
}));

describe("/api/calendar/events/drafts/[id] route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireAppAuth.mockResolvedValue(null);
  });

  it("updates a pending draft locally", async () => {
    mocks.editPendingCalendarEventDraft.mockResolvedValueOnce({
      id: "draft-1",
      status: "pending",
      summary: "Consulta revisada",
    });

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new NextRequest("http://localhost/api/calendar/events/drafts/draft-1", {
        method: "PATCH",
        body: JSON.stringify({ summary: "Consulta revisada" }),
      }),
      { params: Promise.resolve({ id: "draft-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.editPendingCalendarEventDraft).toHaveBeenCalledWith("draft-1", {
      summary: "Consulta revisada",
    });
    await expect(response.json()).resolves.toMatchObject({
      draft: { id: "draft-1", status: "pending" },
    });
  });

  it("returns 404 when the draft does not exist", async () => {
    mocks.editPendingCalendarEventDraft.mockResolvedValueOnce(undefined);

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new NextRequest("http://localhost/api/calendar/events/drafts/missing", {
        method: "PATCH",
        body: JSON.stringify({ summary: "Consulta" }),
      }),
      { params: Promise.resolve({ id: "missing" }) }
    );

    expect(response.status).toBe(404);
  });

  it("returns 409 when the draft is already handled", async () => {
    mocks.editPendingCalendarEventDraft.mockRejectedValueOnce(
      new mocks.MockCalendarDraftStateError("Apenas pendentes.")
    );

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new NextRequest("http://localhost/api/calendar/events/drafts/draft-1", {
        method: "PATCH",
        body: JSON.stringify({ summary: "Consulta" }),
      }),
      { params: Promise.resolve({ id: "draft-1" }) }
    );

    expect(response.status).toBe(409);
  });

  it("returns 400 for invalid draft edits", async () => {
    mocks.editPendingCalendarEventDraft.mockRejectedValueOnce(
      new mocks.MockCalendarDraftValidationError(
        "Fim do evento precisa ser posterior ao inicio.",
        "invalid_calendar_range"
      )
    );

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new NextRequest("http://localhost/api/calendar/events/drafts/draft-1", {
        method: "PATCH",
        body: JSON.stringify({ durationMinutes: -1 }),
      }),
      { params: Promise.resolve({ id: "draft-1" }) }
    );

    expect(response.status).toBe(400);
  });
});
