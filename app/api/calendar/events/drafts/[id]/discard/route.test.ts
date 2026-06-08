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

  return {
    requireAppAuth: vi.fn(),
    discardPendingCalendarEventDraft: vi.fn(),
    MockCalendarDraftStateError,
  };
});

vi.mock("@/lib/server/routeAuth", () => ({
  requireAppAuth: mocks.requireAppAuth,
}));

vi.mock("@/lib/calendar/eventDrafts", () => ({
  discardPendingCalendarEventDraft: mocks.discardPendingCalendarEventDraft,
  CalendarDraftStateError: mocks.MockCalendarDraftStateError,
}));

describe("/api/calendar/events/drafts/[id]/discard route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireAppAuth.mockResolvedValue(null);
  });

  it("marks a pending draft as discarded locally", async () => {
    mocks.discardPendingCalendarEventDraft.mockResolvedValueOnce({
      id: "draft-1",
      status: "discarded",
      summary: "Consulta",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/calendar/events/drafts/draft-1/discard", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "draft-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.discardPendingCalendarEventDraft).toHaveBeenCalledWith("draft-1");
    await expect(response.json()).resolves.toMatchObject({
      draft: { id: "draft-1", status: "discarded" },
    });
  });

  it("returns 404 when the draft does not exist", async () => {
    mocks.discardPendingCalendarEventDraft.mockResolvedValueOnce(undefined);

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/calendar/events/drafts/missing/discard", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "missing" }) }
    );

    expect(response.status).toBe(404);
  });

  it("returns 409 when the draft is already handled", async () => {
    mocks.discardPendingCalendarEventDraft.mockRejectedValueOnce(
      new mocks.MockCalendarDraftStateError("Apenas pendentes.")
    );

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/calendar/events/drafts/draft-1/discard", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "draft-1" }) }
    );

    expect(response.status).toBe(409);
  });
});
