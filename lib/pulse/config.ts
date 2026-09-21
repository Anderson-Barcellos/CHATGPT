import {
  DEFAULT_PULSE_MODEL,
  type PulseExecutionReasoningEffort,
  type PulseTask,
} from "@/lib/pulse/types";

const DEFAULT_PULSE_REASONING_EFFORT: PulseExecutionReasoningEffort = "medium";
const CONFIGURABLE_REASONING_EFFORTS = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
] as const;

export interface PulseExecutionProfile {
  model: string;
  reasoningEffort: PulseExecutionReasoningEffort;
}

function resolveReasoningEffort(): PulseExecutionReasoningEffort {
  const configured = process.env.PULSE_REASONING_EFFORT?.trim().toLowerCase();
  if (!configured || !CONFIGURABLE_REASONING_EFFORTS.includes(
    configured as (typeof CONFIGURABLE_REASONING_EFFORTS)[number]
  )) {
    return DEFAULT_PULSE_REASONING_EFFORT;
  }
  return configured === "none" || configured === "minimal"
    ? "low"
    : configured as PulseExecutionReasoningEffort;
}

export function resolvePulseExecutionProfile(
  task: Pick<PulseTask, "model">
): PulseExecutionProfile {
  const requestedModel = process.env.PULSE_RUN_MODEL?.trim() || task.model || DEFAULT_PULSE_MODEL;
  const model = requestedModel === "gpt-5.4-mini" ? "grok-4.7" : requestedModel;
  return {
    model,
    reasoningEffort: model === "grok-4.7"
      ? "medium"
      : resolveReasoningEffort(),
  };
}
