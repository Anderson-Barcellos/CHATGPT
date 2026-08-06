import {
  ModelCapability,
  ModelFamily,
  ModelInfo,
  ReasoningEffort,
  ReasoningMode,
  TokenUsage,
} from "@/types";

const GPT_56_REASONING_EFFORTS: ReasoningEffort[] = [
  "none", "low", "medium", "high", "xhigh", "max",
];
const GPT_56_REASONING_MODES: ReasoningMode[] = ["standard", "pro"];
const STANDARD_REASONING_EFFORTS: ReasoningEffort[] = [
  "none", "low", "medium", "high", "xhigh",
];
const GEMINI_36_REASONING_EFFORTS: ReasoningEffort[] = [
  "minimal", "low", "medium", "high",
];

export const MODELS: Record<string, ModelInfo> = {
  "gpt-5.6-sol": {
    id: "gpt-5.6-sol",
    name: "GPT-5.6 Sol",
    family: "gpt-5",
    description: "Modelo frontier mais potente para analise, coding e pesquisa complexa",
    contextWindow: 1_050_000,
    maxOutput: 128_000,
    pricing: { input: 5, output: 30, cachedInput: 0.5 },
    capabilities: ["chat", "reasoning", "vision", "function-calling", "json-mode"],
    supportsStreaming: true,
    supportsTemperature: false,
    supportsVerbosity: true,
    supportsCodeInterpreter: true,
    supportedReasoningEfforts: GPT_56_REASONING_EFFORTS,
    supportedReasoningModes: GPT_56_REASONING_MODES,
    recommendedFor: ["Analise frontier", "Coding complexo", "Pesquisa profunda"],
    badge: "Mais potente",
  },
  "gpt-5.6-terra": {
    id: "gpt-5.6-terra",
    name: "GPT-5.6 Terra",
    family: "gpt-5",
    description: "Modelo GPT-5.6 que equilibra inteligencia, desempenho e custo",
    contextWindow: 1_050_000,
    maxOutput: 128_000,
    pricing: { input: 2.5, output: 15, cachedInput: 0.25 },
    capabilities: ["chat", "reasoning", "vision", "function-calling", "json-mode"],
    supportsStreaming: true,
    supportsTemperature: false,
    supportsVerbosity: true,
    supportsCodeInterpreter: true,
    supportedReasoningEfforts: GPT_56_REASONING_EFFORTS,
    supportedReasoningModes: GPT_56_REASONING_MODES,
    recommendedFor: ["Uso profissional", "Coding", "Equilibrio entre qualidade e custo"],
    badge: "Equilibrado",
  },
  "gpt-5.6-luna": {
    id: "gpt-5.6-luna",
    name: "GPT-5.6 Luna",
    family: "gpt-5",
    description: "Modelo GPT-5.6 eficiente para conversa diaria e alto volume",
    contextWindow: 400_000,
    maxOutput: 128_000,
    pricing: { input: 1, output: 6, cachedInput: 0.1 },
    capabilities: ["chat", "reasoning", "vision", "function-calling", "json-mode"],
    supportsStreaming: true,
    supportsTemperature: false,
    supportsVerbosity: true,
    supportsCodeInterpreter: true,
    supportedReasoningEfforts: GPT_56_REASONING_EFFORTS,
    supportedReasoningModes: GPT_56_REASONING_MODES,
    recommendedFor: ["Uso diario", "Baixa latencia", "Alto volume"],
    badge: "Default",
  },
  "chat-latest": {
    id: "chat-latest",
    name: "GPT-5.5 Instant",
    family: "gpt-5",
    description: "Alias rapido do ChatGPT mais novo para conversa diaria com baixa latencia",
    contextWindow: 400000,
    maxOutput: 128000,
    pricing: { input: 5.0, output: 30.0, cachedInput: 0.5 },
    capabilities: ["chat", "reasoning", "vision", "function-calling", "json-mode"],
    supportsStreaming: true,

    supportsTemperature: false,
    supportsVerbosity: false,
    supportsCodeInterpreter: true,
    hiddenFromChatSelector: true,
    recommendedFor: ["Chat rapido", "Uso diario premium", "Resposta polida"],
    badge: "Instant",
  },
  "gpt-5.5": {
    id: "gpt-5.5",
    name: "GPT-5.5",
    family: "gpt-5",
    description: "Modelo frontier para tarefas complexas com raciocinio aprofundado",
    contextWindow: 1050000,
    maxOutput: 128000,
    pricing: { input: 3.75, output: 22.5, cachedInput: 0.375 },
    capabilities: ["chat", "reasoning", "vision", "function-calling", "json-mode"],
    supportsStreaming: true,

    supportsTemperature: false,
    supportsVerbosity: true,
    supportsCodeInterpreter: true,
    hiddenFromChatSelector: true,
    recommendedFor: ["Analise profunda", "Trabalho tecnico", "Raciocinio avancado"],
    badge: "Frontier",
  },
  "gpt-5.4": {
    id: "gpt-5.4",
    name: "GPT-5.4",
    family: "gpt-5",
    description: "Modelo frontier para coding, raciocinio avancado e trabalho profissional",
    contextWindow: 1050000,
    maxOutput: 128000,
    pricing: { input: 3.75, output: 22.5, cachedInput: 0.375 },
    capabilities: ["chat", "reasoning", "vision", "function-calling", "json-mode"],
    supportsStreaming: true,

    supportsTemperature: false,
    supportsVerbosity: true,
    supportsCodeInterpreter: true,
    hiddenFromChatSelector: true,
    recommendedFor: ["Analise profunda", "Tarefas profissionais complexas", "Raciocinio avancado"],
    badge: "Frontier",
  },
  "gpt-5.4-mini": {
    id: "gpt-5.4-mini",
    name: "GPT-5.4 mini",
    family: "gpt-5",
    description: "Variante economica para chat, coding e raciocinio no dia a dia",
    contextWindow: 128000,
    maxOutput: 16384,
    pricing: { input: 1.1, output: 4.4, cachedInput: 0.11 },
    capabilities: ["chat", "reasoning", "vision", "function-calling", "json-mode"],
    supportsStreaming: true,

    supportsTemperature: false,
    supportsVerbosity: true,
    supportsCodeInterpreter: true,
    recommendedFor: ["Uso diario", "Coding economico", "Raciocinio com menor custo"],
    badge: "Eficiente",
  },
  "gpt-5.2": {
    id: "gpt-5.2",
    name: "GPT-5.2",
    family: "gpt-5",
    description: "Modelo reasoning para trabalho profissional com esforço configuravel",
    contextWindow: 400000,
    maxOutput: 128000,
    pricing: { input: 1.75, output: 14.0, cachedInput: 0.175 },
    capabilities: ["chat", "reasoning", "vision", "function-calling", "json-mode"],
    supportsStreaming: true,

    supportsTemperature: false,
    supportsVerbosity: true,
    supportsCodeInterpreter: true,
    hiddenFromChatSelector: true,
    recommendedFor: ["Analise", "Coding complexo", "Raciocinio medio"],
    badge: "Reasoning",
  },
  "deepseek-v4-pro": {
    id: "deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    family: "deepseek",
    description: "Modelo DeepSeek de contexto longo para chat com raciocinio maximo fixo",
    contextWindow: 1_000_000,
    maxOutput: 384_000,
    pricing: { input: 0.435, output: 0.87, cachedInput: 0.003625 },
    capabilities: ["chat", "reasoning", "function-calling", "json-mode"],
    supportsStreaming: true,

    supportsTemperature: false,
    supportsVerbosity: true,
    supportsCodeInterpreter: false,
    recommendedFor: ["Chat longo", "Raciocinio profundo", "Analise economica"],
    badge: "DeepSeek",
  },
  "gemini-3.6-flash": {
    id: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    family: "gemini",
    description: "Modelo Gemini rapido para tarefas agenticas, multimodais e pesquisa web",
    contextWindow: 1_048_576,
    maxOutput: 65_536,
    pricing: { input: 1.5, output: 7.5 },
    capabilities: ["chat", "reasoning", "vision", "function-calling", "json-mode"],
    supportsStreaming: true,
    supportsTemperature: false,
    supportsVerbosity: false,
    supportsCodeInterpreter: false,
    supportedReasoningEfforts: GEMINI_36_REASONING_EFFORTS,
    recommendedFor: ["Chat rapido", "Pesquisa web", "Analise multimodal"],
    badge: "Gemini",
  },
  "gpt-image-2": {
    id: "gpt-image-2",
    name: "GPT Image 2",
    family: "gpt-image",
    description: "Geracao de imagens de alta qualidade com IA",
    contextWindow: 4000,
    maxOutput: 0,
    pricing: { input: 0.04, output: 0.0 },
    capabilities: ["image-generation"],
    supportsStreaming: false,

    supportsTemperature: false,
    supportsVerbosity: false,
    supportsCodeInterpreter: false,
    recommendedFor: ["Criacao de imagens", "Arte digital", "Ilustracoes"],
    badge: "Novo",
  },
  "dall-e-3": {
    id: "dall-e-3",
    name: "DALL-E 3",
    family: "dall-e",
    description: "Modelo classico de geracao de imagens",
    contextWindow: 4000,
    maxOutput: 0,
    pricing: { input: 0.04, output: 0.0 },
    capabilities: ["image-generation"],
    supportsStreaming: false,

    supportsTemperature: false,
    supportsVerbosity: false,
    supportsCodeInterpreter: false,
    recommendedFor: ["Criacao de imagens", "Arte digital", "Ilustracoes"],
  },
};

