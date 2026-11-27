import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GeminiTtsSettingsFields } from "@/components/settings/GeminiTtsSettingsFields";
import { SoundCaseGrokRealtimeSettings } from "@/components/soundcase/SoundCaseGrokRealtimeSettings";

describe("seção de ajustes do Gemini TTS", () => {
  it("mostra Charon, Fronteira Técnica e a cadência compartilhada", () => {
    const markup = renderToStaticMarkup(
      <GeminiTtsSettingsFields settings={{ pace: "dinamico", expressiveness: "alta" }} onChange={() => undefined} />,
    );
    expect(markup).toContain("Charon");
    expect(markup).toContain("Fronteira Técnica");
    expect(markup).toContain('aria-label="Cadência Gemini TTS"');
    expect(markup).toMatch(/<option value="dinamico" selected="">/);
    expect(markup).toContain('aria-label="Expressividade Gemini TTS"');
    expect(markup).toMatch(/<option value="alta" selected="">/);
  });

  it("aparece no SoundCase quando a leitura ao vivo é o Gemini TTS", () => {
    const live = renderToStaticMarkup(
      <SoundCaseGrokRealtimeSettings settings={{ engine: "gemini-tts", voice: "eve", speed: 1 }} onChange={() => undefined} />,
    );
    expect(live).toContain('aria-label="Cadência Gemini TTS"');
    expect(live).toContain("Charon");
    expect(live).toContain('aria-label="Expressividade Gemini TTS"');
    expect(live).not.toContain('aria-label="Voz Grok"');
    const grok = renderToStaticMarkup(
      <SoundCaseGrokRealtimeSettings settings={{ engine: "grok", voice: "eve", speed: 1 }} onChange={() => undefined} />,
    );
    expect(grok).not.toContain('aria-label="Cadência Gemini TTS"');
  });
});
