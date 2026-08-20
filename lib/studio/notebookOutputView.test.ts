import { describe, expect, it } from "vitest";
import {
  latexToMarkdown,
  selectNotebookOutputView,
} from "@/lib/studio/notebookOutputView";

describe("selectNotebookOutputView", () => {
  it("prefere image/png sobre qualquer mime textual", () => {
    const view = selectNotebookOutputView({
      "text/html": "<table></table>",
      "text/plain": "<Figure>",
      "image/png": "iVBOR\nw0KGgo=",
    });
    expect(view).toEqual({
      kind: "image",
      mime: "image/png",
      src: "data:image/png;base64,iVBORw0KGgo=",
    });
  });

  it("usa image/jpeg quando não há png", () => {
    const view = selectNotebookOutputView({
      "image/jpeg": "/9j/4AAQ",
      "text/plain": "foto",
    });
    expect(view).toEqual({
      kind: "image",
      mime: "image/jpeg",
      src: "data:image/jpeg;base64,/9j/4AAQ",
    });
  });

  it("renderiza svg como data URI codificada (sem execução de script)", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
    const view = selectNotebookOutputView({ "image/svg+xml": svg });
    expect(view).toEqual({
      kind: "image",
      mime: "image/svg+xml",
      src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    });
  });

  it("prefere text/html sobre latex, markdown e plain", () => {
    const view = selectNotebookOutputView({
      "text/plain": "df",
      "text/markdown": "# df",
      "text/latex": "$x$",
      "text/html": "<table><tr><td>1</td></tr></table>",
    });
    expect(view).toEqual({
      kind: "html",
      html: "<table><tr><td>1</td></tr></table>",
    });
  });

  it("prefere text/latex sobre markdown e plain", () => {
    const view = selectNotebookOutputView({
      "text/plain": "x**2",
      "text/markdown": "x2",
      "text/latex": "$\\displaystyle x^{2}$",
    });
    expect(view).toEqual({ kind: "latex", source: "$\\displaystyle x^{2}$" });
  });

  it("prefere text/markdown sobre plain", () => {
    const view = selectNotebookOutputView({
      "text/plain": "titulo",
      "text/markdown": "# titulo",
    });
    expect(view).toEqual({ kind: "markdown", source: "# titulo" });
  });

  it("cai em text/plain quando é o único mime", () => {
    expect(selectNotebookOutputView({ "text/plain": "42" })).toEqual({
      kind: "text",
      text: "42",
    });
  });

  it("retorna null para bundle vazio ou só com mimes desconhecidos", () => {
    expect(selectNotebookOutputView({})).toBeNull();
    expect(
      selectNotebookOutputView({ "application/javascript": "alert(1)" })
    ).toBeNull();
  });
});

describe("latexToMarkdown", () => {
  it("mantém latex que já vem delimitado por $ (sympy)", () => {
    expect(latexToMarkdown("$\\displaystyle x^{2}$")).toBe(
      "$\\displaystyle x^{2}$"
    );
  });

  it("embrulha latex cru em bloco de math", () => {
    expect(latexToMarkdown("\\frac{a}{b}")).toBe("$$\n\\frac{a}{b}\n$$");
  });
});
