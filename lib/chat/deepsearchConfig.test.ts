import { describe, expect, it } from "vitest";
import { resolveDeepsearchProfile } from "./deepsearchConfig";

describe("Deepsearch profiles", () => {
  it("uses Grok 4.7 with fixed medium reasoning for Medium", () => {
    expect(resolveDeepsearchProfile("deepsearch_medium")).toEqual({
      model: "grok-4.7",
      reasoningEffort: "medium",
    });
  });

  it("keeps GPT-5.4 with high reasoning for High", () => {
    expect(resolveDeepsearchProfile("deepsearch_high")).toEqual({
      model: "gpt-5.4",
      reasoningEffort: "high",
    });
  });
});
