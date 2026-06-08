import { describe, expect, it } from "vitest";
import {
  CalendarDraftStateError,
  CalendarDraftValidationError,
  normalizeCalendarEventDraftEditInput,
  normalizeCalendarEventDraftInput,
} from "@/lib/calendar/eventDrafts";

describe("calendar event drafts", () => {
  it("normalizes a create draft and derives an end time from duration", () => {
    const draft = normalizeCalendarEventDraftInput(
      {
        action: "create",
        summary: "Consulta",
        start: {
          dateTime: "2026-06-04T15:00:00-03:00",
          timeZone: "America/Sao_Paulo",
        },
        durationMinutes: 45,
        source: "stt",
        attendees: [{ email: " ANDERS@example.com ", displayName: "Anders" }],
      },
      new Date("2026-06-03T12:00:00.000Z")
    );

    expect(draft).toMatchObject({
      action: "create",
      calendarId: "primary",
      summary: "Consulta",
      source: "stt",
      status: "pending",
      attendees: [{ email: "anders@example.com", displayName: "Anders" }],
      createdAt: "2026-06-03T12:00:00.000Z",
    });
    expect(draft.end?.dateTime).toBe("2026-06-04T18:45:00.000Z");
  });

  it("rejects create drafts without a valid time range", () => {
    expect(() =>
      normalizeCalendarEventDraftInput({
        action: "create",
        summary: "Sem horario",
      })
    ).toThrow(CalendarDraftValidationError);
  });

  it("requires eventId for update and cancel drafts", () => {
    expect(() =>
      normalizeCalendarEventDraftInput({
        action: "cancel",
        summary: "Cancelar",
      })
    ).toThrow(/ID do evento/);

    expect(
      normalizeCalendarEventDraftInput({
        action: "update",
        eventId: "evt-1",
        summary: "Novo titulo",
      })
    ).toMatchObject({
      action: "update",
      eventId: "evt-1",
      status: "pending",
    });
  });

  it("edits a pending draft while preserving local metadata", () => {
    const draft = normalizeCalendarEventDraftInput(
      {
        action: "create",
        summary: "Consulta",
        start: { dateTime: "2026-06-04T15:00:00-03:00" },
        durationMinutes: 45,
        source: "stt",
        conversationId: "conv-1",
      },
      new Date("2026-06-03T12:00:00.000Z")
    );

    const updated = normalizeCalendarEventDraftEditInput(
      draft,
      {
        summary: "Consulta cardiologia",
        location: "Clinica",
        description: "",
      },
      new Date("2026-06-03T12:30:00.000Z")
    );

    expect(updated).toMatchObject({
      id: draft.id,
      summary: "Consulta cardiologia",
      location: "Clinica",
      source: "stt",
      conversationId: "conv-1",
      status: "pending",
      createdAt: "2026-06-03T12:00:00.000Z",
      updatedAt: "2026-06-03T12:30:00.000Z",
    });
    expect(updated.description).toBeUndefined();
  });

  it("recalculates the end time when duration changes", () => {
    const draft = normalizeCalendarEventDraftInput(
      {
        action: "create",
        summary: "Consulta",
        start: { dateTime: "2026-06-04T15:00:00-03:00" },
        durationMinutes: 45,
      },
      new Date("2026-06-03T12:00:00.000Z")
    );

    const updated = normalizeCalendarEventDraftEditInput(draft, {
      start: { dateTime: "2026-06-05T10:00:00-03:00" },
      durationMinutes: 30,
    });

    expect(updated.start?.dateTime).toBe("2026-06-05T10:00:00-03:00");
    expect(updated.end?.dateTime).toBe("2026-06-05T13:30:00.000Z");
  });

  it("rejects invalid edit ranges and already handled drafts", () => {
    const draft = normalizeCalendarEventDraftInput({
      action: "create",
      summary: "Consulta",
      start: { dateTime: "2026-06-04T15:00:00-03:00" },
      durationMinutes: 45,
    });

    expect(() =>
      normalizeCalendarEventDraftEditInput(draft, {
        end: { dateTime: "2026-06-04T14:00:00-03:00" },
      })
    ).toThrow(CalendarDraftValidationError);

    expect(() =>
      normalizeCalendarEventDraftEditInput(
        { ...draft, status: "confirmed" },
        { summary: "Nao pode" }
      )
    ).toThrow(CalendarDraftStateError);
  });
});
