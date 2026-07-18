import { ClientApiError, parseApiErrorResponse } from "@/lib/api/errors";
import { apiUrl } from "@/lib/utils";
import type {
  PulseModel,
  PulseRecurrenceType,
  PulseRun,
  PulseTask,
  PulseTaskProposal,
} from "@/lib/pulse/types";

export type PulseTaskStatusUpdate = "active" | "paused";

export interface PulseTaskCreatePayload {
  title: string;
  emoji?: string;
  prompt: string;
  executionPrompt?: string;
  model?: PulseModel;
  recurrenceType: PulseRecurrenceType;
  time: string;
  weekday?: number;
  dayOfMonth?: number;
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

export function readablePulseError(error: unknown, fallback: string): string {
  if (error instanceof ClientApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export async function listPulseTasks(): Promise<PulseTask[]> {
  const response = await fetch(apiUrl("/api/pulse/tasks"), { cache: "no-store" });
  await assertOk(response);
  const data = await safeJson<{ tasks?: PulseTask[] }>(response);
  return Array.isArray(data.tasks) ? data.tasks : [];
}

export async function listPulseRuns(taskId?: string): Promise<PulseRun[]> {
  const params = new URLSearchParams();
  if (taskId) params.set("taskId", taskId);
  const query = params.toString();
  const response = await fetch(
    apiUrl(`/api/pulse/runs${query ? `?${query}` : ""}`),
    { cache: "no-store" }
  );
  await assertOk(response);
  const data = await safeJson<{ runs?: PulseRun[] }>(response);
  return Array.isArray(data.runs) ? data.runs : [];
}

export async function proposePulseTask(text: string): Promise<PulseTaskProposal> {
  const response = await fetch(apiUrl("/api/pulse/tasks/propose"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  await assertOk(response);
  const data = await safeJson<{ proposal: PulseTaskProposal }>(response);
  return data.proposal;
}

export async function createPulseTask(
  payload: PulseTaskCreatePayload
): Promise<PulseTask> {
  const response = await fetch(apiUrl("/api/pulse/tasks"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await assertOk(response);
  const data = await safeJson<{ task: PulseTask }>(response);
  return data.task;
}

export async function updatePulseTaskStatus(
  taskId: string,
  status: PulseTaskStatusUpdate
): Promise<PulseTask> {
  const response = await fetch(apiUrl(`/api/pulse/tasks/${encodeURIComponent(taskId)}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  await assertOk(response);
  const data = await safeJson<{ task: PulseTask }>(response);
  return data.task;
}

export async function deletePulseTask(taskId: string): Promise<void> {
  const response = await fetch(apiUrl(`/api/pulse/tasks/${encodeURIComponent(taskId)}`), {
    method: "DELETE",
  });
  await assertOk(response);
}

export async function deletePulseRun(runId: string): Promise<void> {
  const response = await fetch(apiUrl(`/api/pulse/runs/${encodeURIComponent(runId)}`), {
    method: "DELETE",
  });
  await assertOk(response);
}

export async function runPulseTaskNow(taskId: string): Promise<PulseRun> {
  const response = await fetch(
    apiUrl(`/api/pulse/tasks/${encodeURIComponent(taskId)}/run`),
    { method: "POST" }
  );
  await assertOk(response);
  const data = await safeJson<{ run: PulseRun }>(response);
  return data.run;
}
