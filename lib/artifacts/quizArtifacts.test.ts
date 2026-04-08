import { describe, expect, it } from "vitest";
import {
  createQuizArtifact,
  gradeQuizSession,
  parseQuizPayload,
  QUIZ_MIN_QUESTION_COUNT,
} from "@/lib/artifacts/quizArtifacts";

function buildRawQuiz(questionCount = QUIZ_MIN_QUESTION_COUNT) {
  return JSON.stringify({
    title: "Quiz de Cardiologia",
    topic: "Cardiologia",
    instructions: "Escolha a alternativa correta em cada questao.",
    questions: Array.from({ length: questionCount }, (_, index) => ({
      id: `q${index + 1}`,
      prompt: `Questao ${index + 1}: Qual camara bombeia sangue para a circulacao sistemica?`,
      correctOptionId: "b",
      explanation: "O ventriculo esquerdo ejeta sangue para a aorta.",
      options: [
        { id: "a", label: "Atrio direito" },
        { id: "b", label: "Ventriculo esquerdo" },
        { id: "c", label: "Atrio esquerdo" },
        { id: "d", label: "Ventriculo direito" },
      ],
    })),
  });
}

describe("quizArtifacts", () => {
  it("parses structured quiz payloads into persisted quiz state", () => {
    const rawQuiz = buildRawQuiz();
    const parsed = parseQuizPayload(rawQuiz);

    expect(parsed).not.toBeNull();
    expect(parsed?.title).toBe("Quiz de Cardiologia");
    expect(parsed?.questions).toHaveLength(QUIZ_MIN_QUESTION_COUNT);
    expect(parsed?.session.status).toBe("draft");
    expect(parsed?.session.answersByQuestionId).toEqual({});
  });

  it("creates a quiz artifact with summary and quiz display mode", () => {
    const rawQuiz = buildRawQuiz();
    const artifact = createQuizArtifact(rawQuiz);

    expect(artifact?.kind).toBe("quiz");
    expect(artifact?.displayMode).toBe("quiz");
    expect(artifact?.summary).toContain(`${QUIZ_MIN_QUESTION_COUNT} questoes`);
  });

  it("grades the selected answers with a final score", () => {
    const rawQuiz = buildRawQuiz();
    const artifact = createQuizArtifact(rawQuiz);
    if (!artifact) {
      throw new Error("quiz artifact nao criado");
    }

    const session = gradeQuizSession(artifact.quiz, {
      ...Object.fromEntries(
        artifact.quiz.questions.map((question) => [question.id, question.correctOptionId])
      ),
    });

    expect(session.status).toBe("submitted");
    expect(session.score).toBe(100);
    expect(session.submittedAt).toBeTruthy();
  });

  it("rejects quiz payloads with fewer than the minimum required questions", () => {
    const rawQuiz = buildRawQuiz(QUIZ_MIN_QUESTION_COUNT - 1);

    expect(parseQuizPayload(rawQuiz)).toBeNull();
    expect(createQuizArtifact(rawQuiz)).toBeUndefined();
  });
});
