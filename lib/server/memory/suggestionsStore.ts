import type {
  MemorySuggestion,
  MemorySuggestionStatus,
  SerializedMemorySuggestion,
} from "@/types";
import {
  readDataFile,
  withDataFileLock,
  writeDataFile,
} from "@/lib/server/jsonFileStore";

const FILE_NAME = "memory-suggestions.json";

function normalizeDate(value: Date | string | undefined): Date {
  if (value instanceof Date) return value;
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function serializeMemorySuggestion(
  suggestion: MemorySuggestion
): SerializedMemorySuggestion {
  return {
    ...suggestion,
    createdAt: normalizeDate(suggestion.createdAt).toISOString(),
    updatedAt: normalizeDate(suggestion.updatedAt).toISOString(),
  };
}

export function deserializeMemorySuggestion(
  suggestion: SerializedMemorySuggestion | MemorySuggestion
): MemorySuggestion {
  return {
    ...suggestion,
    createdAt: normalizeDate(suggestion.createdAt),
    updatedAt: normalizeDate(suggestion.updatedAt),
  };
}

async function readAll(): Promise<MemorySuggestion[]> {
  const parsed = await readDataFile(FILE_NAME, [] as unknown[]);
  if (!Array.isArray(parsed)) return [];
  return parsed.map((item) =>
    deserializeMemorySuggestion(item as SerializedMemorySuggestion)
  );
}

async function writeAll(suggestions: MemorySuggestion[]) {
  await writeDataFile(
    FILE_NAME,
    suggestions.map((suggestion) => serializeMemorySuggestion(suggestion))
  );
}

export async function listMemorySuggestions(
  status?: MemorySuggestionStatus
): Promise<MemorySuggestion[]> {
  const suggestions = await readAll();
  return status
    ? suggestions.filter((suggestion) => suggestion.status === status)
    : suggestions;
}

export function createMemorySuggestions(
  inputs: Array<
    Omit<MemorySuggestion, "id" | "status" | "createdAt" | "updatedAt">
  >
): Promise<MemorySuggestion[]> {
  return withDataFileLock(FILE_NAME, async () => {
    const suggestions = await readAll();
    const now = new Date();
    const existingPending = new Set(
      suggestions
        .filter((suggestion) => suggestion.status === "pending")
        .map((suggestion) => suggestion.content.trim().toLowerCase())
    );

    const created = inputs
      .filter((input) => !existingPending.has(input.content.trim().toLowerCase()))
      .map((input) => ({
        ...input,
        id: crypto.randomUUID(),
        status: "pending" as const,
        createdAt: now,
        updatedAt: now,
      }));

    if (created.length === 0) return [];

    await writeAll([...created, ...suggestions]);
    return created;
  });
}

export function updateMemorySuggestionStatus(
  id: string,
  status: MemorySuggestionStatus
): Promise<MemorySuggestion | undefined> {
  return withDataFileLock(FILE_NAME, async () => {
    const suggestions = await readAll();
    const index = suggestions.findIndex((suggestion) => suggestion.id === id);
    if (index === -1) return undefined;

    const updated: MemorySuggestion = {
      ...suggestions[index],
      status,
      updatedAt: new Date(),
    };
    suggestions[index] = updated;
    await writeAll(suggestions);
    return updated;
  });
}
