import { readDataFile, withDataFileLock, writeDataFile } from "@/lib/server/jsonFileStore";

const FILE_NAME = "workspace-notes.json";

export type WorkspaceNoteSource = "manual" | "chat" | "stt" | "calendar";

export interface WorkspaceNote {
  id: string;
  title: string;
  body: string;
  source: WorkspaceNoteSource;
  conversationId?: string;
  sourceMessageId?: string;
  calendarEventId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceNoteInput {
  title?: unknown;
  body?: unknown;
  source?: unknown;
  conversationId?: unknown;
  sourceMessageId?: unknown;
  calendarEventId?: unknown;
  tags?: unknown;
}

export class WorkspaceNoteValidationError extends Error {
  code: string;

  constructor(message: string, code = "invalid_workspace_note") {
    super(message);
    this.name = "WorkspaceNoteValidationError";
    this.code = code;
  }
}

function cleanString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function parseSource(value: unknown): WorkspaceNoteSource {
  if (value === "chat" || value === "stt" || value === "calendar") {
    return value;
  }

  return "manual";
}

function parseTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item.length > 0)
    )
  ).slice(0, 20);
}

function titleFromBody(body: string): string {
  const firstLine = body.split(/\r?\n/).find((line) => line.trim().length > 0);
  if (!firstLine) return "Nota sem titulo";
  return firstLine.trim().slice(0, 80);
}

function parsePersistedNote(value: unknown): WorkspaceNote | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<WorkspaceNote>;

  if (
    typeof raw.id !== "string" ||
    typeof raw.title !== "string" ||
    typeof raw.body !== "string" ||
    (raw.source !== "manual" &&
      raw.source !== "chat" &&
      raw.source !== "stt" &&
      raw.source !== "calendar") ||
    !Array.isArray(raw.tags) ||
    typeof raw.createdAt !== "string" ||
    typeof raw.updatedAt !== "string"
  ) {
    return null;
  }

  return {
    ...raw,
    tags: raw.tags.filter((tag): tag is string => typeof tag === "string"),
  } as WorkspaceNote;
}

export function normalizeWorkspaceNoteInput(
  input: WorkspaceNoteInput,
  now = new Date()
): WorkspaceNote {
  const body = cleanString(input.body);
  if (!body) {
    throw new WorkspaceNoteValidationError(
      "Corpo da nota e obrigatorio.",
      "workspace_note_body_required"
    );
  }

  const timestamp = now.toISOString();
  return {
    id: crypto.randomUUID(),
    title: cleanString(input.title) || titleFromBody(body),
    body,
    source: parseSource(input.source),
    ...(cleanString(input.conversationId)
      ? { conversationId: cleanString(input.conversationId) }
      : {}),
    ...(cleanString(input.sourceMessageId)
      ? { sourceMessageId: cleanString(input.sourceMessageId) }
      : {}),
    ...(cleanString(input.calendarEventId)
      ? { calendarEventId: cleanString(input.calendarEventId) }
      : {}),
    tags: parseTags(input.tags),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

async function readAllNotes(): Promise<WorkspaceNote[]> {
  const parsed = await readDataFile(FILE_NAME, [] as unknown[]);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map(parsePersistedNote)
    .filter((note): note is WorkspaceNote => note !== null);
}

async function writeAllNotes(notes: WorkspaceNote[]): Promise<void> {
  await writeDataFile(FILE_NAME, notes);
}

export async function listWorkspaceNotes(filters: {
  source?: WorkspaceNoteSource;
  conversationId?: string;
  calendarEventId?: string;
} = {}): Promise<WorkspaceNote[]> {
  const notes = await readAllNotes();
  return notes.filter((note) => {
    if (filters.source && note.source !== filters.source) return false;
    if (filters.conversationId && note.conversationId !== filters.conversationId) {
      return false;
    }
    if (filters.calendarEventId && note.calendarEventId !== filters.calendarEventId) {
      return false;
    }
    return true;
  });
}

export function createWorkspaceNote(input: WorkspaceNoteInput): Promise<WorkspaceNote> {
  return withDataFileLock(FILE_NAME, async () => {
    const notes = await readAllNotes();
    const note = normalizeWorkspaceNoteInput(input);
    notes.unshift(note);
    await writeAllNotes(notes);
    return note;
  });
}

export function updateWorkspaceNote(
  id: string,
  input: Partial<WorkspaceNoteInput>
): Promise<WorkspaceNote | undefined> {
  return withDataFileLock(FILE_NAME, async () => {
    const notes = await readAllNotes();
    const index = notes.findIndex((note) => note.id === id);
    if (index === -1) return undefined;

    const current = notes[index];
    const body = cleanString(input.body) ?? current.body;
    const title = cleanString(input.title) ?? current.title;
    const source = input.source === undefined ? current.source : parseSource(input.source);

    if (!body) {
      throw new WorkspaceNoteValidationError(
        "Corpo da nota e obrigatorio.",
        "workspace_note_body_required"
      );
    }

    const updated: WorkspaceNote = {
      ...current,
      title,
      body,
      source,
      ...(input.conversationId !== undefined
        ? { conversationId: cleanString(input.conversationId) }
        : {}),
      ...(input.sourceMessageId !== undefined
        ? { sourceMessageId: cleanString(input.sourceMessageId) }
        : {}),
      ...(input.calendarEventId !== undefined
        ? { calendarEventId: cleanString(input.calendarEventId) }
        : {}),
      ...(input.tags !== undefined ? { tags: parseTags(input.tags) } : {}),
      updatedAt: new Date().toISOString(),
    };

    notes[index] = updated;
    await writeAllNotes(notes);
    return updated;
  });
}

export function deleteWorkspaceNote(id: string): Promise<boolean> {
  return withDataFileLock(FILE_NAME, async () => {
    const notes = await readAllNotes();
    const filtered = notes.filter((note) => note.id !== id);
    if (filtered.length === notes.length) return false;
    await writeAllNotes(filtered);
    return true;
  });
}
