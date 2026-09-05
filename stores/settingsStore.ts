import { create } from "zustand";
import {
  ModelParameters,
  ModelScopedParameters,
  CustomInstructions,
  Memory,
} from "@/types";
import {
  MODELS,
  getFixedReasoningEffort,
  getFixedVerbosity,
  getSupportedReasoningEfforts,
  isDeepSeekModel,
  isReasoningModel,
  modelSupportsReasoningMode,
} from "@/lib/models/modelConfig";

type ModelSettingsMap = Record<string, ModelScopedParameters>;
interface SettingsState {
  parameters: ModelParameters;
  modelSettingsById: ModelSettingsMap;
  customInstructions: CustomInstructions | null;
  memories: Memory[];
  updateParameters: (updates: Partial<ModelParameters>) => void;
  setCustomInstructions: (instructions: CustomInstructions | null) => void;
  setMemories: (memories: Memory[]) => void;
  getModelParameters: () => ModelParameters;
  getCustomInstructions: () => CustomInstructions | null;
  getActiveMemories: () => Memory[];
}

const DEFAULT_MODEL = "gpt-5.6-luna";

const LEGACY_MODEL_FALLBACKS: Record<string, string> = {
  "gemini-3.7-flash": "gemini-3.8-flash",
  "gpt-chat-latest": "chat-latest",
  "gpt-5-chat-latest": "chat-latest",
  "gpt-5.1-chat-latest": DEFAULT_MODEL,
  "gpt-5.3-chat-latest": DEFAULT_MODEL,
  "gpt-5.4-mini": DEFAULT_MODEL,
  "gpt-5.1": DEFAULT_MODEL,
  "gpt-4.1": DEFAULT_MODEL,
  o3: DEFAULT_MODEL,
};

function resolveSupportedModelId(modelId: string | undefined): string {
  if (!modelId) return DEFAULT_MODEL;
  if (MODELS[modelId] && MODELS[modelId].selectable !== false) return modelId;
  return LEGACY_MODEL_FALLBACKS[modelId] ?? DEFAULT_MODEL;
}

function usesNoReasoningByDefault(modelId: string): boolean {
  return (
    modelId === "chat-latest" ||
    modelId.includes("-mini") ||
    modelId.includes("-nano")
  );
}

function buildDefaultModelSettings(modelId: string): ModelScopedParameters {
  const resolvedModelId = resolveSupportedModelId(modelId);
  const defaultReasoningEffort =
    isDeepSeekModel(resolvedModelId)
      ? "xhigh"
      : resolvedModelId === "gemini-3.8-flash"
      ? "high"
      : resolvedModelId === "gpt-5.6-luna"
      ? "low"
      : usesNoReasoningByDefault(resolvedModelId)
      ? "none"
      : isReasoningModel(resolvedModelId)
      ? "medium"
      : "none";
  const defaultReasoningSummary = "detailed" as const;

  return {
    maxOutputTokens: MODELS[resolvedModelId]?.maxOutput || 32768,
    temperature: 0.8,
    topP: 0.95,
    reasoningEffort: getFixedReasoningEffort(resolvedModelId) ?? defaultReasoningEffort,
    reasoningMode: "standard",
    reasoningSummary: defaultReasoningSummary,
    verbosity:
      getFixedVerbosity(resolvedModelId) ??
      (isDeepSeekModel(resolvedModelId) ? "high" : "medium"),
    codeInterpreterEnabled: false,
  };
}

function clampModelSettings(
  modelId: string,
  settings: ModelScopedParameters
): ModelScopedParameters {
  const resolvedModelId = resolveSupportedModelId(modelId);
  const modelMaxOutput = MODELS[resolvedModelId]?.maxOutput;
  const maxOutputTokens = modelMaxOutput
    ? Math.min(Math.max(Math.round(settings.maxOutputTokens), 256), modelMaxOutput)
    : Math.max(Math.round(settings.maxOutputTokens), 256);

  const supportedEfforts = getSupportedReasoningEfforts(resolvedModelId);
  const reasoningEffort = supportedEfforts.includes(settings.reasoningEffort)
    ? settings.reasoningEffort
    : buildDefaultModelSettings(resolvedModelId).reasoningEffort;
  const reasoningMode = modelSupportsReasoningMode(
    resolvedModelId,
    settings.reasoningMode
  )
    ? settings.reasoningMode
    : "standard";
  const fixedReasoningEffort = getFixedReasoningEffort(resolvedModelId);
  const fixedVerbosity = getFixedVerbosity(resolvedModelId);

  return {
    ...settings,
    maxOutputTokens,
    temperature: Number(settings.temperature.toFixed(2)),
    topP: Number(settings.topP.toFixed(2)),
    reasoningEffort,
    reasoningMode,
    ...(fixedReasoningEffort && { reasoningEffort: fixedReasoningEffort }),
    ...(fixedVerbosity && { verbosity: fixedVerbosity }),
    ...(isDeepSeekModel(resolvedModelId)
      ? {
          reasoningEffort: "xhigh" as const,
          verbosity: "high" as const,
          codeInterpreterEnabled: false,
        }
      : {}),
  };
}

