import { ModelCapability, ModelFamily, ModelInfo, TokenUsage } from "@/types";

export const MODELS: Record<string, ModelInfo> = {
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
    recommendedFor: ["Analise profunda", "Tarefas profissionais complexas", "Raciocinio avancado"],
    badge: "Frontier",
  },
  "gpt-5.1-chat-latest": {
    id: "gpt-5.1-chat-latest",
    name: "GPT-5.1 Instant",
    family: "gpt-5",
    description: "Modelo de chat rapido e eficiente para uso geral — alias chat-latest da serie GPT-5.1",
    contextWindow: 128000,
    maxOutput: 16384,
    pricing: { input: 1.75, output: 4.0, cachedInput: 0.175 },
    capabilities: ["chat", "vision", "function-calling", "json-mode"],
    supportsStreaming: true,

    supportsTemperature: false,
    supportsVerbosity: true,
    supportsCodeInterpreter: true,
    recommendedFor: ["Chat geral", "Respostas rapidas", "Uso diario"],
    badge: "Padrao",
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
  "gpt-5.4-nano": {
    id: "gpt-5.4-nano",
    name: "GPT-5.4 Nano",
    family: "gpt-5",
    description: "Modelo ultra-economico para tarefas simples e leves",
    contextWindow: 128000,
    maxOutput: 16384,
    pricing: { input: 0.04, output: 0.16, cachedInput: 0.004 },
    capabilities: ["chat", "reasoning", "vision", "function-calling", "json-mode"],
    supportsStreaming: true,

    supportsTemperature: false,
    supportsVerbosity: true,
    supportsCodeInterpreter: false,
    recommendedFor: ["Titulos automaticos", "Tarefas simples", "Custo minimo"],
    badge: "Economico",
  },
  "gpt-5.1": {
    id: "gpt-5.1",
    name: "GPT-5.1",
    family: "gpt-5",
    description: "Modelo especializado em coding agentico e fluxos tipo Codex",
    contextWindow: 400000,
    maxOutput: 128000,
    pricing: { input: 1.75, output: 14.0, cachedInput: 0.175 },
    capabilities: ["chat", "reasoning", "vision", "function-calling", "json-mode"],
    supportsStreaming: true,

    supportsTemperature: false,
    supportsVerbosity: true,
    supportsCodeInterpreter: true,
    recommendedFor: ["Coding complexo", "Agentes", "Revisao e manutencao de codigo"],
    badge: "Codex",
  },
  "gpt-4.1": {
    id: "gpt-4.1",
    name: "GPT-4.1",
    family: "gpt-4.1",
    description: "Modelo avancado e confiavel",
    contextWindow: 1047576,
    maxOutput: 32000,
    pricing: { input: 2.5, output: 10.0, cachedInput: 1.25 },
    capabilities: ["chat", "vision", "function-calling", "json-mode"],
    supportsStreaming: true,

    supportsTemperature: false,
    supportsVerbosity: false,
    supportsCodeInterpreter: true,
    recommendedFor: ["Tarefas complexas", "Codigo", "Analise"],
    badge: "Confiavel",
  },
  "o3": {
    id: "o3",
    name: "o3",
    family: "o-series",
    description: "Raciocinio profundo para problemas complexos",
    contextWindow: 200000,
    maxOutput: 100000,
    pricing: { input: 10.0, output: 40.0, cachedInput: 5.0 },
    capabilities: ["reasoning", "chat", "vision"],
    supportsStreaming: true,

    supportsTemperature: false,
    supportsVerbosity: false,
    supportsCodeInterpreter: true,
    recommendedFor: ["Matematica avancada", "Coding complexo", "Pesquisa cientifica"],
    badge: "Raciocinio",
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

const REASONING_LABELS: Record<string, string> = {
  none: "Sem",
  low: "Baixo",
  medium: "Medio",
  high: "Alto",
  xhigh: "Maximo",
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
    (m) => m.capabilities.includes("chat") || m.capabilities.includes("reasoning")
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
