import { getChatModel, type ChatModelInfo } from "@/lib/models/chatModelCatalog";
import type { ReasoningEffort } from "@/types";

export interface DocumentFallbackProfile {
  model: string;
  reasoningEffort: ReasoningEffort;
}

/**
 * Documento segue o modelo do chat; DeepSeek, Gemini e Claude ficam fora do
 * fluxo Responses do modo e caem para GPT-6 Luna com reasoning medium.
 */
export function resolveDocumentFallbackProfile(
  model: string,
  info = getChatModel(model)
): DocumentFallbackProfile | null {
  return info && !supportsDocumentModel(info)
    ? { model: "gpt-6-luna", reasoningEffort: "medium" }
    : null;
}

export function supportsDocumentModel(model: ChatModelInfo): boolean {
  return model.provider === "openai" && model.supportsResponsesTools !== false;
}
