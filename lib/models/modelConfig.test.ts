import { describe, expect, it } from "vitest";
import {
  calculateCost,
  getChatModels,
  getFixedReasoningEffort,
  getFixedVerbosity,
  getSupportedReasoningEfforts,
  isAnthropicModel,
  isDeepSeekModel,
  isGeminiModel,
  MODELS,
  modelSupportsVerbosity,
  modelSupportsReasoningMode,
} from "./modelConfig";

describe("chat model capabilities", () => {
  it("mostra Claude nas escolhas de chat e preserva Astra/Gemini apenas no catálogo", () => {
    const ids = getChatModels().map((model) => model.id);

    expect(ids).toEqual([
      "gpt-6.1-sol",
      "gpt-6-luna",
      "gpt-5.6-sol",
      "deepseek-flash",
      "claude-sonnet-5-5",
      "claude-opus-5-5",
    ]);
    expect(MODELS["gpt-6-astra"]?.hiddenFromChatSelector).toBe(true);
    expect(MODELS["gemini-3.8-flash"]?.hiddenFromChatSelector).toBe(true);
    expect(MODELS["grok-4.7"]).toBeUndefined();
    expect(MODELS["gpt-6-sol"]).toBeUndefined();
    expect(MODELS["deepseek-v4-pro"]).toBeUndefined();
  });

  it("dá ao GPT-6.1 Sol de low a max, sem none e sem modo Pro", () => {
    expect(getSupportedReasoningEfforts("gpt-6.1-sol")).toEqual(["low", "medium", "high", "xhigh", "max"]);
    expect(modelSupportsReasoningMode("gpt-6.1-sol", "pro")).toBe(false);
  });

  it("devolve o modo Pro e o esforço max ao GPT-5.6 Sol", () => {
    expect(modelSupportsReasoningMode("gpt-5.6-sol", "pro")).toBe(true);
    expect(getSupportedReasoningEfforts("gpt-5.6-sol")).toContain("max");
    expect(calculateCost(1_000_000, 1_000_000, "gpt-5.6-sol").totalCost).toBe(35);
  });

  it("reconhece o DeepSeek V4.1 Flash e cobra a tarifa de pico", () => {
    expect(isDeepSeekModel("deepseek-flash")).toBe(true);
    expect(isDeepSeekModel("deepseek-v4-pro")).toBe(false);
    expect(calculateCost(1_000_000, 1_000_000, "deepseek-flash").totalCost).toBeCloseTo(1.5, 6);
    expect(calculateCost(1_000_000, 0, "deepseek-flash", 1_000_000).totalCost).toBeCloseTo(0.006, 6);
  });

  it("offers max reasoning to GPT-6 models", () => {
    expect(getSupportedReasoningEfforts("gpt-6-astra")).toContain("max");
    expect(getSupportedReasoningEfforts("gpt-6.1-sol")).toContain("max");
    expect(getSupportedReasoningEfforts("gpt-6-luna")).toContain("max");
    expect(getSupportedReasoningEfforts("gpt-5.5")).not.toContain("max");
  });

  it("does not offer the GPT-5.6 Pro mode to GPT-6", () => {
    expect(modelSupportsReasoningMode("gpt-6-astra", "pro")).toBe(false);
    expect(modelSupportsReasoningMode("gpt-6.1-sol", "pro")).toBe(false);
    expect(modelSupportsReasoningMode("gpt-6-luna", "pro")).toBe(false);
    expect(modelSupportsReasoningMode("gpt-5.5", "pro")).toBe(false);
  });

  it("does not send text verbosity to the ChatGPT Instant alias", () => {
    expect(modelSupportsVerbosity("chat-latest")).toBe(false);
  });

  it("locks GPT-6 Astra controls to medium", () => {
    expect(getFixedReasoningEffort("gpt-6-astra")).toBe("medium");
    expect(getFixedVerbosity("gpt-6-astra")).toBe("medium");
  });

  it("prices GPT-6.1 Sol and Luna at standard and long-context rates", () => {
    expect(calculateCost(1_000_000, 1_000_000, "gpt-6.1-sol").totalCost).toBe(19);
    expect(calculateCost(1_000_000, 1_000_000, "gpt-6-luna").totalCost).toBe(0.95);
    expect(calculateCost(272_000, 0, "gpt-6.1-sol").totalCost).toBe(0.544);
    expect(calculateCost(272_001, 0, "gpt-6.1-sol").totalCost).toBe(1.088004);
    expect(calculateCost(1_000_000, 0, "gpt-6.1-sol", 1_000_000).totalCost).toBeCloseTo(0.2, 6);
    expect(calculateCost(100_000, 0, "gpt-6.1-sol", 100_000).totalCost).toBeCloseTo(0.01, 6);
  });

  it("offers only Gemini thinking levels to Gemini 3.8 Flash", () => {
    expect(getSupportedReasoningEfforts("gemini-3.8-flash")).toEqual([
      "low",
      "medium",
      "high",
    ]);
    expect(modelSupportsVerbosity("gemini-3.8-flash")).toBe(false);
    expect(modelSupportsReasoningMode("gemini-3.8-flash", "pro")).toBe(false);
    expect(isGeminiModel("gemini-3.8-flash")).toBe(true);
  });

  it.each([
    ["claude-sonnet-5-5", 2, 10, 0.1],
    ["claude-opus-5-5", 4, 20, 0.2],
  ] as const)("descreve %s com contexto, preços e capacidades Claude", (model, input, output, cachedInput) => {
    expect(isAnthropicModel(model)).toBe(true);
    expect(MODELS[model]).toMatchObject({
      family: "anthropic",
      contextWindow: 1_000_000,
      maxOutput: 128_000,
      pricing: { input, output, cachedInput },
      supportsTemperature: false,
      supportsVerbosity: false,
      supportsCodeInterpreter: false,
      supportedReasoningEfforts: ["low", "medium", "high"],
    });
    expect(MODELS[model]?.capabilities).toEqual(
      expect.arrayContaining(["chat", "reasoning", "vision"])
    );
    expect(modelSupportsReasoningMode(model, "pro")).toBe(false);
    expect(calculateCost(1_000_000, 1_000_000, model).totalCost).toBe(input + output);
    expect(calculateCost(1_000_000, 0, model, 1_000_000).totalCost).toBe(cachedInput);
  });
});
