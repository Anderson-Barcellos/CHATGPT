import { describe, expect, it } from "vitest";
import {
  getChatModels,
  getSupportedReasoningEfforts,
  modelSupportsVerbosity,
  modelSupportsReasoningMode,
} from "./modelConfig";

describe("GPT-5.6 model capabilities", () => {
  it("shows only Sol, Luna, GPT-5.4 mini and DeepSeek in the chat selector", () => {
    const ids = getChatModels().map((model) => model.id);

    expect(ids).toEqual([
      "gpt-5.6-sol",
      "gpt-5.6-luna",
      "gpt-5.4-mini",
      "deepseek-v4-pro",
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
});
