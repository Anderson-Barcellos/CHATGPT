import { describe, expect, it } from "vitest";
import { buildDocumentArtifactPdfHtml } from "./documentArtifactPdf";
import type { DocumentMessageArtifact } from "@/types";

describe("buildDocumentArtifactPdfHtml", () => {
  it("renders a branded A4 document shell with print-friendly source styling", () => {
    const artifact: DocumentMessageArtifact = {
      id: "doc-visual",
      kind: "document",
      title: "Pesquisa Profunda",
      summary: "Resumo elegante do documento.",
      type: "markdown",
      content: "# Achados\n\n[OpenAI](https://openai.com)\n\n| Item | Valor |\n| --- | --- |\n| A | B |",
      displayMode: "document",
    };

    const html = buildDocumentArtifactPdfHtml(artifact);

    expect(html).toContain("Gaucho Chat");
    expect(html).toContain("document-brand-mark");
    expect(html).toContain("document-meta-grid");
    expect(html).toContain("Documento A4 exportável");
    expect(html).toContain('a[href^="http"]::after');
    expect(html).toContain("tbody tr:nth-child(even)");
    expect(html).toContain("Pesquisa Profunda");
  });

  it("strips active html before placing html artifacts into the PDF shell", () => {
    const artifact: DocumentMessageArtifact = {
      id: "doc-html",
      kind: "document",
      title: "HTML Seguro",
      summary: "Resumo.",
      type: "html",
      content: `<body><h1 onclick="alert(1)">Oi</h1><a href="javascript:alert(1)">link</a><script>alert(1)</script><iframe src="https://example.com"></iframe></body>`,
      displayMode: "document",
    };

    const html = buildDocumentArtifactPdfHtml(artifact);

    expect(html).toContain("<h1>Oi</h1>");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<iframe");
  });
});
