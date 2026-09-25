import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DirectionSidebar } from "@/components/soundcase/DirectionSidebar";

describe("SoundCase direction sidebar", () => {
  it("shows the file TTS separately from realtime and hides OpenAI voice instructions for Grok", () => {
    const markup = renderToStaticMarkup(<DirectionSidebar
      settings={{ ttsProvider: "grok", grokVoice: "orion", automatic: true, playbackMode: "silent", format: "flac",
        voiceOverride: null, speedOverride: null, instructionsOverride: null }}
      onChange={vi.fn()} onGenerate={vi.fn()}
    />);
    expect(markup).toContain('aria-label="TTS do arquivo"');
    expect(markup).toContain('aria-label="Voz Grok do arquivo"');
    expect(markup).not.toContain('aria-label="Instruções de leitura"');
    expect(markup).toContain("Gerar silenciosamente");
  });
  it("exposes Luna automatic direction and both generation modes", () => {
    const markup = renderToStaticMarkup(<DirectionSidebar
      settings={{ automatic: true, playbackMode: "realtime", format: "mp3", voiceOverride: null, speedOverride: null, instructionsOverride: null }}
      onChange={vi.fn()} onGenerate={vi.fn()}
    />);
    expect(markup).toContain("Automático · Luna");
    expect(markup).toContain("Gerar e ouvir agora");
    expect(markup).toContain("Gerar silenciosamente");
    expect(markup).toContain('aria-label="Direção automática com Luna"');
  });
});
