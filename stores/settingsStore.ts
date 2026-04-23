import { create } from "zustand";
import {
  ModelParameters,
  ModelScopedParameters,
  CustomInstructions,
  Memory,
} from "@/types";
import {
  MODELS,
  isReasoningModel,
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

const DEFAULT_MODEL = "gpt-5.3-chat-latest";

function buildDefaultModelSettings(modelId: string): ModelScopedParameters {
  return {
    maxOutputTokens: MODELS[modelId]?.maxOutput || 32768,
    temperature: 0.8,
    topP: 0.95,
    reasoningEffort: isReasoningModel(modelId) ? "medium" : "none",
    reasoningSummary: isReasoningModel(modelId) ? "auto" : "off",
    verbosity: "medium",
    codeInterpreterEnabled: false,
  };
}

function clampModelSettings(
  modelId: string,
  settings: ModelScopedParameters
): ModelScopedParameters {
  const modelMaxOutput = MODELS[modelId]?.maxOutput;
  const maxOutputTokens = modelMaxOutput
    ? Math.min(Math.max(Math.round(settings.maxOutputTokens), 256), modelMaxOutput)
    : Math.max(Math.round(settings.maxOutputTokens), 256);

  return {
    ...settings,
    maxOutputTokens,
    temperature: Number(settings.temperature.toFixed(2)),
    topP: Number(settings.topP.toFixed(2)),
  };
}

function extractModelSettings(parameters: ModelParameters): ModelScopedParameters {
  return {
    maxOutputTokens: parameters.maxOutputTokens,
    temperature: parameters.temperature,
    topP: parameters.topP,
    reasoningEffort: parameters.reasoningEffort,
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
  return clampModelSettings(modelId, {
    ...buildDefaultModelSettings(modelId),
    ...modelSettingsById[modelId],
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
      const currentModel = state.parameters.model;
      const nextModel = updates.model ?? currentModel;
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
