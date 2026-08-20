// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { sanitizeNotebookHtml } from "@/lib/studio/sanitizeNotebookHtml";

describe("sanitizeNotebookHtml", () => {
  it("preserva a tabela do pandas com classes e estrutura", () => {
    const html =
      '<div><table border="1" class="dataframe"><thead><tr><th>a</th></tr></thead>' +
      "<tbody><tr><td>1</td></tr></tbody></table></div>";
    const clean = sanitizeNotebookHtml(html);
    expect(clean).toContain('<table border="1" class="dataframe">');
    expect(clean).toContain("<td>1</td>");
  });

  it("remove script e handlers inline", () => {
    const clean = sanitizeNotebookHtml(
      '<img src="x" onerror="alert(1)"><script>alert(2)</script><b>ok</b>'
    );
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("onerror");
    expect(clean).toContain("<b>ok</b>");
  });

  it("remove blocos style para não vazar CSS pro documento", () => {
    const clean = sanitizeNotebookHtml(
      "<style>body{display:none}</style><p>texto</p>"
    );
    expect(clean).not.toContain("style");
    expect(clean).toContain("<p>texto</p>");
  });

  it("remove href javascript:", () => {
    const clean = sanitizeNotebookHtml('<a href="javascript:alert(1)">x</a>');
    expect(clean).not.toContain("javascript:");
  });
});
