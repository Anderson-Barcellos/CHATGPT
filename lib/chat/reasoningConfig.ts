import { isReasoningModel } from "@/lib/models/modelConfig";
import type { ReasoningEffort, ReasoningSummary } from "@/types";

type EnabledReasoningEffort = Exclude<ReasoningEffort, "none">;
type ApiReasoningSummary = Exclude<ReasoningSummary, "off">;

export interface ChatReasoningConfig {
  effort: EnabledReasoningEffort;
  summary?: ApiReasoningSummary;
}

export function buildReasoningConfig(
  model: string,
  effort: ReasoningEffort,
  summary: ReasoningSummary = "detailed"
): ChatReasoningConfig | undefined {
  if (!isReasoningModel(model)) return undefined;
  if (effort === "none") return undefined;

  return {
    effort,
    ...(summary !== "off" && { summary }),
  };
}
