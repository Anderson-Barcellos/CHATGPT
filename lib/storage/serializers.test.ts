import { describe, expect, it } from "vitest";
import { deserializeConversation, serializeConversation } from "@/lib/storage/serializers";
import { Conversation } from "@/types";

describe("conversation serializers", () => {
  it("round-trips dates for conversations and messages", () => {
    const source: Conversation = {
      id: "conv-1",
      title: "Teste",
      createdAt: new Date("2026-04-01T12:00:00.000Z"),
      updatedAt: new Date("2026-04-01T12:30:00.000Z"),
      messages: [
        {
          id: "msg-1",
          role: "user",
          content: "Oi",
          timestamp: new Date("2026-04-01T12:05:00.000Z"),
        },
      ],
    };

    const serialized = serializeConversation(source);
    const restored = deserializeConversation(serialized);

    expect(serialized.createdAt).toBe("2026-04-01T12:00:00.000Z");
    expect(serialized.messages[0]?.timestamp).toBe("2026-04-01T12:05:00.000Z");
    expect(restored.createdAt).toBeInstanceOf(Date);
    expect(restored.updatedAt).toBeInstanceOf(Date);
    expect(restored.messages[0]?.timestamp).toBeInstanceOf(Date);
    expect(restored.messages[0]?.content).toBe("Oi");
  });

  it("preserves quiz artifacts and submitted sessions", () => {
    const source: Conversation = {
      id: "conv-quiz",
      title: "Quiz",
      createdAt: new Date("2026-04-02T10:00:00.000Z"),
      updatedAt: new Date("2026-04-02T10:15:00.000Z"),
      messages: [
        {
          id: "msg-quiz",
          role: "assistant",
          content: "Quiz interativo pronto.",
          timestamp: new Date("2026-04-02T10:05:00.000Z"),
          artifact: {
            id: "artifact-quiz",
            kind: "quiz",
            title: "Quiz de Anatomia",
            summary: "5 questoes sobre anatomia.",
            displayMode: "quiz",
            quiz: {
              id: "artifact-quiz",
              title: "Quiz de Anatomia",
              topic: "Anatomia",
              instructions: "Escolha a melhor alternativa.",
              questions: [
                {
                  id: "q1",
                  prompt: "Qual osso fica no braco?",
                  correctOptionId: "a",
                  explanation: "O umero compoe o braco.",
                  options: [
                    { id: "a", label: "Umero" },
                    { id: "b", label: "Femur" },
                  ],
                },
              ],
              session: {
                answersByQuestionId: { q1: "a" },
                status: "submitted",
                score: 100,
                submittedAt: "2026-04-02T10:06:00.000Z",
              },
            },
          },
        },
      ],
    };

    const serialized = serializeConversation(source);
    const restored = deserializeConversation(serialized);
    const quizArtifact = restored.messages[0]?.artifact;

    expect(quizArtifact?.kind).toBe("quiz");
    if (!quizArtifact || quizArtifact.kind !== "quiz") {
      throw new Error("quiz artifact nao restaurado");
    }

    expect(quizArtifact.quiz.session.status).toBe("submitted");
    expect(quizArtifact.quiz.session.score).toBe(100);
    expect(quizArtifact.quiz.session.answersByQuestionId.q1).toBe("a");
  });
});
