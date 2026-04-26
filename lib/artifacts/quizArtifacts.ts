import { QuizArtifactPayload, QuizMessageArtifact, QuizQuestion, QuizSession } from "@/types";

export const QUIZ_MIN_QUESTION_COUNT = 20;
export const QUIZ_FORCED_MODEL = "gpt-5.5";
export const QUIZ_FORCED_REASONING_EFFORT = "high";

type RawQuizOption = {
  id?: unknown;
  label?: unknown;
};

type RawQuizQuestion = {
  id?: unknown;
  prompt?: unknown;
  options?: unknown;
  correctOptionId?: unknown;
  explanation?: unknown;
};

type RawQuizPayload = {
  title?: unknown;
  topic?: unknown;
  instructions?: unknown;
  questions?: unknown;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function sanitizeText(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function buildQuestionId(index: number): string {
  return `question_${index + 1}`;
}

function buildOptionId(questionIndex: number, optionIndex: number): string {
  return `q${questionIndex + 1}_option_${optionIndex + 1}`;
}

function normalizeQuestion(raw: RawQuizQuestion, index: number): QuizQuestion | null {
  if (!isNonEmptyString(raw.prompt)) return null;
  if (!Array.isArray(raw.options) || raw.options.length < 2) return null;

  const options = raw.options
    .map((option, optionIndex) => {
      const rawOption = option as RawQuizOption;
      if (!isNonEmptyString(rawOption.label)) return null;

      return {
        id: isNonEmptyString(rawOption.id)
          ? sanitizeText(rawOption.id)
          : buildOptionId(index, optionIndex),
        label: sanitizeText(rawOption.label),
      };
    })
    .filter((option): option is QuizQuestion["options"][number] => option !== null);

  if (options.length < 2) return null;

  const rawCorrectOptionId = isNonEmptyString(raw.correctOptionId)
    ? sanitizeText(raw.correctOptionId)
    : "";
  const fallbackCorrectOptionId = options[0].id;
  const correctOptionId = options.some((option) => option.id === rawCorrectOptionId)
    ? rawCorrectOptionId
    : fallbackCorrectOptionId;

  return {
    id: isNonEmptyString(raw.id) ? sanitizeText(raw.id) : buildQuestionId(index),
    prompt: sanitizeText(raw.prompt),
    options,
    correctOptionId,
    explanation: isNonEmptyString(raw.explanation)
      ? sanitizeText(raw.explanation)
      : "Sem explicacao adicional fornecida para esta questao.",
  };
}

export const quizResponseSchema = {
  type: "json_schema" as const,
  name: "quiz_artifact",
  strict: true,
  description:
    "Quiz de multipla escolha com titulo, instrucoes e questoes prontas para renderizacao interativa.",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "topic", "instructions", "questions"],
    properties: {
      title: { type: "string" },
      topic: { type: "string" },
      instructions: { type: "string" },
      questions: {
        type: "array",
        minItems: QUIZ_MIN_QUESTION_COUNT,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "prompt", "options", "correctOptionId", "explanation"],
          properties: {
            id: { type: "string" },
            prompt: { type: "string" },
            correctOptionId: { type: "string" },
            explanation: { type: "string" },
            options: {
              type: "array",
              minItems: 2,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "label"],
                properties: {
                  id: { type: "string" },
                  label: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  },
};

export function parseQuizPayload(rawContent: string): QuizArtifactPayload | null {
  let parsed: RawQuizPayload;

  try {
    parsed = JSON.parse(rawContent) as RawQuizPayload;
  } catch {
    return null;
  }

  if (!isNonEmptyString(parsed.title) || !isNonEmptyString(parsed.topic)) {
    return null;
  }

  if (!isNonEmptyString(parsed.instructions) || !Array.isArray(parsed.questions)) {
    return null;
  }

  const questions = parsed.questions
    .map((question, index) => normalizeQuestion(question as RawQuizQuestion, index))
    .filter((question): question is QuizQuestion => question !== null);

  if (questions.length < QUIZ_MIN_QUESTION_COUNT) return null;

  return {
    id: crypto.randomUUID(),
    title: sanitizeText(parsed.title),
    topic: sanitizeText(parsed.topic),
    instructions: sanitizeText(parsed.instructions),
    questions,
    session: {
      answersByQuestionId: {},
      status: "draft",
    },
  };
}

export function createQuizArtifact(rawContent: string): QuizMessageArtifact | undefined {
  const quiz = parseQuizPayload(rawContent);
  if (!quiz) return undefined;

  const artifactId = crypto.randomUUID();

  return {
    id: artifactId,
    kind: "quiz",
    title: quiz.title,
    summary: `${quiz.questions.length} questoes sobre ${quiz.topic}. Responda no painel e envie para receber a nota.`,
    displayMode: "quiz",
    quiz: {
      ...quiz,
      id: artifactId,
    },
  };
}

export function gradeQuizSession(
  quiz: QuizArtifactPayload,
  answersByQuestionId: Record<string, string>
): QuizSession {
  const totalQuestions = quiz.questions.length;
  const correctAnswers = quiz.questions.filter(
    (question) => answersByQuestionId[question.id] === question.correctOptionId
  ).length;
  const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

  return {
    answersByQuestionId,
    status: "submitted",
    score,
    submittedAt: new Date().toISOString(),
  };
}

export function getQuizCorrectAnswerCount(
  quiz: QuizArtifactPayload,
  answersByQuestionId: Record<string, string>
): number {
  return quiz.questions.filter(
    (question) => answersByQuestionId[question.id] === question.correctOptionId
  ).length;
}

export function getQuizSourceContent(quiz: QuizArtifactPayload): string {
  return JSON.stringify(
    {
      title: quiz.title,
      topic: quiz.topic,
      instructions: quiz.instructions,
      questions: quiz.questions,
      session: quiz.session,
    },
    null,
    2
  );
}
