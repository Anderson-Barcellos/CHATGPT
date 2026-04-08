"use client";

import { MessageArtifact } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileText,
  PanelRightOpen,
} from "lucide-react";

interface MessageArtifactCardProps {
  artifact: MessageArtifact;
  showInline: boolean;
  onOpen: () => void;
  onToggleInline: () => void;
  className?: string;
}

function getLineCount(content: string): number {
  return content.split("\n").filter((line) => line.trim().length > 0).length;
}

export function MessageArtifactCard({
  artifact,
  showInline,
  onOpen,
  onToggleInline,
  className,
}: MessageArtifactCardProps) {
  const lineCount = artifact.kind === "document" ? getLineCount(artifact.content) : artifact.quiz.questions.length;
  const canToggleInline = artifact.kind === "quiz" ? true : artifact.type !== "html";
  const isDocumentModeArtifact = artifact.displayMode === "document";
  const isQuizArtifact = artifact.kind === "quiz";

  return (
    <div
      className={cn(
        "rounded-[24px] border border-cyan-500/12 bg-[linear-gradient(180deg,rgba(6,182,212,0.08),rgba(8,145,178,0.03))] p-3 shadow-[0_14px_38px_rgba(8,145,178,0.08)]",
      className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] bg-cyan-500/10 ring-1 ring-cyan-400/15">
          {isQuizArtifact ? (
            <ClipboardList className="h-4 w-4 text-cyan-500" />
          ) : (
            <FileText className="h-4 w-4 text-cyan-500" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="border-cyan-500/20 bg-background/70 text-[10px] uppercase tracking-wide">
              {isQuizArtifact ? "Quiz" : "Documento"}
            </Badge>
            {isDocumentModeArtifact && (
              <Badge variant="outline" className="border-cyan-400/20 bg-cyan-500/10 text-[10px] uppercase tracking-wide text-cyan-100">
                Modo documento
              </Badge>
            )}
            {artifact.kind === "document" ? (
              <Badge variant="outline" className="border-white/10 bg-background/50 text-[10px] uppercase tracking-wide text-muted-foreground">
                {artifact.type === "html" ? "HTML" : "Markdown"}
              </Badge>
            ) : (
              <Badge variant="outline" className="border-white/10 bg-background/50 text-[10px] uppercase tracking-wide text-muted-foreground">
                {artifact.quiz.session.status === "submitted" ? "Corrigido" : "Em andamento"}
              </Badge>
            )}
            <Badge variant="outline" className="border-white/10 bg-background/50 text-[10px] text-muted-foreground">
              {isQuizArtifact ? `${lineCount} questoes` : `${lineCount} linhas`}
            </Badge>
          </div>

          <div className="mt-2 text-sm font-semibold leading-tight text-foreground">
            {artifact.title}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground/85">
            {artifact.summary}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" className="h-8 gap-1.5 rounded-full px-3 text-xs" onClick={onOpen}>
          <PanelRightOpen className="h-3.5 w-3.5" />
          {isQuizArtifact ? "Abrir quiz" : "Abrir documento"}
        </Button>

        {canToggleInline && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 rounded-full px-3 text-xs"
            onClick={onToggleInline}
          >
            {showInline ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            {showInline ? "Ocultar no balao" : "Mostrar no balao"}
          </Button>
        )}
      </div>
    </div>
  );
}