function extractModelSettings(parameters: ModelParameters): ModelScopedParameters {
  return {
    maxOutputTokens: parameters.maxOutputTokens,
    temperature: parameters.temperature,
    topP: parameters.topP,
    reasoningEffort: parameters.reasoningEffort,
    reasoningMode: parameters.reasoningMode,
    reasoningSummary: parameters.reasoningSummary,
    verbosity: parameters.verbosity,
    codeInterpreterEnabled: parameters.codeInterpreterEnabled,
  };
}

function mergeModelParameters(
  model: string,
  systemPrompt: string,
  settings: ModelScopedParameters
): ModelParameters {
  return {
    model,
    systemPrompt,
    ...settings,
  };
}

function resolveModelSettings(
  modelId: string,
  modelSettingsById: ModelSettingsMap
): ModelScopedParameters {
  const resolvedModelId = resolveSupportedModelId(modelId);
  return clampModelSettings(modelId, {
    ...buildDefaultModelSettings(resolvedModelId),
    ...modelSettingsById[resolvedModelId],
  });
}

function pickModelScopedUpdates(
  updates: Partial<ModelParameters>
): Partial<ModelScopedParameters> {
  return {
    ...(updates.maxOutputTokens !== undefined && {
      maxOutputTokens: updates.maxOutputTokens,
    }),
    ...(updates.temperature !== undefined && {
      temperature: updates.temperature,
    }),
    ...(updates.topP !== undefined && {
      topP: updates.topP,
    }),
    ...(updates.reasoningEffort !== undefined && {
      reasoningEffort: updates.reasoningEffort,
    }),
    ...(updates.reasoningMode !== undefined && {
      reasoningMode: updates.reasoningMode,
    }),
    ...(updates.reasoningSummary !== undefined && {
      reasoningSummary: updates.reasoningSummary,
    }),
    ...(updates.verbosity !== undefined && {
      verbosity: updates.verbosity,
    }),
    ...(updates.codeInterpreterEnabled !== undefined && {
      codeInterpreterEnabled: updates.codeInterpreterEnabled,
    }),
  };
}

const defaultModelSettings = buildDefaultModelSettings(DEFAULT_MODEL);
const defaultParameters = mergeModelParameters(
  DEFAULT_MODEL,
  "",
  defaultModelSettings
);

export const useSettingsStore = create<SettingsState>((set, get) => ({
  parameters: defaultParameters,
  modelSettingsById: {
    [DEFAULT_MODEL]: defaultModelSettings,
  },
  customInstructions: null,
  memories: [],
  updateParameters: (updates) =>
    set((state) => {
      const currentModel = resolveSupportedModelId(state.parameters.model);
      const nextModel = resolveSupportedModelId(updates.model ?? currentModel);
      const nextSystemPrompt = updates.systemPrompt ?? state.parameters.systemPrompt;
      const scopedUpdates = pickModelScopedUpdates(updates);
      const modelSettingsById = {
        ...state.modelSettingsById,
        [currentModel]: clampModelSettings(
          currentModel,
          extractModelSettings(state.parameters)
        ),
      };

      const nextScopedSettings =
        nextModel === currentModel
          ? clampModelSettings(currentModel, {
              ...modelSettingsById[currentModel],
              ...scopedUpdates,
            })
          : clampModelSettings(nextModel, {
              ...resolveModelSettings(nextModel, modelSettingsById),
              ...scopedUpdates,
            });

      modelSettingsById[nextModel] = nextScopedSettings;

      return {
        modelSettingsById,
        parameters: mergeModelParameters(
          nextModel,
          nextSystemPrompt,
          nextScopedSettings
        ),
      };
    }),
  setCustomInstructions: (instructions) =>
    set({ customInstructions: instructions }),
  setMemories: (memories) => set({ memories }),
  getModelParameters: () => get().parameters,
  getCustomInstructions: () => get().customInstructions,
  getActiveMemories: () => get().memories.filter((m) => m.isActive),
}));
