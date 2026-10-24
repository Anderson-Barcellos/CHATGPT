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

  it("uses GPT-6 Luna with medium standard reasoning as the chat default", () => {
    expect(useSettingsStore.getState().parameters.model).toBe("gpt-6-luna");
    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("medium");
    expect(useSettingsStore.getState().parameters.reasoningMode).toBe("standard");
    expect(useSettingsStore.getState().parameters.reasoningSummary).toBe("detailed");
  });

  it("defaults GPT-6.1 Sol to medium standard reasoning", () => {
    useSettingsStore.getState().updateParameters({ model: "gpt-6.1-sol" });

    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("medium");
    expect(useSettingsStore.getState().parameters.reasoningMode).toBe("standard");
  });

  it.each(["claude-sonnet-5-5", "claude-opus-5-5"])(
    "configura %s com reasoning medium e limita os esforços suportados",
    (model) => {
      useSettingsStore.getState().updateParameters({ model });

      expect(useSettingsStore.getState().parameters).toMatchObject({
        model,
        reasoningEffort: "medium",
        reasoningMode: "standard",
        codeInterpreterEnabled: false,
      });

      useSettingsStore.getState().updateParameters({
        reasoningEffort: "max",
        reasoningMode: "pro",
        codeInterpreterEnabled: true,
      });

      expect(useSettingsStore.getState().parameters).toMatchObject({
        reasoningEffort: "medium",
        reasoningMode: "standard",
        codeInterpreterEnabled: false,
      });
    }
  );

  it("maps legacy Terra and GPT-6 Sol selections to GPT-6.1 Sol", () => {
    useSettingsStore.getState().updateParameters({ model: "gpt-6-sol" });
    expect(useSettingsStore.getState().parameters.model).toBe("gpt-6.1-sol");

    useSettingsStore.getState().updateParameters({ model: "gpt-5.6-terra" });

    expect(useSettingsStore.getState().parameters.model).toBe("gpt-6.1-sol");
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

  it("resolve o mini e o Grok legados para o GPT-6 Luna", () => {
    useSettingsStore.getState().updateParameters({ model: "gpt-5.4-mini" });
    expect(useSettingsStore.getState().parameters.model).toBe("gpt-6-luna");

    useSettingsStore.getState().updateParameters({ model: "grok-4.7" });
    expect(useSettingsStore.getState().parameters.model).toBe("gpt-6-luna");
    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("medium");
  });

  it("devolve o esforço none do GPT-6.1 Sol ao default suportado", () => {
    useSettingsStore.getState().updateParameters({ model: "gpt-6.1-sol", reasoningEffort: "none" });

    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("medium");
  });

  it("mantém o modo Pro escolhido no GPT-5.6 Sol", () => {
    useSettingsStore.getState().updateParameters({ model: "gpt-5.6-sol", reasoningMode: "pro" });

    expect(useSettingsStore.getState().parameters.model).toBe("gpt-5.6-sol");
    expect(useSettingsStore.getState().parameters.reasoningMode).toBe("pro");
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

  it("locks DeepSeek V4.1 Flash to low reasoning and high verbosity", () => {
    useSettingsStore.getState().updateParameters({ model: "deepseek-v4-pro" });

    expect(useSettingsStore.getState().parameters.model).toBe("deepseek-flash");
    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("low");
    expect(useSettingsStore.getState().parameters.verbosity).toBe("high");

    useSettingsStore.getState().updateParameters({
      reasoningEffort: "low",
      verbosity: "medium",
    });

    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("low");
    expect(useSettingsStore.getState().parameters.verbosity).toBe("high");
  });

  it.each(["gpt-6-astra", "gemini-3.8-flash", "gemini-3.7-flash"])(
    "resolve a preferência antiga de chat %s para Luna medium",
    (model) => {
      useSettingsStore.getState().updateParameters({ model });

      expect(useSettingsStore.getState().parameters).toMatchObject({
        model: "gpt-6-luna",
        reasoningEffort: "medium",
      });
    }
  );

  it("keeps max effort per model and clamps unsupported Pro mode", () => {
    useSettingsStore.getState().updateParameters({
      model: "gpt-6-luna",
      reasoningMode: "pro",
      reasoningEffort: "max",
    });
    useSettingsStore.getState().updateParameters({ model: "gpt-6.1-sol" });

    expect(useSettingsStore.getState().parameters.reasoningMode).toBe("standard");
    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("medium");

    useSettingsStore.getState().updateParameters({ model: "gpt-6-luna" });
    expect(useSettingsStore.getState().parameters.reasoningMode).toBe("standard");
    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("max");
  });
});
