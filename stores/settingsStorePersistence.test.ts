// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  SETTINGS_STORAGE_KEY,
  useSettingsStore,
} from "@/stores/settingsStore";

const initialState = useSettingsStore.getState();

beforeEach(() => {
  localStorage.clear();
  useSettingsStore.setState({
    parameters: { ...initialState.parameters },
    modelSettingsById: { ...initialState.modelSettingsById },
    customInstructions: null,
    memories: [],
  });
});

describe("settings store persistence (B6)", () => {
  it("keeps the chosen model and its parameters across a reload, but never memories", async () => {
    useSettingsStore.getState().updateParameters({ model: "gpt-6-sol", reasoningEffort: "high" });
    useSettingsStore.getState().setMemories([
      { id: "m1", content: "segredo", category: "general", isActive: true, priority: 1, createdAt: "0", updatedAt: "0" } as never,
    ]);

    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(raw).not.toContain("segredo");

    // Simula o reload: estado em memória volta ao default, storage fica como estava.
    useSettingsStore.setState({
      parameters: { ...initialState.parameters },
      modelSettingsById: { ...initialState.modelSettingsById },
      memories: [],
    });
    expect(useSettingsStore.getState().parameters.model).toBe("gpt-6-luna");
    localStorage.setItem(SETTINGS_STORAGE_KEY, raw!);

    await useSettingsStore.persist.rehydrate();

    const state = useSettingsStore.getState();
    expect(state.parameters.model).toBe("gpt-6-sol");
    expect(state.parameters.reasoningEffort).toBe("high");
    expect(state.memories).toEqual([]);
  });

  it("clamps a persisted model that is no longer supported back to a valid one", async () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        state: {
          model: "gpt-4-turbo-preview",
          systemPrompt: "",
          modelSettingsById: { "gpt-4-turbo-preview": { maxOutputTokens: 999999, reasoningEffort: "max" } },
        },
        version: 1,
      })
    );

    await useSettingsStore.persist.rehydrate();

    const { parameters } = useSettingsStore.getState();
    expect(parameters.model).not.toBe("gpt-4-turbo-preview");
    expect(Number.isFinite(parameters.maxOutputTokens)).toBe(true);
    expect(parameters.reasoningEffort).toBeTruthy();
  });

  it("keeps saved Sol settings while migrating a legacy model id", async () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
      state: {
        model: "gpt-5.6-sol",
        systemPrompt: "",
        modelSettingsById: {
          "gpt-5.6-sol": { maxOutputTokens: 4_096, reasoningEffort: "high", reasoningMode: "pro" },
        },
      },
      version: 1,
    }));

    await useSettingsStore.persist.rehydrate();

    expect(useSettingsStore.getState().parameters).toMatchObject({
      model: "gpt-6-sol",
      maxOutputTokens: 4_096,
      reasoningEffort: "high",
      reasoningMode: "standard",
    });
  });

  it("restores an inactive legacy Sol profile when the user switches models", async () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
      state: {
        model: "gpt-5.6-luna",
        systemPrompt: "",
        modelSettingsById: {
          "gpt-5.6-sol": { maxOutputTokens: 4_096, reasoningEffort: "high", reasoningMode: "pro" },
        },
      },
      version: 1,
    }));

    await useSettingsStore.persist.rehydrate();
    useSettingsStore.getState().updateParameters({ model: "gpt-6-sol" });

    expect(useSettingsStore.getState().parameters).toMatchObject({
      model: "gpt-6-sol",
      maxOutputTokens: 4_096,
      reasoningEffort: "high",
      reasoningMode: "standard",
    });
  });

  it("hidrata a preferência mini legada como Grok sem tocar em dados de conversa", async () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        state: {
          model: "gpt-5.4-mini",
          systemPrompt: "",
          modelSettingsById: {
            "gpt-5.4-mini": {
              maxOutputTokens: 8_000,
              reasoningEffort: "none",
            },
          },
        },
        version: 1,
      })
    );

    await useSettingsStore.persist.rehydrate();

    expect(useSettingsStore.getState().parameters).toMatchObject({
      model: "grok-4.7",
      reasoningEffort: "medium",
    });
  });
});
