import { getChatModels, MODELS } from "./modelConfig";
import type { ModelInfo, ReasoningEffort } from "@/types";

export type ChatModelProvider = "openai" | "anthropic" | "deepseek" | "google";

export interface ChatModelInfo extends Omit<ModelInfo, "pricing" | "recommendedFor"> {
  provider: ChatModelProvider;
  supportsResponsesTools?: boolean;
  supportsWebSearch?: boolean;
  supportsAdaptiveThinking?: boolean;
}

export interface ChatModelRow {
  model: ChatModelInfo;
  visible: boolean;
}

export interface ChatModelCatalog {
  revision: number;
  rows: ChatModelRow[];
}

export const CHAT_MODEL_PROVIDER_LABELS: Record<ChatModelProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  deepseek: "DeepSeek",
  google: "Google",
};

export const OPENAI_REASONING_EFFORTS: ReasoningEffort[] = [
  "none", "minimal", "low", "medium", "high", "xhigh", "max",
];

export const CLAUDE_EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;

function withProvider(info: ModelInfo): ChatModelInfo {
  const { pricing: _pricing, recommendedFor: _recommendedFor, ...model } = info;
  const provider: ChatModelProvider = info.family === "anthropic" ? "anthropic"
    : info.family === "deepseek" ? "deepseek"
    : info.family === "gemini" ? "google"
    : "openai";
  return { ...model, provider };
}

export const DEFAULT_CHAT_MODEL_CATALOG: ChatModelCatalog = {
  revision: 0,
  rows: getChatModels().map((model) => ({ model: withProvider(model), visible: true })),
};

const builtInModels = new Map(Object.values(MODELS).map((model) => [model.id, withProvider(model)]));

export function getChatModel(modelId: string, catalog?: ChatModelCatalog): ChatModelInfo | undefined {
  return catalog?.rows.find(({ model }) => model.id === modelId)?.model ?? builtInModels.get(modelId);
}

export type CatalogProvider = "openai" | "anthropic" | "google";

export const GEMINI_REASONING_EFFORTS: ReasoningEffort[] = ["low", "medium", "high"];

export function inferChatModelProvider(id: string): CatalogProvider | undefined {
  if (/^claude-[a-z0-9][a-z0-9.-]*$/.test(id)) return "anthropic";
  if (/\b(?:image|audio|realtime|transcribe|tts|embedding)\b/.test(id)) return;
  // Gemini de texto; robótica, computer use, Live, customtools e Nano Banana não são chat.
  if (/^gemini-[a-z0-9][a-z0-9.-]*$/.test(id)) {
    return /\b(?:banana|robotics|computer-use|customtools|live)\b/.test(id) ? undefined : "google";
  }
  if (/^(?:(?:gpt|chat|chatgpt)-[a-z0-9][a-z0-9.-]*|o\d+(?:-[a-z0-9][a-z0-9.-]*)?)$/.test(id)) return "openai";
}

export function hasOpenAIChatProfile(id: string): boolean {
  return id === "gpt-6.2-sol";
}
