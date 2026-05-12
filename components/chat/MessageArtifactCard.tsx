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
        "rounded-[24px] border border-primary/15 bg-[linear-gradient(180deg,rgba(14,116,144,0.08),rgba(14,116,144,0.03))] p-3 shadow-[0_14px_38px_rgba(14,116,144,0.08)]",
      className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] bg-primary/10 ring-1 ring-primary/15">
          {isQuizArtifact ? (
            <ClipboardList className="h-4 w-4 text-primary" />
          ) : (
            <FileText className="h-4 w-4 text-primary" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="border-primary/20 bg-background/70 text-nano uppercase tracking-wide">
              {isQuizArtifact ? "Quiz" : "Documento"}
            </Badge>
            {isDocumentModeArtifact && (
              <Badge variant="outline" className="border-primary/20 bg-primary/10 text-nano uppercase tracking-wide text-primary">
                Modo documento
              </Badge>
            )}
            {artifact.kind === "document" ? (
              <Badge variant="outline" className="border-[color:var(--gc-border-soft)] bg-background/50 text-nano uppercase tracking-wide text-muted-foreground">
                {artifact.type === "html" ? "HTML" : "Markdown"}
              </Badge>
            ) : (
              <Badge variant="outline" className="border-[color:var(--gc-border-soft)] bg-background/50 text-nano uppercase tracking-wide text-muted-foreground">
                {artifact.quiz.session.status === "submitted" ? "Corrigido" : "Em andamento"}
              </Badge>
            )}
            <Badge variant="outline" className="border-[color:var(--gc-border-soft)] bg-background/50 text-nano text-muted-foreground">
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
          {isQuizArtifact ? "Abrir quiz" : "Visualizar A4"}
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
