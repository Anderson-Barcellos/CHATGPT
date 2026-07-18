import type { UrlCitation } from "@/types";

export const PULSE_TIME_ZONE = "America/Sao_Paulo";

export type PulseRecurrenceType = "daily" | "weekly" | "monthly";
export type PulseTaskStatus = "active" | "paused";
export type PulseRunStatus = "queued" | "running" | "completed" | "failed";
export const PULSE_MODELS = ["gpt-5.4-mini", "gpt-5.6-terra"] as const;
export type PulseModel = (typeof PULSE_MODELS)[number];
export const DEFAULT_PULSE_MODEL: PulseModel = "gpt-5.4-mini";
export type PulseExecutionReasoningEffort = "low" | "medium" | "high";

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
  model: PulseModel;
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
  modelUsed?: string;
  reasoningEffort?: PulseExecutionReasoningEffort;
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
  model?: unknown;
  recurrenceType?: unknown;
  time?: unknown;
  weekday?: unknown;
  dayOfMonth?: unknown;
}
