import {
  getSupportedReasoningEfforts,
  isReasoningModel,
  modelSupportsReasoningMode,
} from "@/lib/models/modelConfig";
import type { ChatModelInfo } from "@/lib/models/chatModelCatalog";
import type { ReasoningEffort, ReasoningMode, ReasoningSummary } from "@/types";

type ApiReasoningSummary = Exclude<ReasoningSummary, "off">;

export interface ChatReasoningConfig {
  effort: ReasoningEffort;
  summary?: ApiReasoningSummary;
  mode?: "pro";
}

export function buildReasoningConfig(
  model: string,
  effort: ReasoningEffort,
  summary: ReasoningSummary = "detailed",
  mode: ReasoningMode = "standard",
  info?: ChatModelInfo
): ChatReasoningConfig | undefined {
  if (info) {
    if (!getSupportedReasoningEfforts(model, info).includes(effort)) return undefined;
    if (effort === "none") return { effort };
  } else {
    if (!isReasoningModel(model) || effort === "none") return undefined;
  }

  return {
    effort,
    ...(summary !== "off" && info?.supportsResponsesTools !== false && { summary }),
    ...(mode === "pro" && modelSupportsReasoningMode(model, "pro", info) && { mode }),
  };
}
