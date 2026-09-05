import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SoundCaseRealtimeProvider } from "@/components/soundcase/SoundCaseRealtimeProvider";
import {
  SoundCaseWorkspace,
  type SoundCaseWorkspaceVariant,
} from "@/components/soundcase/SoundCaseWorkspace";

function countOf(markup: string, needle: string): number {
  return markup.split(needle).length - 1;
}

function renderWorkspace(variant: SoundCaseWorkspaceVariant): string {
  return renderToStaticMarkup(
    <SoundCaseRealtimeProvider>
      <SoundCaseWorkspace variant={variant} />
    </SoundCaseRealtimeProvider>
  );
}

describe("SoundCase workspace variants", () => {
  it("keeps the mobile dock and avoids collapsibles in the page variant", () => {
    const markup = renderWorkspace("page");

    expect(markup).toContain('aria-label="Ações do SoundCase"');
    expect(markup).not.toContain('data-slot="collapsible"');
    expect(markup).toContain('data-variant="page"');
  });

  it("uses inline collapsibles and a single generate action in the panel variant", () => {
    const markup = renderWorkspace("panel");

    expect(markup).toContain('data-variant="panel"');
    expect(markup).toContain('data-slot="collapsible"');
    // Sem dock e sem Sheet aninhado dentro do painel lateral.
    expect(markup).not.toContain('aria-label="Ações do SoundCase"');
    expect(markup).not.toContain('data-slot="sheet-content"');
    // A ação de gerar vive só no rodapé do painel.
    expect(countOf(markup, "Gerar e ouvir agora")).toBe(1);
  });
});
