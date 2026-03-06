import { create } from "zustand";
import { ModelParameters, CustomInstructions, Memory } from "@/types";
import { MODELS } from "@/lib/models/modelConfig";

interface SettingsState {
  parameters: ModelParameters;
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

const defaultParameters: ModelParameters = {
  model: DEFAULT_MODEL,
  maxOutputTokens: MODELS[DEFAULT_MODEL]?.maxOutput || 32768,
  temperature: 0.8,
  topP: 0.95,
  systemPrompt: "",
  reasoningEffort: "medium",
  reasoningSummary: "auto",
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  parameters: defaultParameters,
  customInstructions: null,
  memories: [],
  updateParameters: (updates) =>
    set((state) => {
      const newParams = { ...state.parameters, ...updates };
      // Se mudou o modelo, atualiza maxOutputTokens para o máximo do modelo
      if (updates.model && MODELS[updates.model]) {
        newParams.maxOutputTokens = MODELS[updates.model].maxOutput;
      }
      return { parameters: newParams };
    }),
  setCustomInstructions: (instructions) =>
    set({ customInstructions: instructions }),
  setMemories: (memories) => set({ memories }),
  getModelParameters: () => get().parameters,
  getCustomInstructions: () => get().customInstructions,
  getActiveMemories: () => get().memories.filter((m) => m.isActive),
}));
