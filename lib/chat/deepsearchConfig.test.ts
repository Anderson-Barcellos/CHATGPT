import { describe, expect, it } from "vitest";
import { resolveDeepsearchProfile } from "./deepsearchConfig";

describe("Deepsearch profiles", () => {
  it("uses GPT-5.4 mini with high reasoning for Medium", () => {
    expect(resolveDeepsearchProfile("deepsearch_medium")).toEqual({
      model: "gpt-5.4-mini",
      reasoningEffort: "high",
    });
  });

  it("keeps GPT-5.4 with high reasoning for High", () => {
    expect(resolveDeepsearchProfile("deepsearch_high")).toEqual({
      model: "gpt-5.4",
      reasoningEffort: "high",
    });
  });
});
