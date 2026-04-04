"use client";

import { useMemo } from "react";
import { Brain, ChevronDown, LoaderCircle } from "lucide-react";
import { Message, ReasoningStatus } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import { normalizeReasoningMarkdown } from "@/lib/formatting/reasoning";
import { cn } from "@/lib/utils";

interface ReasoningPanelProps {
  message: Message;
}

function getStatusLabel(status?: ReasoningStatus) {
  if (status === "thinking") return "Ao vivo";
  if (status === "complete") return "Concluído";
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
  const defaultTab = useMemo(() => {
    if (hasSummary) return "summary";
    return "full";
  }, [hasSummary]);
  const statusLabel = getStatusLabel(message.reasoningStatus);

  if (!hasReasoning) return null;

  return (
    <Collapsible className="mt-2.5 rounded-xl border border-cyan-500/15 bg-[linear-gradient(180deg,rgba(6,182,212,0.08),rgba(8,145,178,0.03))] shadow-[0_12px_28px_rgba(8,145,178,0.08)] md:mt-3 md:rounded-2xl md:shadow-[0_14px_34px_rgba(8,145,178,0.08)]">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto w-full justify-between rounded-xl px-2.5 py-2.5 text-[11px] hover:bg-cyan-500/10 md:rounded-2xl md:px-3 md:py-3 md:text-xs"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500/12 ring-1 ring-cyan-400/15 md:h-8 md:w-8">
              {isThinking ? (
                <LoaderCircle className="h-3 w-3 animate-spin text-cyan-500 md:h-3.5 md:w-3.5" />
              ) : (
                <Brain className="h-3 w-3 text-cyan-500 md:h-3.5 md:w-3.5" />
              )}
            </div>
            <div className="text-left">
              <div className="font-medium text-foreground">Processo do modelo</div>
              <div className="text-[10px] text-muted-foreground md:text-[11px]">
                {isThinking
                  ? "O raciocínio está chegando em tempo real."
                  : "Resumo e trilha de raciocínio, quando disponíveis."}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {statusLabel && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] md:px-2.5 md:py-1 md:text-[10px] md:tracking-[0.16em]",
                  isThinking
                    ? "bg-cyan-500/12 text-cyan-600 dark:text-cyan-400"
                    : "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                )}
              >
                {statusLabel}
              </span>
            )}
            <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 md:h-3.5 md:w-3.5" />
          </div>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-2.5 pb-2.5 md:px-3 md:pb-3">
        {!hasSummary && !hasFull ? (
          <div className="flex items-center gap-2 rounded-xl border border-white/6 bg-background/55 px-2.5 py-2 text-[11px] text-muted-foreground md:px-3 md:py-2.5 md:text-xs">
            <LoaderCircle className="h-3 w-3 animate-spin text-cyan-500 md:h-3.5 md:w-3.5" />
            Organizando o raciocínio desta resposta...
          </div>
        ) : hasSummary && hasFull ? (
          <Tabs defaultValue={defaultTab} className="gap-2.5 md:gap-3">
            <TabsList className="w-full justify-start rounded-full bg-background/65 p-1">
              <TabsTrigger value="summary" className="rounded-full text-[11px] data-[state=active]:bg-background/90 md:text-xs">
                Resumo
              </TabsTrigger>
              <TabsTrigger value="full" className="rounded-full text-[11px] data-[state=active]:bg-background/90 md:text-xs">
                Completo
              </TabsTrigger>
            </TabsList>
            <TabsContent value="summary" className="mt-0 rounded-xl border border-white/6 bg-background/60 p-2.5 md:rounded-2xl md:p-3">
              <div className="text-[11px] leading-5 text-foreground/82 md:text-[12px] md:leading-6">
                <ChatMarkdown content={summary} />
              </div>
            </TabsContent>
            <TabsContent value="full" className="mt-0 rounded-xl border border-white/6 bg-background/55 p-2.5 md:rounded-2xl md:p-3">
              <div className="text-[11px] leading-5 text-foreground/72 md:text-[12px] md:leading-6">
                <ChatMarkdown content={full} />
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="rounded-xl border border-white/6 bg-background/60 p-2.5 text-[11px] leading-5 text-foreground/80 md:rounded-2xl md:p-3 md:text-[12px] md:leading-6">
            <ChatMarkdown content={hasSummary ? summary : full} />
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
