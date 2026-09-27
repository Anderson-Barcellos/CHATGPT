import { describe, expect, it } from "vitest";
import { MODELS } from "@/lib/models/modelConfig";
import { resolveDeepsearchProfile } from "./deepsearchConfig";

describe("Deepsearch profiles", () => {
  it("uses GPT-6 Luna with medium reasoning for Medium", () => {
    expect(resolveDeepsearchProfile("deepsearch_medium")).toEqual({
      model: "gpt-6-luna",
      reasoningEffort: "medium",
    });
  });

  it("uses GPT-6 Sol with high reasoning for High", () => {
    expect(resolveDeepsearchProfile("deepsearch_high")).toEqual({
      model: "gpt-6-sol",
      reasoningEffort: "high",
    });
  });

  it("only points to catalogued models that accept the fixed effort", () => {
    for (const mode of ["deepsearch_medium", "deepsearch_high"] as const) {
      const { model, reasoningEffort } = resolveDeepsearchProfile(mode);
      expect(MODELS[model]?.supportedReasoningEfforts).toContain(reasoningEffort);
    }
  });
});
