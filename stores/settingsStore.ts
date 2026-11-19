import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  ModelParameters,
  ModelScopedParameters,
  CustomInstructions,
  Memory,
} from "@/types";
import {
  getSupportedReasoningEfforts,
  isDeepSeekModel,
  modelSupportsReasoningMode,
} from "@/lib/models/modelConfig";
import {
  DEFAULT_CHAT_MODEL_CATALOG,
  getChatModel,
  inferChatModelProvider,
  type ChatModelCatalog,
} from "@/lib/models/chatModelCatalog";

type ModelSettingsMap = Record<string, ModelScopedParameters>;
interface SettingsState {
  parameters: ModelParameters;
  modelSettingsById: ModelSettingsMap;
  chatModelCatalog: ChatModelCatalog;
  catalogLoaded: boolean;
  pendingModelId: string | null;
  customInstructions: CustomInstructions | null;
  memories: Memory[];
  updateParameters: (updates: Partial<ModelParameters>) => void;
  setChatModelCatalog: (catalog: ChatModelCatalog, replacement?: { from: string; to: string }) => void;
  setCustomInstructions: (instructions: CustomInstructions | null) => void;
  setMemories: (memories: Memory[]) => void;
  getModelParameters: () => ModelParameters;
  getCustomInstructions: () => CustomInstructions | null;
  getActiveMemories: () => Memory[];
}

const DEFAULT_MODEL = "gpt-6-luna";

const LEGACY_MODEL_FALLBACKS: Record<string, string> = {
  "gpt-6-sol": "gpt-6.1-sol",
  "gpt-5.6-luna": "gpt-6-luna",
  "gpt-5.6-terra": "gpt-6.1-sol",
  "deepseek-v4-pro": "deepseek-flash",
  // Este store pertence ao chat. Astra e Gemini permanecem no catálogo para
  // Studio, Pulse e históricos, mas preferências antigas do chat caem em Luna.
  "gpt-6-astra": DEFAULT_MODEL,
  "gemini-3.7-flash": DEFAULT_MODEL,
  "gemini-3.8-flash": DEFAULT_MODEL,
  "gpt-chat-latest": "chat-latest",
  "gpt-5-chat-latest": "chat-latest",
  "gpt-5.1-chat-latest": DEFAULT_MODEL,
  "gpt-5.3-chat-latest": DEFAULT_MODEL,
  "gpt-5.4-mini": DEFAULT_MODEL,
  "grok-4.7": DEFAULT_MODEL,
  "gpt-5.1": DEFAULT_MODEL,
  "gpt-4.1": DEFAULT_MODEL,
  o3: DEFAULT_MODEL,
};

const REMOVED_CHAT_MODEL_IDS = new Set([
  "gpt-6-astra",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
]);

function resolveSupportedModelId(
  modelId: string | undefined,
  catalog = DEFAULT_CHAT_MODEL_CATALOG
): string {
  const fallback = catalog.rows.find((row) => row.model.id === DEFAULT_MODEL && row.visible)
    ?? catalog.rows.find((row) => row.visible);
  if (!modelId) return fallback?.model.id ?? DEFAULT_MODEL;
  const managed = catalog.rows.find((row) => row.model.id === modelId);
  if (managed?.visible) return modelId;
  const legacy = Object.hasOwn(LEGACY_MODEL_FALLBACKS, modelId) ? LEGACY_MODEL_FALLBACKS[modelId] : undefined;
  if (legacy) {
    const replacement = catalog.rows.find((row) => row.model.id === legacy);
    if (replacement?.visible || (!replacement && !DEFAULT_CHAT_MODEL_CATALOG.rows.some(row => row.model.id === legacy) && getChatModel(legacy)?.selectable !== false)) return legacy;
    return fallback?.model.id ?? DEFAULT_MODEL;
  }
  const model = getChatModel(modelId, catalog);
  if (!managed && model && model.selectable !== false && !DEFAULT_CHAT_MODEL_CATALOG.rows.some(row => row.model.id === modelId)) return modelId;
  return fallback?.model.id ?? DEFAULT_MODEL;
}

function usesNoReasoningByDefault(modelId: string): boolean {
  return (
    modelId === "chat-latest" ||
    modelId.includes("-mini") ||
    modelId.includes("-nano")
  );
}

