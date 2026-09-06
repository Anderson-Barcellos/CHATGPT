import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SoundCaseRealtimeProvider } from "@/components/soundcase/SoundCaseRealtimeProvider";
import {
  SoundCaseWorkspace,
  type SoundCaseWorkspaceVariant,
} from "@/components/soundcase/SoundCaseWorkspace";

function renderWorkspace(variant: SoundCaseWorkspaceVariant): string {
  return renderToStaticMarkup(
    <SoundCaseRealtimeProvider>
      <SoundCaseWorkspace variant={variant} />
    </SoundCaseRealtimeProvider>
  );
}

describe("SoundCase workspace variants", () => {
  it("opens the page on the library without a persistent editor or mobile dock", () => {
    const markup = renderWorkspace("page");

    expect(markup).not.toContain('aria-label="Ações do SoundCase"');
    expect(markup).not.toContain('aria-label="Texto para narração"');
    expect(markup).toContain("Suas narrações");
    expect(markup).toContain("Nova narração");
    expect(markup).toContain('data-variant="page"');
  });

  it("opens the panel on the same library without nested sheets", () => {
    const markup = renderWorkspace("panel");

    expect(markup).toContain('data-variant="panel"');
    expect(markup).toContain('data-slot="collapsible"');
    // Sem dock e sem Sheet aninhado dentro do painel lateral.
    expect(markup).not.toContain('aria-label="Ações do SoundCase"');
    expect(markup).not.toContain('data-slot="sheet-content"');
    expect(markup).toContain("Suas narrações");
    expect(markup).not.toContain('aria-label="Texto para narração"');
  });
});
