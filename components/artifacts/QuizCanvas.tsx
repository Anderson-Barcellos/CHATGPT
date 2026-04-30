"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, CircleAlert, CircleDashed, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { gradeQuizSession, getQuizCorrectAnswerCount } from "@/lib/artifacts/quizArtifacts";
import { QuizMessageArtifact, QuizSession } from "@/types";
import { DocumentCanvas } from "@/components/artifacts/DocumentCanvas";

interface QuizCanvasProps {
  artifact: QuizMessageArtifact;
  compact?: boolean;
  className?: string;
  onSessionChange?: (session: QuizSession) => void | Promise<void>;
}

export function QuizCanvas({
  artifact,
  compact = false,
  className,
  onSessionChange,
}: QuizCanvasProps) {
  const [answersByQuestionId, setAnswersByQuestionId] = useState(
    artifact.quiz.session.answersByQuestionId
  );
  const [session, setSession] = useState(artifact.quiz.session);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setAnswersByQuestionId(artifact.quiz.session.answersByQuestionId);
    setSession(artifact.quiz.session);
  }, [artifact.quiz.session]);

  const answeredCount = useMemo(
    () =>
      artifact.quiz.questions.filter((question) => answersByQuestionId[question.id]).length,
    [answersByQuestionId, artifact.quiz.questions]
  );
  const unansweredCount = artifact.quiz.questions.length - answeredCount;
  const isSubmitted = session.status === "submitted";
  const correctAnswerCount = isSubmitted
    ? getQuizCorrectAnswerCount(artifact.quiz, session.answersByQuestionId)
    : 0;

  const handleSelect = (questionId: string, optionId: string) => {
    if (isSubmitted) return;

    setAnswersByQuestionId((current) => ({
      ...current,
      [questionId]: optionId,
    }));
  };

  const handleSubmit = async () => {
    if (isSubmitted || unansweredCount > 0) return;

    const nextSession = gradeQuizSession(artifact.quiz, answersByQuestionId);
    setSession(nextSession);
    setIsSaving(true);

    try {
      await onSessionChange?.(nextSession);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DocumentCanvas
      title={artifact.quiz.title}
      eyebrow={isSubmitted ? "Quiz corrigido" : "Quiz interativo"}
      description={artifact.quiz.instructions}
      compact={compact}
      className={cn("border-black/5 bg-transparent dark:border-white/8 dark:bg-transparent", className)}
      bodyClassName={cn("space-y-5", compact ? "md:py-6" : "md:py-8")}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full border border-white/10 bg-background/60 px-3 py-1">
          Tema: {artifact.quiz.topic}
        </span>
        <span className="rounded-full border border-white/10 bg-background/60 px-3 py-1">
          {artifact.quiz.questions.length} questoes
        </span>
        <span className="rounded-full border border-white/10 bg-background/60 px-3 py-1">
          {answeredCount} respondidas
        </span>
      </div>

      {isSubmitted && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 p-4">
          <div className="flex items-center gap-2 text-emerald-300">
            <Trophy className="h-4 w-4" />
            <span className="text-sm font-semibold">
              Nota final: {session.score ?? 0}% ({correctAnswerCount}/{artifact.quiz.questions.length})
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-foreground/80">
            O quiz foi enviado e corrigido. As explicacoes abaixo mostram o gabarito de cada questao.
          </p>
        </div>
      )}

      {!isSubmitted && (
        <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/8 p-4">
          <div className="flex items-center gap-2 text-cyan-100">
            <CircleDashed className="h-4 w-4" />
            <span className="text-sm font-semibold">
              Responde tudo primeiro e depois envia para corrigir.
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-foreground/80">
            {unansweredCount > 0
              ? `Faltam ${unansweredCount} questoes para liberar a correcao.`
              : "Tudo pronto. Quando quiser, envia as respostas para ver a nota."}
          </p>
        </div>
      )}

      <div className="space-y-4">
        {artifact.quiz.questions.map((question, questionIndex) => {
          const selectedOptionId = (isSubmitted
            ? session.answersByQuestionId
            : answersByQuestionId)[question.id];

          return (
            <section
              key={question.id}
              className="rounded-[24px] border border-white/10 bg-background/55 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-micro font-semibold uppercase tracking-eyebrow text-muted-foreground/70">
                    Questao {questionIndex + 1}
                  </div>
                  <h3 className="mt-2 text-sm font-semibold leading-6 text-foreground">
                    {question.prompt}
                  </h3>
                </div>
                {isSubmitted && (
                  selectedOptionId === question.correctOptionId ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2.5 py-1 text-micro font-medium text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Correta
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/12 px-2.5 py-1 text-micro font-medium text-rose-300">
                      <CircleAlert className="h-3.5 w-3.5" />
                      Incorreta
                    </span>
                  )
                )}
              </div>

              <div className="mt-4 space-y-2">
                {question.options.map((option) => {
                  const isSelected = selectedOptionId === option.id;
                  const isCorrect = option.id === question.correctOptionId;
                  const showSubmittedState = isSubmitted && (isCorrect || isSelected);

                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={isSubmitted}
                      onClick={() => handleSelect(question.id, option.id)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                        "disabled:cursor-default",
                        isSelected && !isSubmitted
                          ? "border-cyan-400/35 bg-cyan-500/10"
                          : "border-white/10 bg-background/60 hover:border-white/20 hover:bg-background/80",
                        showSubmittedState &&
                          (isCorrect
                            ? "border-emerald-500/25 bg-emerald-500/10"
                            : "border-rose-500/20 bg-rose-500/8")
                      )}
                    >
                      <span className="mt-0.5 text-muted-foreground/80">
                        {isSelected ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Circle className="h-4 w-4" />
                        )}
                      </span>
                      <span className="flex-1 text-sm leading-6 text-foreground/90">
                        {option.label}
                      </span>
                      {isSubmitted && isCorrect && (
                        <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-nano font-semibold uppercase tracking-wide text-emerald-300">
                          Gabarito
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {isSubmitted && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-background/70 p-4">
                  <div className="text-micro font-semibold uppercase tracking-eyebrow text-muted-foreground/70">
                    Explicacao
                  </div>
                  <p className="mt-2 text-sm leading-6 text-foreground/80">{question.explanation}</p>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {!isSubmitted && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-background/55 p-4">
          <p className="text-sm leading-6 text-foreground/80">
            {unansweredCount > 0
              ? `Ainda faltam ${unansweredCount} questoes para completar o quiz.`
              : "Tudo respondido. Pode enviar para calcular a nota."}
          </p>
          <Button
            size="sm"
            className="rounded-full px-4"
            disabled={unansweredCount > 0 || isSaving}
            onClick={handleSubmit}
          >
            {isSaving ? "Salvando..." : "Enviar respostas"}
          </Button>
        </div>
      )}
    </DocumentCanvas>
  );
}
