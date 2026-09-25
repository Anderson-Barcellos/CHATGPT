import { describe, expect, it } from "vitest";
import { DEFAULT_SOUNDCASE_SETTINGS, normalizeSoundCaseSettings } from "@/hooks/useSoundCaseSettings";

describe("SoundCase file TTS preferences", () => {
  it("starts new installations with Grok Orion", () => {
    expect(normalizeSoundCaseSettings(null)).toEqual(DEFAULT_SOUNDCASE_SETTINGS);
    expect(DEFAULT_SOUNDCASE_SETTINGS).toMatchObject({ ttsProvider: "grok", grokVoice: "orion" });
  });

  it("preserves OpenAI for a legacy saved preference", () => {
    expect(normalizeSoundCaseSettings(JSON.stringify({ automatic: true, format: "mp3" })))
      .toMatchObject({ ttsProvider: "openai", grokVoice: "orion" });
  });
});
