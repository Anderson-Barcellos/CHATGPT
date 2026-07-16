import {
  isReasoningModel,
  modelSupportsReasoningMode,
} from "@/lib/models/modelConfig";
import type { ReasoningEffort, ReasoningMode, ReasoningSummary } from "@/types";

type EnabledReasoningEffort = Exclude<ReasoningEffort, "none">;
type ApiReasoningSummary = Exclude<ReasoningSummary, "off">;

export interface ChatReasoningConfig {
  effort: EnabledReasoningEffort;
  summary?: ApiReasoningSummary;
  mode?: "pro";
}

export function buildReasoningConfig(
  model: string,
  effort: ReasoningEffort,
  summary: ReasoningSummary = "detailed",
  mode: ReasoningMode = "standard"
): ChatReasoningConfig | undefined {
  if (!isReasoningModel(model)) return undefined;
  if (effort === "none") return undefined;

  return {
    effort,
    ...(summary !== "off" && { summary }),
    ...(mode === "pro" && modelSupportsReasoningMode(model, "pro") && { mode }),
  };
}
