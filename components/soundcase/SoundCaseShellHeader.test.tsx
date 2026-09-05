import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SoundCaseShell } from "@/components/soundcase/SoundCaseShell";

describe("SoundCase route header", () => {
  it("always offers a way back to the Chat, including on mobile", () => {
    const markup = renderToStaticMarkup(<SoundCaseShell />);

    expect(markup).toContain('aria-label="Voltar ao Chat"');
    expect(markup).toContain('href="/"');
  });

  it("renders the page variant of the workspace", () => {
    const markup = renderToStaticMarkup(<SoundCaseShell />);

    expect(markup).toContain('data-variant="page"');
  });
});
