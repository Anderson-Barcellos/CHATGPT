import { parseApiErrorResponse } from "@/lib/api/errors";
import { apiUrl } from "@/lib/utils";

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
  title?: string;
  body: string;
  source?: WorkspaceNoteSource;
  conversationId?: string;
  sourceMessageId?: string;
  calendarEventId?: string;
  tags?: string[];
}

export interface WorkspaceNoteFilters {
  source?: WorkspaceNoteSource;
  conversationId?: string;
  calendarEventId?: string;
}

async function safeJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return (text ? JSON.parse(text) : {}) as T;
}

async function assertOk(response: Response): Promise<void> {
  if (!response.ok) {
    throw await parseApiErrorResponse(response);
  }
}

export async function listWorkspaceNotes(
  filters: WorkspaceNoteFilters = {}
): Promise<WorkspaceNote[]> {
  const params = new URLSearchParams();
  if (filters.source) params.set("source", filters.source);
  if (filters.conversationId) params.set("conversationId", filters.conversationId);
  if (filters.calendarEventId) params.set("calendarEventId", filters.calendarEventId);

  const query = params.toString();
  const response = await fetch(
    apiUrl(`/api/workspace-notes${query ? `?${query}` : ""}`),
    { cache: "no-store" }
  );
  await assertOk(response);
  const data = await safeJson<{ notes?: WorkspaceNote[] }>(response);
  return Array.isArray(data.notes) ? data.notes : [];
}

export async function createWorkspaceNote(
  input: WorkspaceNoteInput
): Promise<WorkspaceNote> {
  const response = await fetch(apiUrl("/api/workspace-notes"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await assertOk(response);
  return safeJson<WorkspaceNote>(response);
}

export async function deleteWorkspaceNote(id: string): Promise<void> {
  const response = await fetch(apiUrl(`/api/workspace-notes/${id}`), {
    method: "DELETE",
  });
  await assertOk(response);
}
