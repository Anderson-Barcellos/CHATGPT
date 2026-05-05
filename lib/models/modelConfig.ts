import { ModelCapability, ModelFamily, ModelInfo, TokenUsage } from "@/types";

export const MODELS: Record<string, ModelInfo> = {
  "gpt-5.5": {
    id: "gpt-5.5",
    name: "GPT-5.5",
    family: "gpt-5",
    description: "Modelo frontier mais novo para coding e trabalho profissional complexo",
    contextWindow: 1050000,
    maxOutput: 128000,
    pricing: { input: 5.0, output: 30.0, cachedInput: 0.5 },
    capabilities: ["chat", "reasoning", "vision", "function-calling", "json-mode"],
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsTemperature: false,
    supportsVerbosity: true,
    supportsCodeInterpreter: true,
    recommendedFor: ["Analise profunda", "Tarefas profissionais complexas", "Raciocinio avancado"],
    badge: "Frontier",
  },
  "gpt-5.3-chat-latest": {
    id: "gpt-5.3-chat-latest",
    name: "GPT-5.3 Chat",
    family: "gpt-5",
    description: "Modelo instantaneo usado no ChatGPT para chat geral",
    contextWindow: 128000,
    maxOutput: 16384,
    pricing: { input: 1.75, output: 14.0, cachedInput: 0.175 },
    capabilities: ["chat", "vision", "function-calling", "json-mode"],
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsTemperature: false,
    supportsVerbosity: true,
    supportsCodeInterpreter: true,
    recommendedFor: ["Chat geral", "Respostas rapidas", "Teste das melhorias do ChatGPT"],
    badge: "ChatGPT",
  },
  "gpt-5.3-codex": {
    id: "gpt-5.3-codex",
    name: "GPT-5.3 Codex",
    family: "gpt-5",
    description: "Modelo especializado em coding agentico e fluxos tipo Codex",
    contextWindow: 400000,
    maxOutput: 128000,
    pricing: { input: 1.75, output: 14.0, cachedInput: 0.175 },
    capabilities: ["chat", "reasoning", "vision", "function-calling", "json-mode"],
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsTemperature: false,
    supportsVerbosity: true,
    supportsCodeInterpreter: true,
    recommendedFor: ["Coding complexo", "Agentes", "Revisao e manutencao de codigo"],
    badge: "Codex",
  },
  "gpt-4o": {
    id: "gpt-4o",
    name: "GPT-4o",
    family: "gpt-4o",
    description: "GPT-4 otimizado para velocidade",
    contextWindow: 128000,
    maxOutput: 16000,
    pricing: { input: 2.5, output: 10.0, cachedInput: 1.25 },
    capabilities: ["chat", "vision", "function-calling", "json-mode"],
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsTemperature: true,
    supportsVerbosity: false,
    supportsCodeInterpreter: true,
    recommendedFor: ["Multimodal", "Visao + texto", "Uso geral"],
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
    supportsSystemMessages: true,
    supportsTemperature: true,
    supportsVerbosity: false,
    supportsCodeInterpreter: true,
    recommendedFor: ["Tarefas complexas", "Codigo", "Analise"],
    badge: "Confiavel",
  },
  o3: {
    id: "o3",
    name: "o3",
    family: "o-series",
    description: "Raciocinio profundo para problemas complexos",
    contextWindow: 200000,
    maxOutput: 100000,
    pricing: { input: 10.0, output: 40.0, cachedInput: 5.0 },
    capabilities: ["reasoning", "chat", "vision"],
    supportsStreaming: true,
    supportsSystemMessages: false,
    supportsTemperature: false,
    supportsVerbosity: false,
    supportsCodeInterpreter: true,
    recommendedFor: ["Matematica avancada", "Coding complexo", "Pesquisa cientifica"],
    badge: "Raciocinio",
  },
  "o4-mini": {
    id: "o4-mini",
    name: "o4-mini",
    family: "o-series",
    description: "Raciocinio compacto e rapido",
    contextWindow: 200000,
    maxOutput: 100000,
    pricing: { input: 1.1, output: 4.4, cachedInput: 0.55 },
    capabilities: ["reasoning", "chat"],
    supportsStreaming: true,
    supportsSystemMessages: false,
    supportsTemperature: false,
    supportsVerbosity: false,
    supportsCodeInterpreter: true,
    recommendedFor: ["Raciocinio economico", "Coding", "Alto volume"],
    badge: "Novo",
  },
  "gpt-image-1.5": {
    id: "gpt-image-1.5",
    name: "GPT Image 1.5",
    family: "gpt-image",
    description: "Geracao de imagens de alta qualidade com IA",
    contextWindow: 4000,
    maxOutput: 0,
    pricing: { input: 0.04, output: 0.0 },
    capabilities: ["image-generation"],
    supportsStreaming: false,
    supportsSystemMessages: false,
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
    supportsSystemMessages: false,
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

export function getBestModelForTask(
  task: string,
  budget: "low" | "medium" | "high" | "unlimited" = "medium"
): { modelId: string; reason: string; confidence: "high" | "medium" | "low" } {
  const maxInput: Record<string, number> = {
    low: 3,
    medium: 8,
    high: 20,
    unlimited: Infinity,
  };

  const chatModels = getChatModels().filter(
    (m) => m.pricing.input <= maxInput[budget]
  );

  const lowerTask = task.toLowerCase();
  const needsReasoning =
    lowerTask.includes("math") ||
    lowerTask.includes("code") ||
    lowerTask.includes("reason") ||
    lowerTask.includes("analys");

  const candidates = needsReasoning
    ? chatModels.filter((m) => m.capabilities.includes("reasoning"))
    : chatModels;

  const pool = candidates.length > 0 ? candidates : chatModels;
  const best = pool.sort((a, b) => a.pricing.input - b.pricing.input)[0];

  return {
    modelId: best?.id ?? "gpt-5.3-chat-latest",
    reason: needsReasoning
      ? `${best?.name} oferece raciocinio dentro do orcamento`
      : `${best?.name} e o melhor custo-beneficio para esta tarefa`,
    confidence: needsReasoning && candidates.length > 0 ? "high" : "medium",
  };
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
