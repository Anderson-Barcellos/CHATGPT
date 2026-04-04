"use client";

import { useState } from "react";
import { Message } from "@/types";
import "katex/dist/katex.min.css";
import { Button } from "@/components/ui/button";
import { PanelRightOpen, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/uiStore";
import { DocumentCanvas } from "@/components/artifacts/DocumentCanvas";
import { ChatMarkdown } from "./ChatMarkdown";
import { MessageArtifactCard } from "./MessageArtifactCard";
import {
  cleanCitationMarkers,
  detectRichContent,
} from "@/lib/artifacts/messageArtifacts";

interface MessageContentProps {
  message: Message;
  className?: string;
}

export function MessageContent({ message, className }: MessageContentProps) {
  const { openArtifact } = useUIStore();
  const artifact = message.artifact;
  const prefersDocumentMode = message.preferredDisplayMode === "document";
  const isDocumentArtifact = artifact?.displayMode === "document";
  const isDocumentPresentation = isDocumentArtifact || prefersDocumentMode;
  const [showArtifactInline, setShowArtifactInline] = useState(isDocumentPresentation);
  const [expandInlineArtifact, setExpandInlineArtifact] = useState(isDocumentPresentation);
  const content = cleanCitationMarkers(message.content);
  const richContent = detectRichContent(content);
  const artifactContent = artifact?.content ?? content;

  const markdown = (
    <ChatMarkdown
      content={artifactContent}
    />
  );

  if (artifact && message.role === "assistant" && !message.imageBase64) {
    return (
      <div className={cn("space-y-2.5 md:space-y-3", className)}>
        <MessageArtifactCard
          artifact={artifact}
          showInline={showArtifactInline}
          onOpen={() => openArtifact(artifact.content, artifact.type, artifact.title)}
          onToggleInline={() =>
            setShowArtifactInline((current) => {
              const nextValue = !current;
              if (!nextValue) {
                setExpandInlineArtifact(false);
              }
              return nextValue;
            })
          }
        />

        {showArtifactInline && (
          <div
            className={cn(
              "relative overflow-hidden rounded-xl border p-2.5 md:rounded-2xl md:p-3",
              isDocumentArtifact
                ? "border-cyan-400/15 bg-linear-to-br from-white/[0.08] via-background/75 to-cyan-500/[0.05] shadow-[0_20px_60px_rgba(6,182,212,0.08)]"
                : "border-border/70 bg-background/55"
            )}
          >
            <div
              className={cn(
                "relative overflow-hidden rounded-lg border px-2.5 py-2 transition-[max-height] duration-300 md:rounded-xl md:px-3",
                isDocumentArtifact
                  ? "border-white/10 bg-background/80 md:px-6 md:py-5"
                  : "border-border/60 bg-background/75",
                expandInlineArtifact ? "max-h-[60vh] md:max-h-[70vh]" : "max-h-48 md:max-h-56"
              )}
            >
              {isDocumentArtifact ? (
                <DocumentCanvas
                  title={artifact.title}
                  eyebrow="Documento no balao"
                  description={artifact.summary}
                  compact
                  className="border-black/5 bg-transparent p-2 dark:border-white/8 md:p-3"
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
                className="h-6 gap-1 rounded-full px-2.5 text-[11px] md:h-7 md:gap-1.5 md:px-3 md:text-xs"
                onClick={() => setExpandInlineArtifact((current) => !current)}
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
                className="h-6 gap-1 rounded-full px-2.5 text-[11px] md:h-7 md:gap-1.5 md:px-3 md:text-xs"
                onClick={() => openArtifact(artifact.content, artifact.type, artifact.title)}
              >
                <PanelRightOpen className="h-3.5 w-3.5" />
                Abrir no painel
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (message.imageBase64) {
    return (
      <div className={cn("space-y-2.5 md:space-y-3", className)}>
        {content && content.trim().length > 0 && markdown}
        <div className="rounded-lg overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URI dinamica sem beneficio de otimizacao do next/image */}
          <img
            src={`data:${message.imageMimeType || "image/png"};base64,${message.imageBase64}`}
            alt="Generated image"
            className="w-full h-auto rounded-lg shadow-lg"
          />
        </div>
      </div>
    );
  }

  if (message.role === "assistant" && isDocumentPresentation) {
    return (
      <div className={cn("space-y-2.5 md:space-y-3", className)}>
        <div className="relative overflow-hidden rounded-xl border border-cyan-400/15 bg-linear-to-br from-white/[0.08] via-background/75 to-cyan-500/[0.05] p-2.5 shadow-[0_20px_60px_rgba(6,182,212,0.08)] md:rounded-2xl md:p-3">
          <div className="relative overflow-hidden rounded-lg border border-white/10 bg-background/80 px-2.5 py-2 md:rounded-xl md:px-6 md:py-5">
            <DocumentCanvas
              title={artifact?.title || "Documento em elaboracao"}
              eyebrow={artifact ? "Documento no balao" : "Modo documento ativo"}
              description={
                artifact?.summary ||
                "A resposta esta sendo estruturada como documento enquanto o modelo termina de escrever."
              }
              compact
              className="border-black/5 bg-transparent p-2 dark:border-white/8 md:p-3"
              bodyClassName="md:py-6"
            >
              {artifactContent.trim().length > 0 ? (
                <ChatMarkdown
                  content={artifactContent}
                  className="max-w-none"
                />
              ) : (
                <p className="text-[13px] leading-6 text-muted-foreground md:text-sm md:leading-7">
                  Montando o documento...
                </p>
              )}
            </DocumentCanvas>
            {!expandInlineArtifact && artifact && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background via-background/75 to-transparent" />
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5 md:gap-2">
            {artifact && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 rounded-full px-2.5 text-[11px] md:h-7 md:gap-1.5 md:px-3 md:text-xs"
                onClick={() => setExpandInlineArtifact((current) => !current)}
              >
                {expandInlineArtifact ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
                {expandInlineArtifact ? "Recolher texto" : "Expandir texto"}
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="h-6 gap-1 rounded-full px-2.5 text-[11px] md:h-7 md:gap-1.5 md:px-3 md:text-xs"
              onClick={() =>
                openArtifact(
                  artifactContent,
                  artifact?.type ?? "markdown",
                  artifact?.title ?? "Documento"
                )
              }
            >
              <PanelRightOpen className="h-3.5 w-3.5" />
              Abrir no painel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (richContent.isRich) {
    return (
      <div className={cn("space-y-2.5 md:space-y-3", className)}>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            openArtifact(
              content,
              richContent.type,
              richContent.type === "html" ? "HTML Interativo" : "Documento"
            )
          }
          className="h-6 gap-1 text-[11px] rounded-full border-primary/20 hover:bg-primary/5 md:h-7 md:gap-1.5 md:text-xs"
        >
          <PanelRightOpen className="h-3 w-3" />
          Abrir no painel
        </Button>

        {markdown}
      </div>
    );
  }

  return <div className={className}>{markdown}</div>;
}
