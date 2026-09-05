import { describe, expect, it } from "vitest";
import {
  getChatModels,
  getFixedReasoningEffort,
  getFixedVerbosity,
  getSupportedReasoningEfforts,
  isGeminiModel,
  modelSupportsVerbosity,
  modelSupportsReasoningMode,
} from "./modelConfig";

describe("chat model capabilities", () => {
  it("shows GPT-6 Astra and Gemini 3.8 Flash alongside the current selectable chat models", () => {
    const ids = getChatModels().map((model) => model.id);

    expect(ids).toEqual([
      "gpt-6-astra",
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "gpt-5.6-luna",
      "gpt-5.4-mini",
      "deepseek-v4-pro",
      "gemini-3.8-flash",
    ]);
  });

  it("offers max reasoning to Astra and GPT-5.6 models", () => {
    expect(getSupportedReasoningEfforts("gpt-6-astra")).toContain("max");
    expect(getSupportedReasoningEfforts("gpt-5.6-sol")).toContain("max");
    expect(getSupportedReasoningEfforts("gpt-5.6-terra")).toContain("max");
    expect(getSupportedReasoningEfforts("gpt-5.6-luna")).toContain("max");
    expect(getSupportedReasoningEfforts("gpt-5.5")).not.toContain("max");
  });

  it("offers Pro mode only to GPT-5.6 models", () => {
    expect(modelSupportsReasoningMode("gpt-5.6-sol", "pro")).toBe(true);
    expect(modelSupportsReasoningMode("gpt-5.6-terra", "pro")).toBe(true);
    expect(modelSupportsReasoningMode("gpt-5.6-luna", "pro")).toBe(true);
    expect(modelSupportsReasoningMode("gpt-5.5", "pro")).toBe(false);
  });

  it("does not send text verbosity to the ChatGPT Instant alias", () => {
    expect(modelSupportsVerbosity("chat-latest")).toBe(false);
  });

  it("locks GPT-6 Astra controls to medium", () => {
    expect(getFixedReasoningEffort("gpt-6-astra")).toBe("medium");
    expect(getFixedVerbosity("gpt-6-astra")).toBe("medium");
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
});
