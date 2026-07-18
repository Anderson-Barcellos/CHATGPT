import type { ReasoningEffort, ResponseMode } from "@/types";

type DeepsearchMode = Extract<ResponseMode, "deepsearch_medium" | "deepsearch_high">;

export interface DeepsearchProfile {
  model: string;
  reasoningEffort: ReasoningEffort;
}

export function resolveDeepsearchProfile(mode: DeepsearchMode): DeepsearchProfile {
  return mode === "deepsearch_high"
    ? { model: "gpt-5.4", reasoningEffort: "high" }
    : { model: "gpt-5.4-mini", reasoningEffort: "high" };
}
