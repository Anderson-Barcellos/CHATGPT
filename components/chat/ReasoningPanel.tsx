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
import { cn } from "@/lib/utils";

interface ReasoningPanelProps {
  message: Message;
}

function getStatusLabel(status?: ReasoningStatus) {
  if (status === "thinking") return "Ao vivo";
  if (status === "complete") return "Concluido";
  return null;
}

export function ReasoningPanel({ message }: ReasoningPanelProps) {
  const summary = message.reasoningSummary?.trim() ?? "";
  const full = message.reasoningText?.trim() ?? "";
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
    <Collapsible className="mt-3 rounded-xl border border-cyan-500/15 bg-cyan-500/5">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto w-full justify-between rounded-xl px-3 py-2.5 text-xs hover:bg-cyan-500/10"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500/12">
              {isThinking ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin text-cyan-500" />
              ) : (
                <Brain className="h-3.5 w-3.5 text-cyan-500" />
              )}
            </div>
            <div className="text-left">
              <div className="font-medium text-foreground">Processo do modelo</div>
              <div className="text-[11px] text-muted-foreground">
                {isThinking
                  ? "O reasoning esta chegando em tempo real."
                  : "Resumo e trilha de raciocinio, quando disponiveis."}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {statusLabel && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  isThinking
                    ? "bg-cyan-500/12 text-cyan-600 dark:text-cyan-400"
                    : "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                )}
              >
                {statusLabel}
              </span>
            )}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </div>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3">
        {!hasSummary && !hasFull ? (
          <div className="flex items-center gap-2 rounded-lg bg-background/60 px-3 py-2 text-xs text-muted-foreground">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin text-cyan-500" />
            Organizando o reasoning desta resposta...
          </div>
        ) : hasSummary && hasFull ? (
          <Tabs defaultValue={defaultTab} className="gap-3">
            <TabsList className="w-full justify-start bg-background/70">
              <TabsTrigger value="summary" className="text-xs">
                Resumo
              </TabsTrigger>
              <TabsTrigger value="full" className="text-xs">
                Completo
              </TabsTrigger>
            </TabsList>
            <TabsContent value="summary" className="mt-0 rounded-xl bg-background/70 p-3">
              <ChatMarkdown content={summary} />
            </TabsContent>
            <TabsContent value="full" className="mt-0 rounded-xl bg-background/70 p-3">
              <ChatMarkdown content={full} />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="rounded-xl bg-background/70 p-3">
            <ChatMarkdown content={hasSummary ? summary : full} />
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
