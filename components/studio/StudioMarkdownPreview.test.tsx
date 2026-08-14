import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StudioMarkdownPreview } from "@/components/studio/StudioMarkdownPreview";

describe("StudioMarkdownPreview", () => {
  it("renders headings, GFM tables and code fences from the raw file", () => {
    const markup = renderToStaticMarkup(
      <StudioMarkdownPreview
        content={
          "# Título\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\n```python\nprint('oi')\n```\n"
        }
      />
    );

    expect(markup).toContain("<h1");
    expect(markup).toContain("Título");
    expect(markup).toContain("<table");
    expect(markup).toContain("<code");
    expect(markup).toContain("print");
    expect(markup).toContain("oi");
  });

  it("keeps single newlines as soft wraps instead of hard breaks", () => {
    const markup = renderToStaticMarkup(
      <StudioMarkdownPreview content={"linha um\nlinha dois\n"} />
    );

    expect(markup).not.toContain("<br");
    expect(markup).toContain("linha um");
    expect(markup).toContain("linha dois");
  });

  it("does not apply chat normalization heuristics to file content", () => {
    // No chat, "texto. **Frase**" viraria heading destacado em bloco próprio;
    // num arquivo real isso deve permanecer no mesmo parágrafo.
    const markup = renderToStaticMarkup(
      <StudioMarkdownPreview content={"fim da frase. **Nota importante** segue\n"} />
    );

    const paragraphs = markup.match(/<p[\s>]/g) ?? [];
    expect(paragraphs).toHaveLength(1);
    expect(markup).toMatch(/<strong[^>]*>Nota importante<\/strong>/);
  });
});
