import { describe, expect, it } from "vitest";
import { buildReasoningConfig } from "@/lib/chat/reasoningConfig";

describe("buildReasoningConfig", () => {
  it("does not send reasoning for non-reasoning models", () => {
    expect(buildReasoningConfig("gpt-image-2", "high", "detailed")).toBeUndefined();
  });

  it("does not send reasoning when effort is none", () => {
    expect(buildReasoningConfig("gpt-5.4-mini", "none", "detailed")).toBeUndefined();
  });

  it("passes the selected reasoning effort and summary through", () => {
    expect(buildReasoningConfig("gpt-5.4-mini", "high", "concise")).toEqual({
      effort: "high",
      summary: "concise",
    });
  });

  it("omits summary when local preference is off", () => {
    expect(buildReasoningConfig("gpt-5.4-mini", "medium", "off")).toEqual({
      effort: "medium",
    });
  });

  it("adds Pro mode independently from the selected effort", () => {
    expect(
      buildReasoningConfig("gpt-5.6-luna", "low", "detailed", "pro")
    ).toEqual({ effort: "low", summary: "detailed", mode: "pro" });
  });

  it("omits standard mode from the API payload", () => {
    expect(
      buildReasoningConfig("gpt-5.6-sol", "medium", "detailed", "standard")
    ).toEqual({ effort: "medium", summary: "detailed" });
  });

  it("does not send Pro mode to models that do not support it", () => {
    expect(
      buildReasoningConfig("gpt-5.4", "high", "detailed", "pro")
    ).toEqual({ effort: "high", summary: "detailed" });
  });
});
