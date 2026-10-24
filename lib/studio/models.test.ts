import { describe, expect, it } from "vitest";
import { getStudioModels, resolveStudioModelId, STUDIO_MODEL_IDS } from "@/lib/studio/models";

describe("Studio models", () => {
  it("lista Astra, 6.1 Sol, Luna e 5.6 Sol, sem Grok", () => {
    expect([...STUDIO_MODEL_IDS]).toEqual(["gpt-6-astra", "gpt-6.1-sol", "gpt-6-luna", "gpt-5.6-sol"]);
    expect(getStudioModels().map((model) => model.id)).toEqual([...STUDIO_MODEL_IDS]);
  });

  it.each([
    ["gpt-6-sol", "gpt-6.1-sol"],
    ["gpt-5.6-terra", "gpt-6.1-sol"],
    ["gpt-5.6-sol", "gpt-5.6-sol"],
    ["gpt-5.6-luna", "gpt-6-luna"],
    ["gpt-5.4-mini", "gpt-6-luna"],
    ["grok-4.7", "gpt-6-luna"],
  ])("resolve a escolha salva %s para %s", (saved, expected) => {
    expect(resolveStudioModelId(saved)).toBe(expected);
  });
});