export function isReasoningModel(modelId: string): boolean {
  const model = MODELS[modelId];
  return model?.capabilities.includes("reasoning") ?? false;
}

export function isDeepSeekModel(modelId: string): boolean {
  return modelId === "deepseek-v4-pro";
}

export function isGeminiModel(modelId: string): boolean {
  return modelId === "gemini-3.6-flash";
}

const REASONING_LABELS: Record<string, string> = {
  none: "Sem",
  minimal: "Minimo",
  low: "Baixo",
  medium: "Medio",
  high: "Alto",
  xhigh: "Muito alto",
  max: "Maximo",
};

export function getReasoningLabel(reasoningEffort: string | undefined): string {
  return REASONING_LABELS[reasoningEffort ?? ""] ?? "—";
}

export function modelSupportsTemperature(modelId: string): boolean {
  const model = MODELS[modelId];
  return model?.supportsTemperature ?? false;
}

export function modelSupportsVerbosity(modelId: string): boolean {
  const model = MODELS[modelId];
  return model?.supportsVerbosity ?? false;
}

export function modelSupportsCodeInterpreter(modelId: string): boolean {
  const model = MODELS[modelId];
  return model?.supportsCodeInterpreter ?? false;
}

export function getSupportedReasoningEfforts(modelId: string): ReasoningEffort[] {
  const model = MODELS[modelId];
  if (!model?.capabilities.includes("reasoning")) return [];
  return model.supportedReasoningEfforts ?? STANDARD_REASONING_EFFORTS;
}

