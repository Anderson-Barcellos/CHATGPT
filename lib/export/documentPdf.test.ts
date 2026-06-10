import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadDocumentArtifactPdf } from "./documentPdf";
import type { DocumentMessageArtifact } from "@/types";

const originalFetch = globalThis.fetch;
const originalDocument = globalThis.document;
const originalUrl = globalThis.URL;

describe("downloadDocumentArtifactPdf", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    globalThis.document = originalDocument;
    globalThis.URL = originalUrl;
  });

  it("requests a server-rendered A4 PDF instead of rasterizing the preview DOM", async () => {
    const artifact: DocumentMessageArtifact = {
      id: "doc-1",
      kind: "document",
      title: "Laudo A4 Teste",
      summary: "Resumo do documento",
      type: "markdown",
      content: "# Titulo\n\nConteudo clinico em formato A4.",
      displayMode: "document",
    };
    const click = vi.fn();
    const anchor = {
      href: "",
      download: "",
      click,
      remove: vi.fn(),
    };
    const appendChild = vi.fn();
    const blob = new Blob(["%PDF-1.7"], { type: "application/pdf" });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(blob),
    });
    const createObjectURL = vi.fn().mockReturnValue("blob:document-pdf");
    const revokeObjectURL = vi.fn();

    globalThis.fetch = fetchMock as unknown as typeof fetch;
    globalThis.document = {
      createElement: vi.fn().mockReturnValue(anchor),
      body: { appendChild },
    } as unknown as Document;
    globalThis.URL = {
      ...originalUrl,
      createObjectURL,
      revokeObjectURL,
    } as unknown as typeof URL;

    await downloadDocumentArtifactPdf(artifact, null);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/artifacts/pdf",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artifact }),
      })
    );
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(anchor.href).toBe("blob:document-pdf");
    expect(anchor.download).toBe("laudo_a4_teste.pdf");
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:document-pdf");
  });
});
