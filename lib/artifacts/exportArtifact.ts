import type { MessageArtifact } from "@/types";

interface ArtifactExportMeta {
  content: string;
  extension: "html" | "md" | "json";
  mimeType: "text/html" | "text/markdown" | "application/json";
  fileName: string;
}

function buildArtifactExportMeta(artifact: MessageArtifact): ArtifactExportMeta {
  if (artifact.kind === "document") {
    const extension = artifact.type === "html" ? "html" : "md";
    const mimeType = artifact.type === "html" ? "text/html" : "text/markdown";
    return {
      content: artifact.content,
      extension,
      mimeType,
      fileName: `${artifact.title || "artefato"}.${extension}`,
    };
  }

  return {
    content: JSON.stringify(artifact.quiz, null, 2),
    extension: "json",
    mimeType: "application/json",
    fileName: `${artifact.title || "artefato"}.json`,
  };
}

export async function copyArtifactToClipboard(artifact: MessageArtifact): Promise<void> {
  const { content } = buildArtifactExportMeta(artifact);
  await navigator.clipboard.writeText(content);
}

export function downloadArtifact(artifact: MessageArtifact): void {
  const { content, mimeType, fileName } = buildArtifactExportMeta(artifact);
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
