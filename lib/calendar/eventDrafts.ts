import { readDataFile, withDataFileLock, writeDataFile } from "@/lib/server/jsonFileStore";

const FILE_NAME = "calendar-event-drafts.json";
const DEFAULT_CALENDAR_ID = "primary";
const DEFAULT_TIME_ZONE = "America/Sao_Paulo";
const DEFAULT_EVENT_DURATION_MINUTES = 60;

export type CalendarDraftAction = "create" | "update" | "cancel";
export type CalendarDraftSource = "chat" | "panel" | "stt";
export type CalendarDraftStatus = "pending" | "confirmed" | "discarded" | "failed";

export interface CalendarDateTime {
  dateTime: string;
  timeZone: string;
}

export interface CalendarDraftAttendee {
  email: string;
  displayName?: string;
}

export interface CalendarEventDraft {
  id: string;
  action: CalendarDraftAction;
  calendarId: string;
  eventId?: string;
  summary: string;
  description?: string;
  location?: string;
  start?: CalendarDateTime;
  end?: CalendarDateTime;
  attendees?: CalendarDraftAttendee[];
  source: CalendarDraftSource;
  conversationId?: string;
  sourceMessageId?: string;
  status: CalendarDraftStatus;
  googleEventId?: string;
  failureMessage?: string;
  confirmedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEventDraftInput {
  action?: unknown;
  calendarId?: unknown;
  eventId?: unknown;
  summary?: unknown;
  description?: unknown;
  location?: unknown;
  start?: unknown;
  end?: unknown;
  durationMinutes?: unknown;
  attendees?: unknown;
  source?: unknown;
  conversationId?: unknown;
  sourceMessageId?: unknown;
}

export interface CalendarEventDraftEditInput {
  summary?: unknown;
  description?: unknown;
  location?: unknown;
  start?: unknown;
  end?: unknown;
  durationMinutes?: unknown;
}

export class CalendarDraftValidationError extends Error {
  code: string;

  constructor(message: string, code = "invalid_calendar_draft") {
    super(message);
    this.name = "CalendarDraftValidationError";
    this.code = code;
  }
}

export class CalendarDraftStateError extends Error {
  code: string;

  constructor(message: string, code = "calendar_draft_not_pending") {
    super(message);
    this.name = "CalendarDraftStateError";
    this.code = code;
  }
}

function defaultTimeZone(): string {
  return process.env.GOOGLE_CALENDAR_DEFAULT_TIME_ZONE?.trim() || DEFAULT_TIME_ZONE;
}

export function defaultCalendarId(): string {
  return process.env.GOOGLE_CALENDAR_DEFAULT_ID?.trim() || DEFAULT_CALENDAR_ID;
}

function cleanString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function parseAction(value: unknown): CalendarDraftAction {
  if (value === "create" || value === "update" || value === "cancel") {
    return value;
  }

  return "create";
}

function parseSource(value: unknown): CalendarDraftSource {
  if (value === "chat" || value === "panel" || value === "stt") {
    return value;
  }

  return "panel";
}

function parseDateTime(value: unknown): CalendarDateTime | undefined {
  if (!value || typeof value !== "object") return undefined;

  const raw = value as { dateTime?: unknown; timeZone?: unknown };
  const dateTime = cleanString(raw.dateTime);
  if (!dateTime) return undefined;

  const parsed = new Date(dateTime);
  if (Number.isNaN(parsed.getTime())) {
    throw new CalendarDraftValidationError(
      "Data/hora invalida para o rascunho de agenda.",
      "invalid_calendar_datetime"
    );
  }

  return {
    dateTime,
    timeZone: cleanString(raw.timeZone) || defaultTimeZone(),
  };
}

function parseDurationMinutes(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  if (value <= 0 || value > 24 * 60) {
    throw new CalendarDraftValidationError(
      "Duracao do evento precisa ficar entre 1 minuto e 24 horas.",
      "invalid_calendar_duration"
    );
  }

  return Math.round(value);
}

function endFromDuration(
  start: CalendarDateTime | undefined,
  durationMinutes: number | undefined
): CalendarDateTime | undefined {
  if (!start || !durationMinutes) return undefined;

  const startDate = new Date(start.dateTime);
  return {
    dateTime: new Date(startDate.getTime() + durationMinutes * 60_000).toISOString(),
    timeZone: start.timeZone,
  };
}

function compareDateTimes(
  start: CalendarDateTime | undefined,
  end: CalendarDateTime | undefined
): void {
  if (!start || !end) return;

  const startMs = new Date(start.dateTime).getTime();
  const endMs = new Date(end.dateTime).getTime();

  if (endMs <= startMs) {
    throw new CalendarDraftValidationError(
      "Fim do evento precisa ser posterior ao inicio.",
      "invalid_calendar_range"
    );
  }
}

function parseAttendees(value: unknown): CalendarDraftAttendee[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const attendees = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const raw = item as { email?: unknown; displayName?: unknown };
      const email = cleanString(raw.email)?.toLowerCase();
      if (!email || !email.includes("@")) return null;
      return {
        email,
        ...(cleanString(raw.displayName)
          ? { displayName: cleanString(raw.displayName) }
          : {}),
      };
    })
    .filter((item): item is CalendarDraftAttendee => item !== null);

  return attendees.length > 0 ? attendees : undefined;
}

