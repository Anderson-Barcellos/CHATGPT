import type { UrlCitation } from "@/types";

export const PULSE_TIME_ZONE = "America/Sao_Paulo";

export type PulseRecurrenceType = "daily" | "weekly" | "monthly";
export type PulseTaskStatus = "active" | "paused";
export type PulseRunStatus = "queued" | "running" | "completed" | "failed";

export interface PulseSchedule {
  type: PulseRecurrenceType;
  time: string;
  weekday?: number;
  dayOfMonth?: number;
  timeZone: string;
}

export interface PulseTask {
  id: string;
  title: string;
  emoji: string;
  prompt: string;
  executionPrompt: string;
  schedule: PulseSchedule;
  status: PulseTaskStatus;
  nextRunAt: string;
  lastRunAt?: string;
  lastRunId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PulseRun {
  id: string;
  taskId: string;
  status: PulseRunStatus;
  title: string;
  taskTitle?: string;
  content: string;
  imageBase64?: string;
  imageMimeType?: string;
  citations: UrlCitation[];
  error?: string;
  responseId?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PulseTaskProposal {
  canCreate: boolean;
  missingFields: string[];
  confidence: "low" | "medium" | "high";
  title: string;
  emoji: string;
  prompt: string;
  executionPrompt: string;
  recurrenceType: PulseRecurrenceType;
  time: string;
  weekday?: number;
  dayOfMonth?: number;
}

export interface PulseTaskCreateInput {
  title?: unknown;
  emoji?: unknown;
  prompt?: unknown;
  executionPrompt?: unknown;
  recurrenceType?: unknown;
  time?: unknown;
  weekday?: unknown;
  dayOfMonth?: unknown;
}
