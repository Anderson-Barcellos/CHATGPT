import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DirectionSidebar } from "@/components/soundcase/DirectionSidebar";

describe("SoundCase direction sidebar", () => {
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