function parsePersistedDraft(value: unknown): CalendarEventDraft | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<CalendarEventDraft>;

  if (
    typeof raw.id !== "string" ||
    (raw.action !== "create" && raw.action !== "update" && raw.action !== "cancel") ||
    typeof raw.calendarId !== "string" ||
    typeof raw.summary !== "string" ||
    (raw.status !== "pending" &&
      raw.status !== "confirmed" &&
      raw.status !== "discarded" &&
      raw.status !== "failed") ||
    (raw.source !== "chat" && raw.source !== "panel" && raw.source !== "stt") ||
    typeof raw.createdAt !== "string" ||
    typeof raw.updatedAt !== "string"
  ) {
    return null;
  }

  return raw as CalendarEventDraft;
}

export function normalizeCalendarEventDraftInput(
  input: CalendarEventDraftInput,
  now = new Date()
): CalendarEventDraft {
  const action = parseAction(input.action);
  const eventId = cleanString(input.eventId);
  const start = parseDateTime(input.start);
  const explicitEnd = parseDateTime(input.end);
  const durationMinutes =
    parseDurationMinutes(input.durationMinutes) ?? DEFAULT_EVENT_DURATION_MINUTES;
  const end = explicitEnd ?? endFromDuration(start, durationMinutes);
  const summary =
    cleanString(input.summary) ||
    (action === "cancel" ? "Cancelar evento" : undefined);

  if (!summary) {
    throw new CalendarDraftValidationError(
      "Titulo do evento e obrigatorio.",
      "calendar_summary_required"
    );
  }

  if (action === "create" && (!start || !end)) {
    throw new CalendarDraftValidationError(
      "Rascunho de criacao precisa de inicio e fim.",
      "calendar_time_required"
    );
  }

  if ((action === "update" || action === "cancel") && !eventId) {
    throw new CalendarDraftValidationError(
      "Rascunho de alteracao/cancelamento precisa do ID do evento.",
      "calendar_event_id_required"
    );
  }

  compareDateTimes(start, end);

  const timestamp = now.toISOString();
  return {
    id: crypto.randomUUID(),
    action,
    calendarId: cleanString(input.calendarId) || defaultCalendarId(),
    ...(eventId ? { eventId } : {}),
    summary,
    ...(cleanString(input.description)
      ? { description: cleanString(input.description) }
      : {}),
    ...(cleanString(input.location) ? { location: cleanString(input.location) } : {}),
    ...(start ? { start } : {}),
    ...(end ? { end } : {}),
    ...(parseAttendees(input.attendees)
      ? { attendees: parseAttendees(input.attendees) }
      : {}),
    source: parseSource(input.source),
    ...(cleanString(input.conversationId)
      ? { conversationId: cleanString(input.conversationId) }
      : {}),
    ...(cleanString(input.sourceMessageId)
      ? { sourceMessageId: cleanString(input.sourceMessageId) }
      : {}),
    status: "pending",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function hasOwn(object: CalendarEventDraftEditInput, key: keyof CalendarEventDraftEditInput) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

type EditableDraftField = "summary" | "description" | "location" | "start" | "end";

function editableValue<T extends EditableDraftField>(
  draft: CalendarEventDraft,
  input: CalendarEventDraftEditInput,
  key: T
): CalendarEventDraftEditInput[T] | CalendarEventDraft[T] {
  return hasOwn(input, key) ? input[key] : draft[key];
}

export function normalizeCalendarEventDraftEditInput(
  draft: CalendarEventDraft,
  input: CalendarEventDraftEditInput,
  now = new Date()
): CalendarEventDraft {
  if (draft.status !== "pending") {
    throw new CalendarDraftStateError("Apenas rascunhos pendentes podem ser editados.");
  }

  const shouldRecalculateEnd = hasOwn(input, "durationMinutes") && !hasOwn(input, "end");
  const normalized = normalizeCalendarEventDraftInput(
    {
      action: draft.action,
      calendarId: draft.calendarId,
      eventId: draft.eventId,
      summary: editableValue(draft, input, "summary"),
      description: editableValue(draft, input, "description"),
      location: editableValue(draft, input, "location"),
      start: editableValue(draft, input, "start"),
      ...(shouldRecalculateEnd
        ? {}
        : { end: editableValue(draft, input, "end") }),
      durationMinutes: hasOwn(input, "durationMinutes")
        ? input.durationMinutes
        : undefined,
      attendees: draft.attendees,
      source: draft.source,
      conversationId: draft.conversationId,
      sourceMessageId: draft.sourceMessageId,
    },
    now
  );

  return {
    id: draft.id,
    action: normalized.action,
    calendarId: normalized.calendarId,
    ...(normalized.eventId ? { eventId: normalized.eventId } : {}),
    summary: normalized.summary,
    ...(normalized.description ? { description: normalized.description } : {}),
    ...(normalized.location ? { location: normalized.location } : {}),
    ...(normalized.start ? { start: normalized.start } : {}),
    ...(normalized.end ? { end: normalized.end } : {}),
    ...(normalized.attendees ? { attendees: normalized.attendees } : {}),
    source: draft.source,
    ...(draft.conversationId ? { conversationId: draft.conversationId } : {}),
    ...(draft.sourceMessageId ? { sourceMessageId: draft.sourceMessageId } : {}),
    status: "pending",
    createdAt: draft.createdAt,
    updatedAt: now.toISOString(),
  };
}

async function readAllDrafts(): Promise<CalendarEventDraft[]> {
  const parsed = await readDataFile(FILE_NAME, [] as unknown[]);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map(parsePersistedDraft)
    .filter((draft): draft is CalendarEventDraft => draft !== null);
}

async function writeAllDrafts(drafts: CalendarEventDraft[]): Promise<void> {
  await writeDataFile(FILE_NAME, drafts);
}

export async function listCalendarEventDrafts(
  status?: CalendarDraftStatus
): Promise<CalendarEventDraft[]> {
  const drafts = await readAllDrafts();
  return status ? drafts.filter((draft) => draft.status === status) : drafts;
}

export async function getCalendarEventDraft(
  id: string
): Promise<CalendarEventDraft | undefined> {
  const drafts = await readAllDrafts();
  return drafts.find((draft) => draft.id === id);
}

export function createCalendarEventDraft(
  input: CalendarEventDraftInput
): Promise<CalendarEventDraft> {
  return withDataFileLock(FILE_NAME, async () => {
    const drafts = await readAllDrafts();
    const draft = normalizeCalendarEventDraftInput(input);
    drafts.unshift(draft);
    await writeAllDrafts(drafts);
    return draft;
  });
}

export function updateCalendarEventDraft(
  id: string,
  updates: Partial<
    Pick<
      CalendarEventDraft,
      "status" | "googleEventId" | "failureMessage" | "confirmedAt"
    >
  >
): Promise<CalendarEventDraft | undefined> {
  return withDataFileLock(FILE_NAME, async () => {
    const drafts = await readAllDrafts();
    const index = drafts.findIndex((draft) => draft.id === id);
    if (index === -1) return undefined;

    const updated: CalendarEventDraft = {
      ...drafts[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    drafts[index] = updated;
    await writeAllDrafts(drafts);
    return updated;
  });
}

export function editPendingCalendarEventDraft(
  id: string,
  input: CalendarEventDraftEditInput
): Promise<CalendarEventDraft | undefined> {
  return withDataFileLock(FILE_NAME, async () => {
    const drafts = await readAllDrafts();
    const index = drafts.findIndex((draft) => draft.id === id);
    if (index === -1) return undefined;

    const updated = normalizeCalendarEventDraftEditInput(drafts[index], input);
    drafts[index] = updated;
    await writeAllDrafts(drafts);
    return updated;
  });
}

export function discardPendingCalendarEventDraft(
  id: string
): Promise<CalendarEventDraft | undefined> {
  return withDataFileLock(FILE_NAME, async () => {
    const drafts = await readAllDrafts();
    const index = drafts.findIndex((draft) => draft.id === id);
    if (index === -1) return undefined;

    const draft = drafts[index];
    if (draft.status !== "pending") {
      throw new CalendarDraftStateError(
        "Apenas rascunhos pendentes podem ser descartados."
      );
    }

    const updated: CalendarEventDraft = {
      ...draft,
      status: "discarded",
      updatedAt: new Date().toISOString(),
    };

    drafts[index] = updated;
    await writeAllDrafts(drafts);
    return updated;
  });
}
