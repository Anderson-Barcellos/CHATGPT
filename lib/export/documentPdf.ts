import type { DocumentMessageArtifact } from "@/types";
import { apiUrl } from "@/lib/utils";

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .toLowerCase()
    .slice(0, 100);
}

async function readErrorMessage(response: Response): Promise<string> {
  const fallback = "Nao consegui gerar o PDF deste documento.";

  try {
    const data = (await response.json()) as { message?: unknown; error?: unknown };
    if (typeof data.message === "string" && data.message.trim()) {
      return data.message;
    }
    if (typeof data.error === "string" && data.error.trim()) {
      return data.error;
    }
  } catch {
    // Keep the download surface quiet; the toast caller shows this message.
  }

  return fallback;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function downloadDocumentArtifactPdf(
  artifact: DocumentMessageArtifact,
  _sourceElement: HTMLElement | null
): Promise<void> {
  void _sourceElement;

  const response = await fetch(apiUrl("/api/artifacts/pdf"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ artifact }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const blob = await response.blob();
  downloadBlob(blob, `${sanitizeFilename(artifact.title || "documento")}.pdf`);
}
