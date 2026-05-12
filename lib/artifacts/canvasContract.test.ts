import { describe, expect, it } from "vitest";
import {
  CANVAS_CONTENT_MODE,
  getCanvasInteractionLabel,
  getCanvasPersistenceHint,
  isCanvasContentEditable,
} from "@/lib/artifacts/canvasContract";
import type { MessageArtifact } from "@/types";

describe("canvasContract", () => {
  it("keeps content editing disabled for document artifacts", () => {
    const artifact: MessageArtifact = {
      id: "doc-1",
      kind: "document",
      title: "Documento",
      summary: "Resumo",
      content: "# Documento",
      type: "markdown",
    };

    expect(CANVAS_CONTENT_MODE).toBe("viewer-only");
    expect(isCanvasContentEditable(artifact)).toBe(false);
    expect(getCanvasInteractionLabel(artifact)).toBe("Somente leitura");
    expect(getCanvasPersistenceHint(artifact)).toContain("imutavel");
  });

  it("marks quiz artifacts as interactive without enabling content editing", () => {
    const artifact: MessageArtifact = {
      id: "quiz-1",
      kind: "quiz",
      title: "Quiz",
      summary: "Resumo quiz",
      quiz: {
        id: "quiz-1",
        title: "Quiz",
        topic: "Topico",
        instructions: "Instrucoes",
        questions: [
          {
            id: "q1",
            prompt: "Pergunta",
            options: [
              { id: "a", label: "A" },
              { id: "b", label: "B" },
            ],
            correctOptionId: "a",
            explanation: "Explicacao",
          },
        ],
        session: {
          answersByQuestionId: {},
          status: "draft",
        },
      },
    };

    expect(isCanvasContentEditable(artifact)).toBe(false);
    expect(getCanvasInteractionLabel(artifact)).toContain("Interativo");
    expect(getCanvasPersistenceHint(artifact)).toContain("quiz");
  });
});
