import { isDeepSeekModel, isGeminiModel } from "@/lib/models/modelConfig";
import type { ReasoningEffort } from "@/types";

export interface DocumentFallbackProfile {
  model: string;
  reasoningEffort: ReasoningEffort;
}

/**
 * Documento segue o modelo do chat; só DeepSeek e Gemini (fora do fluxo
 * Responses do modo) caem para GPT-6 Luna com reasoning medium.
 */
export function resolveDocumentFallbackProfile(model: string): DocumentFallbackProfile | null {
  return isDeepSeekModel(model) || isGeminiModel(model)
    ? { model: "gpt-6-luna", reasoningEffort: "medium" }
    : null;
}
