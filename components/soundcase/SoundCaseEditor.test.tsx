import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SoundCaseEditor } from "@/components/soundcase/SoundCaseEditor";

describe("SoundCase editor", () => {
  it("renders the editorial textarea, import contract and confirmed progress", () => {
    const markup = renderToStaticMarkup(<SoundCaseEditor
      title="O cérebro que aprende" text="Texto longo" wordCount={2} estimatedDurationSeconds={12}
      progress={{ ratio: .42, label: "Construindo a voz", animated: true }}
      onChange={vi.fn()} onImport={vi.fn()}
    />);
    expect(markup).toContain("O cérebro que aprende");
    expect(markup).toContain('accept=".txt,.md,text/plain,text/markdown"');
    expect(markup).toContain('aria-label="Texto para narração"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain("42%");
  });
});
