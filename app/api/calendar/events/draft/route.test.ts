import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireAppAuthMock = vi.fn();
const createCalendarEventDraftMock = vi.fn();

vi.mock("@/lib/server/routeAuth", () => ({
  requireAppAuth: requireAppAuthMock,
}));

vi.mock("@/lib/calendar/eventDrafts", async () => {
  const actual = await vi.importActual<typeof import("@/lib/calendar/eventDrafts")>(
    "@/lib/calendar/eventDrafts"
  );
  return {
    ...actual,
    createCalendarEventDraft: createCalendarEventDraftMock,
  };
});

describe("/api/calendar/events/draft route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAppAuthMock.mockResolvedValue(null);
  });

  it("creates a local draft without calling Google", async () => {
    createCalendarEventDraftMock.mockResolvedValueOnce({
      id: "draft-1",
      action: "create",
      status: "pending",
      summary: "Consulta",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/calendar/events/draft", {
        method: "POST",
        body: JSON.stringify({
          summary: "Consulta",
          start: { dateTime: "2026-06-04T15:00:00-03:00" },
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(createCalendarEventDraftMock).toHaveBeenCalledWith(
      expect.objectContaining({ summary: "Consulta" })
    );
    await expect(response.json()).resolves.toMatchObject({
      id: "draft-1",
      status: "pending",
    });
  });
});
