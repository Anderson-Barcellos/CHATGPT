import { PULSE_TIME_ZONE, PulseSchedule } from "@/lib/pulse/types";

const WEEKDAY_NAMES = [
  "domingo",
  "segunda-feira",
  "terca-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sabado",
];

function cleanTime(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const match = value.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? `${match[1]}:${match[2]}` : undefined;
}

function zonedParts(date: Date, timeZone = PULSE_TIME_ZONE) {
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

  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

function offsetFor(date: Date, timeZone = PULSE_TIME_ZONE): number {
  const parts = zonedParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return asUtc - date.getTime();
}

function zonedDateToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone = PULSE_TIME_ZONE
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  return new Date(guess.getTime() - offsetFor(guess, timeZone));
}

function addDays(parts: ReturnType<typeof zonedParts>, days: number) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function weekdayFor(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function normalizeScheduleInput(input: {
  recurrenceType?: unknown;
  time?: unknown;
  weekday?: unknown;
  dayOfMonth?: unknown;
}): PulseSchedule {
  const type =
    input.recurrenceType === "weekly" || input.recurrenceType === "monthly"
      ? input.recurrenceType
      : "daily";
  const time = cleanTime(input.time);
  if (!time) {
    throw new Error("Horario precisa estar no formato HH:mm.");
  }

  const schedule: PulseSchedule = {
    type,
    time,
    timeZone: PULSE_TIME_ZONE,
  };

  if (type === "weekly") {
    const weekday = Number(input.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      throw new Error("Dia da semana invalido para rotina semanal.");
    }
    schedule.weekday = weekday;
  }

  if (type === "monthly") {
    const dayOfMonth = Number(input.dayOfMonth);
    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
      throw new Error("Dia do mes invalido para rotina mensal.");
    }
    schedule.dayOfMonth = dayOfMonth;
  }

  return schedule;
}

export function computeNextRunAt(
  schedule: PulseSchedule,
  from = new Date()
): string {
  const now = zonedParts(from, schedule.timeZone);
  const [hour, minute] = schedule.time.split(":").map(Number);

  const candidateFor = (year: number, month: number, day: number) =>
    zonedDateToUtc(year, month, day, hour, minute, schedule.timeZone);

  if (schedule.type === "daily") {
    const today = candidateFor(now.year, now.month, now.day);
    if (today.getTime() > from.getTime()) return today.toISOString();
    const tomorrow = addDays(now, 1);
    return candidateFor(tomorrow.year, tomorrow.month, tomorrow.day).toISOString();
  }

  if (schedule.type === "weekly") {
    const target = schedule.weekday ?? 1;
    const todayWeekday = weekdayFor(now.year, now.month, now.day);
    let delta = (target - todayWeekday + 7) % 7;
    let targetDay = addDays(now, delta);
    let candidate = candidateFor(targetDay.year, targetDay.month, targetDay.day);
    if (candidate.getTime() <= from.getTime()) {
      delta += 7;
      targetDay = addDays(now, delta);
      candidate = candidateFor(targetDay.year, targetDay.month, targetDay.day);
    }
    return candidate.toISOString();
  }

  const targetDay = Math.min(
    schedule.dayOfMonth ?? 1,
    daysInMonth(now.year, now.month)
  );
  let candidate = candidateFor(now.year, now.month, targetDay);
  if (candidate.getTime() <= from.getTime()) {
    const nextMonthDate = new Date(Date.UTC(now.year, now.month, 1));
    const year = nextMonthDate.getUTCFullYear();
    const month = nextMonthDate.getUTCMonth() + 1;
    candidate = candidateFor(
      year,
      month,
      Math.min(schedule.dayOfMonth ?? 1, daysInMonth(year, month))
    );
  }
  return candidate.toISOString();
}

export function describeSchedule(schedule: PulseSchedule): string {
  if (schedule.type === "daily") return `Diariamente as ${schedule.time}`;
  if (schedule.type === "weekly") {
    return `${WEEKDAY_NAMES[schedule.weekday ?? 1]} as ${schedule.time}`;
  }
  return `Todo dia ${schedule.dayOfMonth ?? 1} as ${schedule.time}`;
}

export function weekdayOptions() {
  return WEEKDAY_NAMES.map((label, value) => ({ label, value }));
}
