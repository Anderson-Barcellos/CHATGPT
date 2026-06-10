import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { CalendarDraftExtractionError } from "@/lib/calendar/naturalLanguageDraft";

const mocks = vi.hoisted(() => ({
  requireAppAuthMock: vi.fn(),
  createCalendarDraftFromNaturalLanguageMock: vi.fn(),
}));

vi.mock("@/lib/server/routeAuth", () => ({
  requireAppAuth: mocks.requireAppAuthMock,
}));

vi.mock("@/lib/calendar/naturalLanguageDraft", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/calendar/naturalLanguageDraft")
  >("@/lib/calendar/naturalLanguageDraft");
  return {
    ...actual,
    createCalendarDraftFromNaturalLanguage:
      mocks.createCalendarDraftFromNaturalLanguageMock,
  };
});

describe("/api/calendar/events/draft-from-text route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireAppAuthMock.mockResolvedValue(null);
  });

  it("creates only a local calendar draft from text", async () => {
    mocks.createCalendarDraftFromNaturalLanguageMock.mockResolvedValueOnce({
      draft: {
        id: "draft-1",
        action: "create",
        calendarId: "primary",
        summary: "Consulta cardio",
        source: "chat",
        status: "pending",
        createdAt: "2026-06-03T12:00:00.000Z",
        updatedAt: "2026-06-03T12:00:00.000Z",
      },
      missingFields: [],
      confidence: "high",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/calendar/events/draft-from-text", {
        method: "POST",
        body: JSON.stringify({
          text: "Marca cardio amanha as 9",
          source: "chat",
          sourceMessageId: "msg-1",
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(mocks.createCalendarDraftFromNaturalLanguageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Marca cardio amanha as 9",
        source: "chat",
      })
    );
    await expect(response.json()).resolves.toMatchObject({
      draft: { id: "draft-1", status: "pending" },
      confidence: "high",
    });
  });

  it("returns recoverable missing-field errors", async () => {
    mocks.createCalendarDraftFromNaturalLanguageMock.mockRejectedValueOnce(
      new CalendarDraftExtractionError(
        "Faltam dados para criar um rascunho de agenda confiavel.",
        "calendar_draft_incomplete",
        422,
        ["horario"]
      )
    );

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/calendar/events/draft-from-text", {
        method: "POST",
        body: JSON.stringify({ text: "Tenho consulta algum dia" }),
      })
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      code: "calendar_draft_incomplete",
      message: expect.stringContaining("horario"),
    });
  });
});
