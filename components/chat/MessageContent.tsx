"use client";

import { useState } from "react";
import { Message, QuizMessageArtifact } from "@/types";
import "katex/dist/katex.min.css";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Image as ImageIcon,
  LoaderCircle,
  Maximize2,
  Minimize2,
  PanelRightOpen,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/uiStore";
import { DocumentCanvas } from "@/components/artifacts/DocumentCanvas";
import { QuizCanvas } from "@/components/artifacts/QuizCanvas";
import { ChatMarkdown } from "./ChatMarkdown";
import { StreamingMarkdown } from "./StreamingMarkdown";
import { MessageArtifactCard } from "./MessageArtifactCard";
import {
  cleanCitationMarkers,
  detectRichContent,
} from "@/lib/artifacts/messageArtifacts";
import { useArtifactSessionPersistence } from "@/hooks/useArtifactSessionPersistence";

interface MessageContentProps {
  message: Message;
  className?: string;
}

interface InlineArtifactViewState {
  artifactId: string | null;
  show: boolean;
  expanded: boolean;
}

function getStreamStatusNotice(streamStatus: Message["streamStatus"]) {
  if (streamStatus === "interrupted") {
    return {
      className:
        "mt-2 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/[0.08] px-3 py-1.5 text-xs text-amber-300/90",
      message: "Resposta interrompida — pode regenerar pra completar.",
    };
  }

  if (streamStatus === "aborted") {
    return {
      className:
        "mt-2 flex items-center gap-2 rounded-md border border-amber-400/25 bg-amber-400/[0.07] px-3 py-1.5 text-xs text-amber-200/85",
      message: "Geração cancelada por ti — podes regenerar quando quiser.",
    };
  }

  if (streamStatus === "failed") {
    return {
      className:
        "mt-2 flex items-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/[0.09] px-3 py-1.5 text-xs text-rose-200/90",
      message: "Falha na geração — tenta regenerar para concluir.",
    };
  }

  return null;
}

