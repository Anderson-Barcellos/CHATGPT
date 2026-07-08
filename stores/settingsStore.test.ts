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

  it("uses GPT-5.4 mini as the chat default", () => {
    expect(useSettingsStore.getState().parameters.model).toBe("gpt-5.4-mini");
    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("none");
    expect(useSettingsStore.getState().parameters.reasoningSummary).toBe("detailed");
  });

  it("defaults full reasoning models to medium reasoning", () => {
    useSettingsStore.getState().updateParameters({ model: "gpt-5.2" });

    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("medium");
    expect(useSettingsStore.getState().parameters.reasoningSummary).toBe("detailed");
  });

  it("supports GPT-5.5 Instant chat latest alias", () => {
    useSettingsStore.getState().updateParameters({ model: "chat-latest" });

    expect(useSettingsStore.getState().parameters.model).toBe("chat-latest");
    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("medium");
  });

  it("defaults mini models to no reasoning", () => {
    useSettingsStore.getState().updateParameters({ model: "gpt-5.4-mini" });
    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("none");
    expect(useSettingsStore.getState().parameters.reasoningSummary).toBe("detailed");
  });

  it("falls legacy removed models back to the current default", () => {
    useSettingsStore.getState().updateParameters({ model: "gpt-5.1" });

    expect(useSettingsStore.getState().parameters.model).toBe("gpt-5.4-mini");
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
});
