import { NextRequest, NextResponse } from "next/server";
import type { DocumentMessageArtifact } from "@/types";
import { jsonError } from "@/lib/api/errors";
import { renderDocumentArtifactPdf } from "@/lib/server/documentArtifactPdf";
import { isAuthEnabled, isAuthenticatedRequest } from "@/lib/server/auth";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOCUMENT_PDF_BODY_LIMIT_BYTES = 5 * 1024 * 1024;

type DocumentPdfRequestBody = {
  artifact?: Partial<DocumentMessageArtifact>;
};

function unauthorized() {
  return jsonError(401, "Unauthorized", {
    message: "Faça login para exportar o PDF.",
    code: "unauthorized",
  });
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .toLowerCase()
    .slice(0, 100);
}

function validateDocumentArtifact(
  value: DocumentPdfRequestBody["artifact"]
): DocumentMessageArtifact | undefined {
  if (!value || value.kind !== "document") return undefined;
  if (typeof value.id !== "string") return undefined;
  if (typeof value.title !== "string") return undefined;
  if (typeof value.summary !== "string") return undefined;
  if (typeof value.content !== "string") return undefined;
  if (!["markdown", "html", "mixed"].includes(String(value.type))) return undefined;

  return {
    id: value.id,
    kind: "document",
    title: value.title,
    summary: value.summary,
    content: value.content,
    type: value.type as DocumentMessageArtifact["type"],
    displayMode: value.displayMode,
  };
}

export async function POST(request: NextRequest) {
  if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
    return unauthorized();
  }

  const body = await readJsonWithLimit<DocumentPdfRequestBody>(request, {
    limitBytes: DOCUMENT_PDF_BODY_LIMIT_BYTES,
  });

  if (!body.ok) {
    return jsonError(body.status, "Invalid PDF export request", {
      message:
        body.reason === "too_large"
          ? "Documento grande demais para exportar em PDF."
          : "Pedido de PDF invalido.",
      code: body.reason,
    });
  }

  const artifact = validateDocumentArtifact(body.value.artifact);
  if (!artifact) {
    return jsonError(400, "Invalid document artifact", {
      message: "Artefato de documento invalido para exportacao em PDF.",
      code: "invalid_document_artifact",
    });
  }

  try {
    const pdf = await renderDocumentArtifactPdf(artifact);
    const filename = `${sanitizeFilename(artifact.title || "documento")}.pdf`;

    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[document-pdf] render error", error);
    return jsonError(500, "Failed to render document PDF", {
      message: "Nao consegui renderizar o PDF deste documento.",
      code: "document_pdf_render_failed",
    });
  }
}
