"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Brain, ChevronDown, LoaderCircle } from "lucide-react";
import { Message, ReasoningStatus } from "@/types";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import { ReasoningRollingWindow } from "@/components/chat/ReasoningRollingWindow";
import { normalizeChatMarkdown } from "@/lib/formatting/chatMarkdown";
import { cn } from "@/lib/utils";

interface ReasoningPanelProps {
  message: Message;
}

interface ReasoningPanelOpenStateInput {
  currentOpen: boolean;
  isThinking: boolean;
  previousThinking: boolean;
}

interface ReasoningThinkingContentInput {
  summary: string;
  full: string;
}

interface ReasoningCompletedContentInput extends ReasoningThinkingContentInput {
  reasoningTokens?: number;
  reasoningConfigured?: boolean;
}

export function getNextReasoningPanelOpenState({
  currentOpen,
  isThinking,
  previousThinking,
}: ReasoningPanelOpenStateInput): boolean {
  if (isThinking) return true;
  if (previousThinking && !isThinking) return false;
  return currentOpen;
}

export function getReasoningThinkingContent({
  summary,
  full,
}: ReasoningThinkingContentInput): string {
  if (full.length > 0) return full;
  return summary;
}

export function getReasoningCompletedContent({
  summary,
  full,
  reasoningTokens,
  reasoningConfigured = false,
}: ReasoningCompletedContentInput): string {
  if (summary.length > 0) return summary;
  if (full.length > 0) return full;
  if (reasoningTokens && reasoningTokens > 0) {
    return `Raciocínio aplicado (${reasoningTokens.toLocaleString("pt-BR")} tokens), mas a API não emitiu um resumo textual nesta resposta.`;
  }
  if (reasoningConfigured) {
    return "Raciocínio configurado, mas a API não emitiu um resumo textual nesta resposta.";
  }
  return "";
}

function getStatusLabel(status?: ReasoningStatus) {
  if (status === "thinking") return "pensando";
  if (status === "complete") return "concluído";
  return null;
}

export function ReasoningPanel({ message }: ReasoningPanelProps) {
  const summary = useMemo(
    () => normalizeChatMarkdown(message.reasoningSummary ?? ""),
    [message.reasoningSummary]
  );
  const full = useMemo(
    () => normalizeChatMarkdown(message.reasoningText ?? ""),
    [message.reasoningText]
  );
  const hasSummary = summary.length > 0;
  const hasFull = full.length > 0;
  const isThinking = message.reasoningStatus === "thinking";
  const statusLabel = getStatusLabel(message.reasoningStatus);
  const thinkingContent = getReasoningThinkingContent({ summary, full });
  const completedContent = getReasoningCompletedContent({
    summary,
    full,
    reasoningTokens: message.reasoningTokens,
    reasoningConfigured: message.reasoningStatus === "complete",
  });
  const hasReasoning = hasSummary || hasFull || completedContent.length > 0 || isThinking;
  const [isOpen, setIsOpen] = useState(isThinking);
  const previousThinkingRef = useRef(isThinking);

  useEffect(() => {
    const previousThinking = previousThinkingRef.current;
    setIsOpen((currentOpen) =>
      getNextReasoningPanelOpenState({
        currentOpen,
        isThinking,
        previousThinking,
      })
    );
    previousThinkingRef.current = isThinking;
  }, [isThinking]);

  if (!hasReasoning) return null;

  return (
    <Collapsible
      className="group mt-1.5 md:mt-2"
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.06] px-2.5 py-1 text-micro text-foreground/70 transition-colors hover:bg-primary/[0.1] hover:text-foreground md:text-micro"
          )}
        >
          {isThinking ? (
            <LoaderCircle className="h-3 w-3 animate-spin text-primary" />
          ) : (
            <Brain className="h-3 w-3 text-primary" />
          )}
          <span className="font-medium">Raciocínio</span>
          {statusLabel && (
            <>
              <span className="text-foreground/35">·</span>
              <span
                className={cn(
                  "text-nano md:text-micro",
                  isThinking
                    ? "text-primary"
                    : "text-emerald-600 dark:text-emerald-400"
                )}
              >
                {statusLabel}
              </span>
            </>
          )}
          <ChevronDown className="h-3 w-3 text-foreground/40 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1.5 md:mt-2">
        {isThinking ? (
          thinkingContent.length > 0 ? (
            <ReasoningRollingWindow content={thinkingContent} isNormalized />
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-[color:var(--gc-border-soft)] bg-background/55 px-2.5 py-2 text-micro text-muted-foreground md:text-caption">
              <LoaderCircle className="h-3 w-3 animate-spin text-primary" />
              Organizando o raciocínio...
            </div>
          )
        ) : (
          completedContent.length > 0 && (
            <div className="rounded-lg border border-[color:var(--gc-border-soft)] bg-background/55 px-2.5 py-2 text-micro leading-5 text-foreground/75 md:rounded-xl md:px-3 md:py-2.5 md:text-caption md:leading-6">
              <ChatMarkdown content={completedContent} isNormalized />
            </div>
          )
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
