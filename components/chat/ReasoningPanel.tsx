"use client";

import { useMemo } from "react";
import { Brain, ChevronDown, LoaderCircle } from "lucide-react";
import { Message, ReasoningStatus } from "@/types";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import { ReasoningRollingWindow } from "@/components/chat/ReasoningRollingWindow";
import { normalizeReasoningMarkdown } from "@/lib/formatting/reasoning";
import { cn } from "@/lib/utils";

interface ReasoningPanelProps {
  message: Message;
}

function getStatusLabel(status?: ReasoningStatus) {
  if (status === "thinking") return "pensando";
  if (status === "complete") return "concluído";
  return null;
}

export function ReasoningPanel({ message }: ReasoningPanelProps) {
  const summary = useMemo(
    () => normalizeReasoningMarkdown(message.reasoningSummary ?? ""),
    [message.reasoningSummary]
  );
  const full = useMemo(
    () => normalizeReasoningMarkdown(message.reasoningText ?? ""),
    [message.reasoningText]
  );
  const hasSummary = summary.length > 0;
  const hasFull = full.length > 0;
  const isThinking = message.reasoningStatus === "thinking";
  const hasReasoning = hasSummary || hasFull || isThinking;
  const statusLabel = getStatusLabel(message.reasoningStatus);
  const completedContent = hasSummary ? summary : full;

  if (!hasReasoning) return null;

  return (
    <Collapsible className="group mt-1.5 md:mt-2">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/[0.06] px-2.5 py-1 text-micro text-foreground/70 transition-colors hover:bg-cyan-500/[0.1] hover:text-foreground md:text-micro"
          )}
        >
          {isThinking ? (
            <LoaderCircle className="h-3 w-3 animate-spin text-cyan-500" />
          ) : (
            <Brain className="h-3 w-3 text-cyan-500" />
          )}
          <span className="font-medium">Raciocínio</span>
          {statusLabel && (
            <>
              <span className="text-foreground/35">·</span>
              <span
                className={cn(
                  "text-nano md:text-micro",
                  isThinking
                    ? "text-cyan-600 dark:text-cyan-400"
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
          hasFull ? (
            <ReasoningRollingWindow content={full} />
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-white/6 bg-background/55 px-2.5 py-2 text-micro text-muted-foreground md:text-caption">
              <LoaderCircle className="h-3 w-3 animate-spin text-cyan-500" />
              Organizando o raciocínio...
            </div>
          )
        ) : (
          completedContent.length > 0 && (
            <div className="rounded-lg border border-white/6 bg-background/55 px-2.5 py-2 text-micro leading-5 text-foreground/75 md:rounded-xl md:px-3 md:py-2.5 md:text-caption md:leading-6">
              <ChatMarkdown content={completedContent} />
            </div>
          )
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
