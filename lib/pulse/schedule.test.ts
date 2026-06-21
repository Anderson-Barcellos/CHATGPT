import { describe, expect, it } from "vitest";
import { computeNextRunAt, normalizeScheduleInput } from "@/lib/pulse/schedule";

describe("pulse schedule", () => {
  it("schedules a daily run for today when the time is still ahead", () => {
    const schedule = normalizeScheduleInput({
      recurrenceType: "daily",
      time: "18:00",
    });

    expect(computeNextRunAt(schedule, new Date("2026-06-20T19:00:00Z"))).toBe(
      "2026-06-20T21:00:00.000Z"
    );
  });

  it("rolls daily runs to tomorrow when today's time passed", () => {
    const schedule = normalizeScheduleInput({
      recurrenceType: "daily",
      time: "08:00",
    });

    expect(computeNextRunAt(schedule, new Date("2026-06-20T19:00:00Z"))).toBe(
      "2026-06-21T11:00:00.000Z"
    );
  });

  it("schedules weekly runs on the requested weekday", () => {
    const schedule = normalizeScheduleInput({
      recurrenceType: "weekly",
      weekday: 1,
      time: "09:30",
    });

    expect(computeNextRunAt(schedule, new Date("2026-06-20T12:00:00Z"))).toBe(
      "2026-06-22T12:30:00.000Z"
    );
  });

  it("clamps monthly runs to the last day when the target day does not exist", () => {
    const schedule = normalizeScheduleInput({
      recurrenceType: "monthly",
      dayOfMonth: 31,
      time: "10:00",
    });

    expect(computeNextRunAt(schedule, new Date("2026-04-30T18:00:00Z"))).toBe(
      "2026-05-31T13:00:00.000Z"
    );
  });
});
