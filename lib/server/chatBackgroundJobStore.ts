import type { BackgroundJobStatus } from "@/types";
import { readDataFile, withDataFileLock, writeDataFile } from "@/lib/server/jsonFileStore";
import { isBackgroundResponseMode } from "@/lib/server/chatBackgroundJob";
import type { BackgroundResponseMode } from "@/lib/server/chatBackgroundJob";

const JOBS_FILE = "chat-background-jobs.json";
const MAX_STORED_JOBS = 200;
const TERMINAL_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

export interface ChatBackgroundJobRecord {
  jobId: string;
  responseId: string;
  conversationId: string;
  assistantMessageId: string;
  responseMode: BackgroundResponseMode;
  status: BackgroundJobStatus;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt?: string;
  error?: string;
}

export type ChatBackgroundJobCreateInput = Pick<
  ChatBackgroundJobRecord,
  "responseId" | "conversationId" | "assistantMessageId" | "responseMode"
> & {
  status?: BackgroundJobStatus;
  error?: string;
};

export type ChatBackgroundJobUpdateInput = Partial<
  Pick<ChatBackgroundJobRecord, "status" | "lastSyncedAt" | "error">
>;

export function isPendingBackgroundJobStatus(status: BackgroundJobStatus): boolean {
  return status === "queued" || status === "in_progress";
}

function isTerminalBackgroundJobStatus(status: BackgroundJobStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

function parseJob(value: unknown): ChatBackgroundJobRecord | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<ChatBackgroundJobRecord>;
  if (
    typeof raw.jobId !== "string" ||
    typeof raw.responseId !== "string" ||
    typeof raw.conversationId !== "string" ||
    typeof raw.assistantMessageId !== "string" ||
    !isBackgroundResponseMode(raw.responseMode) ||
    (raw.status !== "queued" &&
      raw.status !== "in_progress" &&
      raw.status !== "completed" &&
      raw.status !== "failed" &&
      raw.status !== "cancelled") ||
    typeof raw.createdAt !== "string" ||
    typeof raw.updatedAt !== "string"
  ) {
    return null;
  }

  return raw as ChatBackgroundJobRecord;
}

async function readJobs(): Promise<ChatBackgroundJobRecord[]> {
  const parsed = await readDataFile(JOBS_FILE, [] as unknown[]);
  return Array.isArray(parsed)
    ? (parsed.map(parseJob).filter(Boolean) as ChatBackgroundJobRecord[])
    : [];
}

async function writeJobs(jobs: ChatBackgroundJobRecord[]) {
  await writeDataFile(JOBS_FILE, jobs);
}

function pruneJobs(jobs: ChatBackgroundJobRecord[], now = new Date()): ChatBackgroundJobRecord[] {
  const cutoff = now.getTime() - TERMINAL_RETENTION_MS;
  return jobs
    .filter((job) => {
      if (!isTerminalBackgroundJobStatus(job.status)) return true;
      return new Date(job.updatedAt).getTime() >= cutoff;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_STORED_JOBS);
}

export async function upsertBackgroundJob(
  input: ChatBackgroundJobCreateInput
): Promise<ChatBackgroundJobRecord> {
  return withDataFileLock(JOBS_FILE, async () => {
    const jobs = await readJobs();
    const now = new Date().toISOString();
    const existingIndex = jobs.findIndex(
      (job) =>
        job.responseId === input.responseId ||
        (job.conversationId === input.conversationId &&
          job.assistantMessageId === input.assistantMessageId)
    );

    const existing = existingIndex >= 0 ? jobs[existingIndex] : undefined;
    const next: ChatBackgroundJobRecord = {
      jobId: existing?.jobId ?? crypto.randomUUID(),
      responseId: input.responseId,
      conversationId: input.conversationId,
      assistantMessageId: input.assistantMessageId,
      responseMode: input.responseMode,
      status: input.status ?? existing?.status ?? "queued",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      ...(existing?.lastSyncedAt ? { lastSyncedAt: existing.lastSyncedAt } : {}),
      ...(input.error ? { error: input.error } : existing?.error ? { error: existing.error } : {}),
    };

    if (existingIndex >= 0) {
      jobs[existingIndex] = next;
    } else {
      jobs.unshift(next);
    }

    await writeJobs(pruneJobs(jobs));
    return next;
  });
}

export async function updateBackgroundJobByResponseId(
  responseId: string,
  updates: ChatBackgroundJobUpdateInput
): Promise<ChatBackgroundJobRecord | null> {
  return withDataFileLock(JOBS_FILE, async () => {
    const jobs = await readJobs();
    const index = jobs.findIndex((job) => job.responseId === responseId);
    if (index === -1) return null;

    const next: ChatBackgroundJobRecord = {
      ...jobs[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    if (updates.error === undefined) {
      delete next.error;
    }

    jobs[index] = next;
    await writeJobs(pruneJobs(jobs));
    return next;
  });
}

export async function listPendingBackgroundJobs(
  limit = 8
): Promise<ChatBackgroundJobRecord[]> {
  const jobs = await readJobs();
  return jobs
    .filter((job) => isPendingBackgroundJobStatus(job.status))
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    .slice(0, Math.max(1, limit));
}

export async function listBackgroundJobs(): Promise<ChatBackgroundJobRecord[]> {
  const jobs = await readJobs();
  return jobs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