function buildDefaultModelSettings(modelId: string, catalog?: ChatModelCatalog): ModelScopedParameters {
  const model = getChatModel(modelId, catalog);
  const efforts = getSupportedReasoningEfforts(modelId, model);
  const preferredEffort = isDeepSeekModel(modelId) ? "low"
    : modelId === "gemini-3.8-flash" ? "high"
    : usesNoReasoningByDefault(modelId) ? "none"
    : "medium";
  const defaultReasoningEffort = efforts.includes(preferredEffort) ? preferredEffort : efforts[0] ?? "none";
  const defaultReasoningSummary = "detailed" as const;

  return {
    maxOutputTokens: model?.maxOutput || 32768,
    temperature: 0.8,
    topP: 0.95,
    reasoningEffort: model?.fixedReasoningEffort ?? defaultReasoningEffort,
    reasoningMode: "standard",
    reasoningSummary: defaultReasoningSummary,
    verbosity:
      model?.fixedVerbosity ??
      (isDeepSeekModel(modelId) ? "high" : "medium"),
    codeInterpreterEnabled: false,
  };
}

function clampModelSettings(
  modelId: string,
  settings: ModelScopedParameters,
  catalog?: ChatModelCatalog
): ModelScopedParameters {
  const model = getChatModel(modelId, catalog);
  const modelMaxOutput = model?.maxOutput;
  const maxOutputTokens = modelMaxOutput
    ? Math.min(Math.max(Math.round(settings.maxOutputTokens), 256), modelMaxOutput)
    : Math.max(Math.round(settings.maxOutputTokens), 256);

  const supportedEfforts = getSupportedReasoningEfforts(modelId, model);
  const reasoningEffort = supportedEfforts.includes(settings.reasoningEffort)
    ? settings.reasoningEffort
    : buildDefaultModelSettings(modelId, catalog).reasoningEffort;
  const reasoningMode = modelSupportsReasoningMode(
    modelId,
    settings.reasoningMode,
    model
  )
    ? settings.reasoningMode
    : "standard";
  const fixedReasoningEffort = model?.fixedReasoningEffort;
  const fixedVerbosity = model?.fixedVerbosity;
  const isDeepSeek = isDeepSeekModel(modelId);
  const codeInterpreterEnabled =
    !isDeepSeek && model?.supportsCodeInterpreter
      ? settings.codeInterpreterEnabled
      : false;

  return {
    ...settings,
    maxOutputTokens,
    temperature: Number(settings.temperature.toFixed(2)),
    topP: Number(settings.topP.toFixed(2)),
    reasoningEffort: isDeepSeek
      ? "low"
      : fixedReasoningEffort ?? reasoningEffort,
    reasoningMode,
    verbosity: isDeepSeek ? "high" : fixedVerbosity ?? settings.verbosity,
    codeInterpreterEnabled,
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
  modelSettingsById: ModelSettingsMap,
  catalog?: ChatModelCatalog
): ModelScopedParameters {
  return clampModelSettings(modelId, {
    ...buildDefaultModelSettings(modelId, catalog),
    ...sanitizeScopedSettings(modelSettingsById[modelId]),
  }, catalog);
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

export const SETTINGS_STORAGE_KEY = "gaucho-chat:settings:v1";

interface PersistedSettings {
  model: string;
  systemPrompt: string;
  modelSettingsById: ModelSettingsMap;
}

/**
 * Só modelo, prompt de sistema e parâmetros por modelo vão para o
 * localStorage; memórias e instruções vivem no servidor. O merge reconstrói
 * `parameters` passando pelo mesmo clamp do runtime, então um modelo que
 * deixou de existir cai no suportado mais próximo (B6).
 */
function mergePersistedSettings(
  persisted: unknown,
  current: SettingsState
): SettingsState {
  const raw = (persisted ?? {}) as Partial<PersistedSettings>;
  const modelSettingsById: ModelSettingsMap = {
    ...current.modelSettingsById,
    ...(raw.modelSettingsById && typeof raw.modelSettingsById === "object"
      ? raw.modelSettingsById
      : {}),
  };
  for (const [oldId, newId] of [
    ["gpt-6-sol", "gpt-6.1-sol"],
    ["gpt-5.6-terra", "gpt-6.1-sol"],
    ["gpt-5.6-luna", "gpt-6-luna"],
    ["deepseek-v4-pro", "deepseek-flash"],
  ] as const) {
    if (!modelSettingsById[newId] && modelSettingsById[oldId]) {
      modelSettingsById[newId] = clampModelSettings(newId, {
        ...buildDefaultModelSettings(newId),
        ...sanitizeScopedSettings(modelSettingsById[oldId]),
      });
    }
  }
  const persistedModel = typeof raw.model === "string" ? raw.model : current.parameters.model;
  const catalog = current.chatModelCatalog;
  const pendingModelId = !current.catalogLoaded && !getChatModel(persistedModel, catalog)
    && !Object.hasOwn(LEGACY_MODEL_FALLBACKS, persistedModel) && inferChatModelProvider(persistedModel)
    ? persistedModel : null;
  const model = resolveSupportedModelId(persistedModel, catalog);
  const fallsBackToLuna =
    persistedModel !== model && REMOVED_CHAT_MODEL_IDS.has(persistedModel);
  const systemPrompt =
    typeof raw.systemPrompt === "string" ? raw.systemPrompt : current.parameters.systemPrompt;
  const scoped = clampModelSettings(model, {
    ...buildDefaultModelSettings(model, catalog),
    ...(!fallsBackToLuna && !pendingModelId &&
      sanitizeScopedSettings(modelSettingsById[model] ?? modelSettingsById[persistedModel])),
  }, catalog);
  modelSettingsById[model] = scoped;
  return {
    ...current,
    pendingModelId,
    modelSettingsById,
    parameters: mergeModelParameters(model, systemPrompt, scoped),
  };
}

/**
 * v2: o default do Luna subiu de `low` para `medium`. Quem veio da v1 com o
 * `low` antigo sobe uma vez; um `low` escolhido depois da v2 é respeitado.
 */
function migratePersistedSettings(persisted: unknown, version: number): PersistedSettings {
  const raw = (persisted ?? {}) as PersistedSettings;
  if (version >= 2 || !raw.modelSettingsById || typeof raw.modelSettingsById !== "object") {
    return raw;
  }
  const modelSettingsById = { ...raw.modelSettingsById };
  for (const lunaId of ["gpt-6-luna", "gpt-5.6-luna"]) {
    const luna = modelSettingsById[lunaId];
    if (luna?.reasoningEffort === "low") {
      modelSettingsById[lunaId] = { ...luna, reasoningEffort: "medium" };
    }
  }
  return { ...raw, modelSettingsById };
}

function sanitizeScopedSettings(
  value: Partial<ModelScopedParameters> | undefined
): Partial<ModelScopedParameters> {
  if (!value || typeof value !== "object") return {};
  const numeric = (input: unknown) =>
    typeof input === "number" && Number.isFinite(input) ? input : undefined;
  return pickModelScopedUpdates({
    ...value,
    maxOutputTokens: numeric(value.maxOutputTokens),
    temperature: numeric(value.temperature),
    topP: numeric(value.topP),
  } as Partial<ModelParameters>);
}

export const useSettingsStore = create<SettingsState>()(persist((set, get) => ({
  parameters: defaultParameters,
  chatModelCatalog: DEFAULT_CHAT_MODEL_CATALOG,
  catalogLoaded: false,
  pendingModelId: null,
  modelSettingsById: {
    [DEFAULT_MODEL]: defaultModelSettings,
  },
  customInstructions: null,
  memories: [],
  setChatModelCatalog: (catalog, replacement) =>
    set((state) => {
      if (state.catalogLoaded && catalog.revision <= state.chatModelCatalog.revision) return state;
      const selected = state.pendingModelId ?? state.parameters.model;
      const model = resolveSupportedModelId(replacement?.from === selected ? replacement.to : selected, catalog);
      const scoped = resolveModelSettings(model, state.modelSettingsById, catalog);
      return {
        chatModelCatalog: catalog,
        catalogLoaded: true,
        pendingModelId: null,
        parameters: mergeModelParameters(model, state.parameters.systemPrompt, scoped),
      };
    }),
  updateParameters: (updates) =>
    set((state) => {
      const catalog = state.chatModelCatalog;
      const currentModel = state.parameters.model;
      const nextModel = resolveSupportedModelId(updates.model ?? currentModel, catalog);
      const nextSystemPrompt = updates.systemPrompt ?? state.parameters.systemPrompt;
      const scopedUpdates = pickModelScopedUpdates(updates);
      const modelSettingsById = {
        ...state.modelSettingsById,
        [currentModel]: clampModelSettings(
          currentModel,
          extractModelSettings(state.parameters),
          catalog
        ),
      };

      const nextScopedSettings =
        nextModel === currentModel
          ? clampModelSettings(currentModel, {
              ...modelSettingsById[currentModel],
              ...scopedUpdates,
            }, catalog)
          : clampModelSettings(nextModel, {
              ...resolveModelSettings(nextModel, modelSettingsById, catalog),
              ...scopedUpdates,
            }, catalog);

      modelSettingsById[nextModel] = nextScopedSettings;

      return {
        pendingModelId: updates.model === undefined ? state.pendingModelId : null,
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
}), {
  name: SETTINGS_STORAGE_KEY,
  version: 2,
  storage: createJSONStorage(() => localStorage),
  migrate: (persisted, version) => migratePersistedSettings(persisted, version),
  // Hidratação manual no cliente (SettingsHydrator) para não divergir do SSR.
  skipHydration: true,
  partialize: (state): PersistedSettings => ({
    model: state.pendingModelId ?? state.parameters.model,
    systemPrompt: state.parameters.systemPrompt,
    modelSettingsById: state.modelSettingsById,
  }),
  merge: (persisted, current) => mergePersistedSettings(persisted, current),
}));
