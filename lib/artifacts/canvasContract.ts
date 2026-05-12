import type { MessageArtifact } from "@/types";

export const CANVAS_CONTRACT_VERSION = "2026-05-viewer-only";
export const CANVAS_CONTENT_MODE = "viewer-only" as const;

export function isCanvasContentEditable(artifact: MessageArtifact): false {
  void artifact;
  return false;
}

export function getCanvasInteractionLabel(artifact: MessageArtifact): string {
  if (artifact.kind === "quiz") {
    return "Interativo (sem edicao de conteudo)";
  }

  return "Somente leitura";
}

export function getCanvasPersistenceHint(artifact: MessageArtifact): string {
  if (artifact.kind === "quiz") {
    return "As respostas do quiz sao salvas na conversa ativa.";
  }

  return "O conteudo do documento permanece imutavel no Canvas.";
}
