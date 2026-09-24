import { beforeEach, describe, expect, it } from "vitest";
import { useSettingsStore } from "@/stores/settingsStore";

const initialState = useSettingsStore.getState();

describe("settings store model defaults", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      parameters: { ...initialState.parameters },
      modelSettingsById: { ...initialState.modelSettingsById },
      customInstructions: null,
      memories: [],
    });
  });

  it("uses GPT-6 Luna with low standard reasoning as the chat default", () => {
    expect(useSettingsStore.getState().parameters.model).toBe("gpt-6-luna");
    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("low");
    expect(useSettingsStore.getState().parameters.reasoningMode).toBe("standard");
    expect(useSettingsStore.getState().parameters.reasoningSummary).toBe("detailed");
  });

  it("defaults GPT-6 Sol to medium standard reasoning", () => {
    useSettingsStore.getState().updateParameters({ model: "gpt-6-sol" });

    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("medium");
    expect(useSettingsStore.getState().parameters.reasoningMode).toBe("standard");
  });

  it("maps a legacy Terra selection to GPT-6 Sol", () => {
    useSettingsStore.getState().updateParameters({ model: "gpt-5.6-terra" });

    expect(useSettingsStore.getState().parameters.model).toBe("gpt-6-sol");
    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("medium");
    expect(useSettingsStore.getState().parameters.reasoningMode).toBe("standard");
    expect(useSettingsStore.getState().parameters.maxOutputTokens).toBe(128_000);
  });

  it("defaults full reasoning models to medium reasoning", () => {
    useSettingsStore.getState().updateParameters({ model: "gpt-5.2" });

    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("medium");
    expect(useSettingsStore.getState().parameters.reasoningSummary).toBe("detailed");
  });

  it("supports GPT-5.5 Instant chat latest alias", () => {
    useSettingsStore.getState().updateParameters({ model: "chat-latest" });

    expect(useSettingsStore.getState().parameters.model).toBe("chat-latest");
    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("none");
  });

  it.each(["chat-latest", "gpt-5.5", "gpt-5.4", "gpt-5.2"])(
    "keeps selector-hidden model %s valid for internal flows",
    (model) => {
      useSettingsStore.getState().updateParameters({ model });

      expect(useSettingsStore.getState().parameters.model).toBe(model);
    }
  );

  it("resolve o mini legado para Grok com reasoning medium fixo", () => {
    useSettingsStore.getState().updateParameters({ model: "gpt-5.4-mini" });

    expect(useSettingsStore.getState().parameters.model).toBe("grok-4.7");
    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("medium");
  });

  it("falls legacy removed models back to the current default", () => {
    useSettingsStore.getState().updateParameters({ model: "gpt-5.1" });

    expect(useSettingsStore.getState().parameters.model).toBe("gpt-6-luna");
  });

  it("maps short chat-latest aliases to Chat Latest", () => {
    useSettingsStore.getState().updateParameters({ model: "gpt-chat-latest" });

    expect(useSettingsStore.getState().parameters.model).toBe("chat-latest");
  });

  it("maps the GPT-5 chat latest slug to Chat Latest", () => {
    useSettingsStore.getState().updateParameters({ model: "gpt-5-chat-latest" });

    expect(useSettingsStore.getState().parameters.model).toBe("chat-latest");
  });

  it("locks DeepSeek V4 Pro to maximum reasoning and high verbosity", () => {
    useSettingsStore.getState().updateParameters({ model: "deepseek-v4-pro" });

    expect(useSettingsStore.getState().parameters.model).toBe("deepseek-v4-pro");
    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("xhigh");
    expect(useSettingsStore.getState().parameters.verbosity).toBe("high");

    useSettingsStore.getState().updateParameters({
      reasoningEffort: "low",
      verbosity: "medium",
    });

    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("xhigh");
    expect(useSettingsStore.getState().parameters.verbosity).toBe("high");
  });

  it("locks GPT-6 Astra to medium reasoning and verbosity", () => {
    useSettingsStore.getState().updateParameters({ model: "gpt-6-astra" });

    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("medium");
    expect(useSettingsStore.getState().parameters.verbosity).toBe("medium");

    useSettingsStore.getState().updateParameters({
      reasoningEffort: "max",
      verbosity: "high",
    });

    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("medium");
    expect(useSettingsStore.getState().parameters.verbosity).toBe("medium");
  });

  it("defaults Gemini 3.8 Flash to high, remembers valid levels and rejects minimal", () => {
    useSettingsStore.getState().updateParameters({ model: "gemini-3.8-flash" });

    expect(useSettingsStore.getState().parameters.model).toBe("gemini-3.8-flash");
    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("high");
    expect(useSettingsStore.getState().parameters.reasoningMode).toBe("standard");
    expect(useSettingsStore.getState().parameters.maxOutputTokens).toBe(65_536);

    useSettingsStore.getState().updateParameters({ reasoningEffort: "low" });
    useSettingsStore.getState().updateParameters({ model: "gpt-6-luna" });
    useSettingsStore.getState().updateParameters({ model: "gemini-3.8-flash" });

    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("low");

    useSettingsStore.getState().updateParameters({ reasoningEffort: "minimal" });
    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("high");
  });

  it("keeps max effort per model and clamps unsupported Pro mode", () => {
    useSettingsStore.getState().updateParameters({
      model: "gpt-6-luna",
      reasoningMode: "pro",
      reasoningEffort: "max",
    });
    useSettingsStore.getState().updateParameters({ model: "gpt-6-sol" });

    expect(useSettingsStore.getState().parameters.reasoningMode).toBe("standard");
    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("medium");

    useSettingsStore.getState().updateParameters({ model: "gpt-6-luna" });
    expect(useSettingsStore.getState().parameters.reasoningMode).toBe("standard");
    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("max");
  });
});
