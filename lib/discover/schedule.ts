import type { DiscoverState } from "./types";

export const DISCOVER_TIME_ZONE = "America/Sao_Paulo";
const SCHEDULE_HOUR = 8;

interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function zonedParts(date: Date, timeZone = DISCOVER_TIME_ZONE): ZonedDateParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: value("year"), month: value("month"), day: value("day"),
    hour: value("hour"), minute: value("minute"), second: value("second"),
  };
}

function offsetFor(date: Date, timeZone = DISCOVER_TIME_ZONE): number {
  const parts = zonedParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

function zonedDateToUtc(year: number, month: number, day: number, hour = SCHEDULE_HOUR): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, 0, 0, 0));
  return new Date(guess.getTime() - offsetFor(guess));
}

function addCivilDays({ year, month, day }: Pick<ZonedDateParts, "year" | "month" | "day">, days: number) {
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function parseCivilDate(value: string | undefined) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

function nextPassageAt(now: Date): Date {
  const local = zonedParts(now);
  const today = zonedDateToUtc(local.year, local.month, local.day);
  if (today.getTime() > now.getTime()) return today;
  const tomorrow = addCivilDays(local, 1);
  return zonedDateToUtc(tomorrow.year, tomorrow.month, tomorrow.day);
}

export function nextDiscoverScheduledAt(
  schedule: DiscoverState["schedule"],
  lastDailyDate: string | undefined,
  now = new Date()
): string | null {
  if (!schedule.enabled) return null;
  const last = parseCivilDate(lastDailyDate);
  if (!last) return nextPassageAt(now).toISOString();
  const dueDate = addCivilDays(last, 2);
  const dueAt = zonedDateToUtc(dueDate.year, dueDate.month, dueDate.day);
  return (dueAt.getTime() > now.getTime() ? dueAt : nextPassageAt(now)).toISOString();
}

export function isDiscoverDailyDue(lastDailyDate: string | undefined, now = new Date()): boolean {
  const local = zonedParts(now);
  const todayAt = zonedDateToUtc(local.year, local.month, local.day);
  if (now.getTime() < todayAt.getTime()) return false;
  const last = parseCivilDate(lastDailyDate);
  if (!last) return true;
  const dueDate = addCivilDays(last, 2);
  return zonedDateToUtc(dueDate.year, dueDate.month, dueDate.day).getTime() <= now.getTime();
}
