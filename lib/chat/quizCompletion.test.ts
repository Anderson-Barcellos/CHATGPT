import { describe, expect, it } from "vitest";
import { buildQuizCompletionPatch } from "@/lib/chat/quizCompletion";

function buildQuizJson(questionCount = 20) {
  return JSON.stringify({
    title: "Quiz de anatomia",
    topic: "anatomia",
    instructions: "Escolha a alternativa correta.",
    questions: Array.from({ length: questionCount }, (_, index) => ({
      id: `q${index + 1}`,
      prompt: `Pergunta ${index + 1}?`,
      correctOptionId: `q${index + 1}_a`,
      explanation: "Porque esta e a melhor resposta.",
      options: [
        { id: `q${index + 1}_a`, label: "Alternativa A" },
        { id: `q${index + 1}_b`, label: "Alternativa B" },
      ],
    })),
  });
}

describe("buildQuizCompletionPatch", () => {
  it("marks valid quiz responses as completed and stores the artifact", () => {
    const patch = buildQuizCompletionPatch(buildQuizJson());

    expect(patch.streamStatus).toBe("completed");
    expect(patch.preferredDisplayMode).toBe("quiz");
    expect(patch.artifact?.kind).toBe("quiz");
    expect(patch.content).toContain("20 questoes");
  });

  it("marks invalid quiz responses as failed while preserving raw content", () => {
    const patch = buildQuizCompletionPatch("resposta sem json valido");

    expect(patch.streamStatus).toBe("failed");
    expect(patch.preferredDisplayMode).toBeUndefined();
    expect(patch.artifact).toBeUndefined();
    expect(patch.content).toBe("resposta sem json valido");
  });
});
