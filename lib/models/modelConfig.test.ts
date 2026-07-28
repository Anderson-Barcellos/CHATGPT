import { describe, expect, it } from "vitest";
import {
  getChatModels,
  getSupportedReasoningEfforts,
  isGeminiModel,
  modelSupportsVerbosity,
  modelSupportsReasoningMode,
} from "./modelConfig";

describe("GPT-5.6 model capabilities", () => {
  it("shows Gemini 3.6 Flash alongside the current selectable chat models", () => {
    const ids = getChatModels().map((model) => model.id);

    expect(ids).toEqual([
      "gpt-5.6-sol",
      "gpt-5.6-luna",
      "gpt-5.4-mini",
      "deepseek-v4-pro",
      "gemini-3.6-flash",
    ]);
  });

  it("offers max reasoning only to GPT-5.6 models", () => {
    expect(getSupportedReasoningEfforts("gpt-5.6-sol")).toContain("max");
    expect(getSupportedReasoningEfforts("gpt-5.6-luna")).toContain("max");
    expect(getSupportedReasoningEfforts("gpt-5.5")).not.toContain("max");
  });

  it("offers Pro mode only to GPT-5.6 models", () => {
    expect(modelSupportsReasoningMode("gpt-5.6-sol", "pro")).toBe(true);
    expect(modelSupportsReasoningMode("gpt-5.6-luna", "pro")).toBe(true);
    expect(modelSupportsReasoningMode("gpt-5.5", "pro")).toBe(false);
  });

  it("does not send text verbosity to the ChatGPT Instant alias", () => {
    expect(modelSupportsVerbosity("chat-latest")).toBe(false);
  });

  it("offers only Gemini thinking levels to Gemini 3.6 Flash", () => {
    expect(getSupportedReasoningEfforts("gemini-3.6-flash")).toEqual([
      "minimal",
      "low",
      "medium",
      "high",
    ]);
    expect(modelSupportsVerbosity("gemini-3.6-flash")).toBe(false);
    expect(modelSupportsReasoningMode("gemini-3.6-flash", "pro")).toBe(false);
    expect(isGeminiModel("gemini-3.6-flash")).toBe(true);
  });
});
