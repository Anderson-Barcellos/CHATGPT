import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OpenAILiveSettingsFields } from "@/components/settings/OpenAILiveSettingsFields";
import { SoundCaseGrokRealtimeSettings } from "@/components/soundcase/SoundCaseGrokRealtimeSettings";

describe("seção de ajustes do OpenAI Live", () => {
  it("mostra voz e ritmo com as vozes brasileiras", () => {
    const markup = renderToStaticMarkup(
      <OpenAILiveSettingsFields settings={{ voice: "tempo", pace: "agil" }} onChange={() => undefined} />,
    );
    expect(markup).toContain('aria-label="Voz OpenAI Live"');
    expect(markup).toContain('aria-label="Ritmo OpenAI Live"');
    expect(markup).toContain("Bossa");
    expect(markup).toContain("Tempo");
    expect(markup).toMatch(/<option value="tempo" selected="">/);
  });

  it("aparece no SoundCase quando a leitura ao vivo é o OpenAI Live", () => {
    const live = renderToStaticMarkup(
      <SoundCaseGrokRealtimeSettings settings={{ engine: "openai-live", voice: "eve", speed: 1 }} onChange={() => undefined} />,
    );
    expect(live).toContain('aria-label="Voz OpenAI Live"');
    expect(live).not.toContain('aria-label="Voz Grok"');
    const grok = renderToStaticMarkup(
      <SoundCaseGrokRealtimeSettings settings={{ engine: "grok", voice: "eve", speed: 1 }} onChange={() => undefined} />,
    );
    expect(grok).not.toContain('aria-label="Voz OpenAI Live"');
  });
});