export function MessageContent({ message, className }: MessageContentProps) {
  const { openArtifact } = useUIStore();
  const persistArtifactSession = useArtifactSessionPersistence();
  const artifact = message.artifact;
  const prefersDocumentMode = message.preferredDisplayMode === "document";
  const prefersQuizMode = message.preferredDisplayMode === "quiz";
  const isDocumentArtifact = artifact?.displayMode === "document";
  const isQuizArtifact = artifact?.kind === "quiz";
  const isQuizPresentation = isQuizArtifact || prefersQuizMode;
  const isDocumentPresentation = isDocumentArtifact || prefersDocumentMode;
  const isCanvasPresentation = isDocumentPresentation || isQuizPresentation;
  const [inlineArtifactState, setInlineArtifactState] =
    useState<InlineArtifactViewState | null>(null);
  const content = cleanCitationMarkers(message.content, message.citations);
  const richContent = detectRichContent(content);
  const artifactContent =
    artifact?.kind === "document"
      ? cleanCitationMarkers(artifact.content, message.citations)
      : content;
  const canRenderStreamingText =
    message.role === "assistant" &&
    !artifact &&
    !isCanvasPresentation &&
    !message.imageBase64;

  const currentArtifactState =
    artifact && inlineArtifactState?.artifactId === artifact.id
      ? inlineArtifactState
      : null;
  const showArtifactInline = currentArtifactState?.show ?? isCanvasPresentation;
  const expandInlineArtifact =
    currentArtifactState?.expanded ?? isCanvasPresentation;

  const setCurrentArtifactViewState = (
    updater: (current: InlineArtifactViewState) => InlineArtifactViewState
  ) => {
    const current: InlineArtifactViewState = {
      artifactId: artifact?.id ?? null,
      show: showArtifactInline,
      expanded: expandInlineArtifact,
    };
    setInlineArtifactState(updater(current));
  };

  const handleQuizSessionChange = async (
    session: QuizMessageArtifact["quiz"]["session"]
  ) => {
    if (!artifact || artifact.kind !== "quiz") return;

    await persistArtifactSession(message.id, {
      ...artifact,
      quiz: {
        ...artifact.quiz,
        session,
      },
    });
  };

  const streamStatusNotice = getStreamStatusNotice(message.streamStatus);

  const streamNotice = streamStatusNotice ? (
    <div className={streamStatusNotice.className}>
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span>{streamStatusNotice.message}</span>
    </div>
  ) : null;

  const renderMessageText = (markdownClassName?: string) =>
    canRenderStreamingText ? (
      <StreamingMarkdown
        key={message.id}
        content={artifactContent}
        className={markdownClassName}
        streamStatus={message.streamStatus}
      />
    ) : (
      <ChatMarkdown content={artifactContent} className={markdownClassName} />
    );

  const markdown = renderMessageText();

  if (message.role === "assistant" && message.isGeneratingImage && !message.imageBase64) {
    return (
      <>
        <div className={cn("space-y-2.5 md:space-y-3", className)}>
          {content && content.trim().length > 0 && markdown}

          <div className="relative overflow-hidden rounded-xl border border-primary/15 bg-linear-to-br from-background/85 via-background/90 to-primary/[0.08] p-3 shadow-[0_18px_50px_rgba(14,116,144,0.08)] md:rounded-2xl md:p-4">
            <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.08),transparent)] animate-[shimmer_2.2s_linear_infinite]" />
            <div className="relative flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <ImageIcon className="h-4.5 w-4.5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-nano font-semibold uppercase tracking-eyebrow text-primary">
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    Gerando imagem
                  </div>
                  <div className="inline-flex items-center gap-1.5 text-micro text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-primary/80" />
                    Usando o modelo de imagem mais novo
                  </div>
                </div>

                <p className="mt-2 text-body-sm leading-6 text-foreground/85 md:text-sm">
                  A imagem ainda está sendo montada. Assim que sair o primeiro preview ela aparece aqui no próprio balão.
                </p>

                <div className="mt-3 flex items-center gap-1.5">
                  {[0, 1, 2].map((index) => (
                    <span
                      key={index}
                      className="inline-block h-2 w-2 rounded-full bg-primary/60 animate-bounce"
                      style={{ animationDelay: `${index * 0.16}s`, animationDuration: "1s" }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {streamNotice}
        </div>
      </>
    );
  }

  if (artifact && message.role === "assistant" && !message.imageBase64) {
    return (
      <>
        <div className={cn("space-y-2.5 md:space-y-3", className)}>
          <MessageArtifactCard
            artifact={artifact}
            showInline={showArtifactInline}
            onOpen={() => {
              openArtifact(artifact, message.id);
            }}
            onToggleInline={() => {
              setCurrentArtifactViewState((current) => {
                const nextShow = !current.show;
                return {
                  ...current,
                  show: nextShow,
                  expanded: nextShow ? current.expanded : false,
                };
              });
            }}
          />

          {showArtifactInline && (
            <div
              className={cn(
                "relative overflow-hidden rounded-xl border p-2.5 md:rounded-2xl md:p-3",
                isCanvasPresentation
                  ? "border-primary/15 bg-linear-to-br from-background/70 via-background/80 to-primary/[0.05] shadow-[0_20px_60px_rgba(14,116,144,0.08)]"
                  : "border-border/70 bg-background/55"
              )}
            >
              <div
                className={cn(
                  "relative overflow-hidden rounded-lg border px-2.5 py-2 transition-[max-height] duration-300 md:rounded-xl md:px-3",
                  isCanvasPresentation
                    ? "border-[color:var(--gc-border-soft)] bg-background/80 md:px-6 md:py-5"
                    : "border-border/60 bg-background/75",
                  expandInlineArtifact ? "max-h-[60vh] md:max-h-[70vh]" : "max-h-48 md:max-h-56"
                )}
              >
                {isQuizArtifact ? (
                  <QuizCanvas
                    artifact={artifact as QuizMessageArtifact}
                    compact
                    onSessionChange={handleQuizSessionChange}
                  />
                ) : isDocumentArtifact ? (
                  <DocumentCanvas
                    title={artifact.title}
                    eyebrow="Documento no balao"
                    description={artifact.summary}
                    compact
                    className="border-[color:var(--gc-border-soft)] bg-transparent p-2 md:p-3"
                    bodyClassName="md:py-6"
                  >
                    <ChatMarkdown
                      content={artifactContent}
                      className="max-w-none"
                    />
                  </DocumentCanvas>
                ) : (
                  <ChatMarkdown
                    content={artifactContent}
                    className="max-w-none"
                  />
                )}
                {!expandInlineArtifact && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background via-background/75 to-transparent" />
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5 md:gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 rounded-full px-2.5 text-micro md:h-7 md:gap-1.5 md:px-3 md:text-xs"
                  onClick={() =>
                    setCurrentArtifactViewState((current) => ({
                      ...current,
                      expanded: !current.expanded,
                    }))
                  }
                >
                  {expandInlineArtifact ? (
                    <Minimize2 className="h-3.5 w-3.5" />
                  ) : (
                    <Maximize2 className="h-3.5 w-3.5" />
                  )}
                  {expandInlineArtifact ? "Recolher texto" : "Expandir texto"}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 gap-1 rounded-full px-2.5 text-micro md:h-7 md:gap-1.5 md:px-3 md:text-xs"
                  onClick={() => openArtifact(artifact, message.id)}
                >
                  <PanelRightOpen className="h-3.5 w-3.5" />
                  {isQuizArtifact ? "Abrir quiz" : "Abrir Canvas"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  if (message.imageBase64) {
    return (
      <>
        <div className={cn("space-y-2.5 md:space-y-3", className)}>
          {content && content.trim().length > 0 && markdown}
          {message.isGeneratingImage && (
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-nano font-semibold uppercase tracking-eyebrow text-primary">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              Refinando imagem...
            </div>
          )}
          <div className="rounded-lg overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URI dinamica sem beneficio de otimizacao do next/image */}
            <img
              src={`data:${message.imageMimeType || "image/png"};base64,${message.imageBase64}`}
              alt="Generated image"
              className="w-full h-auto rounded-lg shadow-lg"
            />
          </div>
        </div>
      </>
    );
  }

  if (message.role === "assistant" && isCanvasPresentation) {
    return (
      <>
        <div className={cn("space-y-2.5 md:space-y-3", className)}>
          <div className="relative overflow-hidden rounded-xl border border-primary/15 bg-linear-to-br from-background/70 via-background/80 to-primary/[0.05] p-2.5 shadow-[0_20px_60px_rgba(14,116,144,0.08)] md:rounded-2xl md:p-3">
            <div className="relative overflow-hidden rounded-lg border border-[color:var(--gc-border-soft)] bg-background/80 px-2.5 py-2 md:rounded-xl md:px-6 md:py-5">
              {artifact?.kind === "quiz" ? (
                <QuizCanvas
                  artifact={artifact}
                  compact
                  onSessionChange={handleQuizSessionChange}
                />
              ) : (
                <DocumentCanvas
                  title={
                    artifact?.title ||
                    (prefersQuizMode ? "Quiz em elaboracao" : "Documento em elaboracao")
                  }
                  eyebrow={
                    artifact
                      ? "Documento no balao"
                      : prefersQuizMode
                      ? "Modo quiz ativo"
                      : "Modo documento ativo"
                  }
                  description={
                    artifact?.summary ||
                    (prefersQuizMode
                      ? "O quiz esta sendo estruturado com questoes interativas enquanto o modelo termina de montar tudo."
                      : "A resposta esta sendo estruturada como documento enquanto o modelo termina de escrever.")
                  }
                  compact
                  className="border-[color:var(--gc-border-soft)] bg-transparent p-2 md:p-3"
                  bodyClassName="md:py-6"
                >
                  {artifactContent.trim().length > 0 ? (
                    <ChatMarkdown
                      content={artifactContent}
                      className="max-w-none"
                    />
                  ) : (
                    <p className="text-body-sm leading-6 text-muted-foreground md:text-sm md:leading-7">
                      {prefersQuizMode ? "Montando o quiz..." : "Montando o documento..."}
                    </p>
                  )}
                </DocumentCanvas>
              )}
              {!expandInlineArtifact && artifact && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background via-background/75 to-transparent" />
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5 md:gap-2">
              {artifact && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 rounded-full px-2.5 text-micro md:h-7 md:gap-1.5 md:px-3 md:text-xs"
                  onClick={() =>
                    setCurrentArtifactViewState((current) => ({
                      ...current,
                      expanded: !current.expanded,
                    }))
                  }
                >
                  {expandInlineArtifact ? (
                    <Minimize2 className="h-3.5 w-3.5" />
                  ) : (
                    <Maximize2 className="h-3.5 w-3.5" />
                  )}
                  {expandInlineArtifact ? "Recolher texto" : "Expandir texto"}
                </Button>
              )}

              {artifact?.kind === "document" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 gap-1 rounded-full px-2.5 text-micro md:h-7 md:gap-1.5 md:px-3 md:text-xs"
                  onClick={() => openArtifact(artifact, message.id)}
                >
                  <PanelRightOpen className="h-3.5 w-3.5" />
                  Visualizar A4
                </Button>
              )}

              {artifact && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 gap-1 rounded-full px-2.5 text-micro md:h-7 md:gap-1.5 md:px-3 md:text-xs"
                  onClick={() => openArtifact(artifact, message.id)}
                >
                  <PanelRightOpen className="h-3.5 w-3.5" />
                  {prefersQuizMode ? "Abrir quiz" : "Abrir no painel"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  if (richContent.isRich) {
    return (
      <>
        <div className={cn("space-y-2.5 md:space-y-3", className)}>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              openArtifact(
                {
                  id: crypto.randomUUID(),
                  kind: "document",
                  title: richContent.type === "html" ? "HTML Interativo" : "Documento",
                  summary: "Preview gerado a partir do conteudo rico da mensagem.",
                  content,
                  type: richContent.type,
                },
                message.id
              )
            }
            className="h-6 gap-1 text-micro rounded-full border-primary/20 hover:bg-primary/5 md:h-7 md:gap-1.5 md:text-xs"
          >
            <PanelRightOpen className="h-3 w-3" />
            Abrir no painel
          </Button>

          {markdown}
          {streamNotice}
        </div>
      </>
    );
  }

  return (
    <>
      <div className={className}>
        {markdown}
        {streamNotice}
      </div>
    </>
  );
}