export function modelSupportsReasoningMode(
  modelId: string,
  mode: ReasoningMode
): boolean {
  const modes = MODELS[modelId]?.supportedReasoningModes ?? ["standard"];
  return modes.includes(mode);
}

export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  modelId: string,
  cachedTokens = 0
): TokenUsage {
  const model = MODELS[modelId];
  if (!model) {
    return { inputTokens, outputTokens, cachedTokens, totalCost: 0 };
  }

  const uncachedInput = inputTokens - cachedTokens;
  const inputCost = (uncachedInput / 1_000_000) * model.pricing.input;
  const cachedCost = model.pricing.cachedInput
    ? (cachedTokens / 1_000_000) * model.pricing.cachedInput
    : 0;
  const outputCost = (outputTokens / 1_000_000) * model.pricing.output;

  return {
    inputTokens,
    outputTokens,
    cachedTokens,
    totalCost: inputCost + cachedCost + outputCost,
  };
}

export function estimateCost(
  promptText: string,
  expectedOutputTokens: number,
  modelId: string
): { estimatedInputTokens: number; estimatedCost: number } {
  const estimatedInputTokens = Math.ceil(promptText.length / 4);
  const usage = calculateCost(estimatedInputTokens, expectedOutputTokens, modelId);
  return { estimatedInputTokens, estimatedCost: usage.totalCost };
}

export function fitsInContextWindow(
  inputTokens: number,
  outputTokens: number,
  modelId: string
): { fits: boolean; usage: number; available: number } {
  const model = MODELS[modelId];
  if (!model) return { fits: false, usage: 0, available: 0 };

  const totalTokens = inputTokens + outputTokens;
  return { fits: totalTokens <= model.contextWindow, usage: totalTokens, available: model.contextWindow };
}

export function getModelsByCapability(capability: ModelCapability): ModelInfo[] {
  return Object.values(MODELS).filter((model) =>
    model.capabilities.includes(capability)
  );
}

export function getModelsByFamily(family: ModelFamily): ModelInfo[] {
  return Object.values(MODELS).filter((model) => model.family === family);
}

export function getChatModels(): ModelInfo[] {
  return Object.values(MODELS).filter(
    (m) =>
      m.selectable !== false &&
      m.hiddenFromChatSelector !== true &&
      (m.capabilities.includes("chat") || m.capabilities.includes("reasoning"))
  );
}

export function formatCost(cost: number): string {
  if (cost < 0.001) return `$${(cost * 1000).toFixed(4)}`;
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 1_000_000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${(tokens / 1_000_000).toFixed(1)}M`;
}
