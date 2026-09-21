import { describe, expect, it } from "vitest";
import { normalizeSoundCaseGrokSettings } from "@/hooks/useSoundCaseGrokSettings";

describe("SoundCase Grok preferences", () => {
  it("keeps Grok preferences independent and constrains speed", () => {
    expect(normalizeSoundCaseGrokSettings(JSON.stringify({ engine: "grok", voice: "eve", speed: 9 }))).toEqual({ engine: "grok", voice: "eve", speed: 1.5 });
    expect(normalizeSoundCaseGrokSettings(JSON.stringify({ engine: "openai", voice: "", speed: 0 }))).toEqual({ engine: "openai", voice: "eve", speed: 0.7 });
  });
});
