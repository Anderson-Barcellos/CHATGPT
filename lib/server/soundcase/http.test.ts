import { describe, expect, it } from "vitest";
import { parseSoundCaseSettings } from "@/lib/server/soundcase/http";

const base = { automatic: true, playbackMode: "silent", format: "mp3", voiceOverride: null, speedOverride: null, instructionsOverride: null };

describe("configurações de geração do SoundCase", () => {
  it("aceita Gemini como TTS do arquivo com cadência e expressividade", () => {
    expect(parseSoundCaseSettings({ ...base, ttsProvider: "gemini", geminiPace: "calmo", geminiExpressiveness: "alta" }))
      .toMatchObject({ ttsProvider: "gemini", geminiPace: "calmo", geminiExpressiveness: "alta" });
    expect(parseSoundCaseSettings({ ...base, ttsProvider: "gemini" }))
      .toMatchObject({ ttsProvider: "gemini", geminiPace: "natural", geminiExpressiveness: "equilibrada" });
  });

  it("recusa cadência desconhecida e provedor inexistente", () => {
    expect(parseSoundCaseSettings({ ...base, ttsProvider: "gemini", geminiPace: "galope" })).toBeNull();
    expect(parseSoundCaseSettings({ ...base, ttsProvider: "outro" })).toBeNull();
  });

  it("mantém OpenAI e Grok como antes", () => {
    expect(parseSoundCaseSettings(base)).toMatchObject({ ttsProvider: "openai", grokVoice: "orion" });
    const grok = parseSoundCaseSettings({ ...base, ttsProvider: "grok", grokVoice: "eve" });
    expect(grok).toMatchObject({ ttsProvider: "grok", grokVoice: "eve" });
    expect(grok).not.toHaveProperty("geminiPace");
  });
});
