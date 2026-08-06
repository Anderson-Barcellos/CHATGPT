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

  it("uses GPT-5.6 Luna with low standard reasoning as the chat default", () => {
    expect(useSettingsStore.getState().parameters.model).toBe("gpt-5.6-luna");
    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("low");
    expect(useSettingsStore.getState().parameters.reasoningMode).toBe("standard");
    expect(useSettingsStore.getState().parameters.reasoningSummary).toBe("detailed");
  });

  it("defaults GPT-5.6 Sol to medium standard reasoning", () => {
    useSettingsStore.getState().updateParameters({ model: "gpt-5.6-sol" });

    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("medium");
    expect(useSettingsStore.getState().parameters.reasoningMode).toBe("standard");
  });

  it("defaults GPT-5.6 Terra to medium standard reasoning", () => {
    useSettingsStore.getState().updateParameters({ model: "gpt-5.6-terra" });

    expect(useSettingsStore.getState().parameters.model).toBe("gpt-5.6-terra");
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

  it("allows GPT-5.4 mini with reasoning disabled by default", () => {
    useSettingsStore.getState().updateParameters({ model: "gpt-5.4-mini" });

    expect(useSettingsStore.getState().parameters.model).toBe("gpt-5.4-mini");
    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("none");
  });

  it("falls legacy removed models back to the current default", () => {
    useSettingsStore.getState().updateParameters({ model: "gpt-5.1" });

    expect(useSettingsStore.getState().parameters.model).toBe("gpt-5.6-luna");
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

  it("defaults Gemini 3.6 Flash to medium thinking and remembers its level", () => {
    useSettingsStore.getState().updateParameters({ model: "gemini-3.6-flash" });

    expect(useSettingsStore.getState().parameters.model).toBe("gemini-3.6-flash");
    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("medium");
    expect(useSettingsStore.getState().parameters.reasoningMode).toBe("standard");
    expect(useSettingsStore.getState().parameters.maxOutputTokens).toBe(65_536);

    useSettingsStore.getState().updateParameters({ reasoningEffort: "minimal" });
    useSettingsStore.getState().updateParameters({ model: "gpt-5.6-luna" });
    useSettingsStore.getState().updateParameters({ model: "gemini-3.6-flash" });

    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("minimal");
  });

  it("remembers Pro mode independently for each GPT-5.6 model", () => {
    useSettingsStore.getState().updateParameters({
      model: "gpt-5.6-luna",
      reasoningMode: "pro",
      reasoningEffort: "max",
    });
    useSettingsStore.getState().updateParameters({ model: "gpt-5.6-sol" });

    expect(useSettingsStore.getState().parameters.reasoningMode).toBe("standard");
    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("medium");

    useSettingsStore.getState().updateParameters({ model: "gpt-5.6-luna" });
    expect(useSettingsStore.getState().parameters.reasoningMode).toBe("pro");
    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("max");
  });
});
