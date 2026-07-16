import { describe, expect, it } from "vitest";
import {
  getChatModels,
  getSupportedReasoningEfforts,
  modelSupportsReasoningMode,
} from "./modelConfig";

describe("GPT-5.6 model capabilities", () => {
  it("shows Sol and Luna while hiding GPT-5.4 mini from the selector", () => {
    const ids = getChatModels().map((model) => model.id);

    expect(ids).toContain("gpt-5.6-sol");
    expect(ids).toContain("gpt-5.6-luna");
    expect(ids).not.toContain("gpt-5.4-mini");
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
});
