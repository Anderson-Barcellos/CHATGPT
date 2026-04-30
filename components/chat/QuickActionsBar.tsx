"use client";

import { useCallback, useState } from "react";
import {
  ArrowDown,
  Check,
  Copy,
  MessageSquareQuote,
  Minimize2,
  RefreshCw,
  StickyNote,
} from "lucide-react";
import { toast } from "sonner";
import { FadeIn } from "@/components/motion/FadeIn";
import { useNotes } from "@/hooks/useNotes";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useUIStore } from "@/stores/uiStore";
import { cn } from "@/lib/utils";

interface QuickActionsBarProps {
  content: string;
  messageId: string;
  streamStatus?: string;
  onRegenerate?: () => void;
  className?: string;
}

function ActionButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-md text-muted-foreground/70 hover:bg-white/[0.06] hover:text-foreground"
    >
      {children}
    </button>
  );
}

export function QuickActionsBar({
  content,
  messageId,
  streamStatus,
  onRegenerate,
  className,
}: QuickActionsBarProps) {
  const isMobile = useIsMobile();
  const [copied, setCopied] = useState(false);
  const { appendToNotes } = useNotes();
  const { setActivePanelTab } = useUIStore();

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Não consegui copiar.");
    }
  }, [content]);

  const handleNote = useCallback(() => {
    appendToNotes(content, messageId);
    setActivePanelTab("notes");
  }, [content, messageId, appendToNotes, setActivePanelTab]);

  const handleQuote = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("gaucho:quote-text", { detail: { text: content } }),
    );
  }, [content]);

  const handleContinue = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("gaucho:send-message", { detail: { text: "Continue." } }),
    );
  }, []);

  const handleShorten = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("gaucho:send-message", {
        detail: { text: "Encurte a resposta acima." },
      }),
    );
  }, []);

  if (streamStatus === "streaming") return null;

  const bar = (
    <div
      className={cn(
        "flex items-center gap-0.5",
        isMobile ? "opacity-55" : "opacity-0 transition-opacity group-hover:opacity-100",
        className,
      )}
    >
      <ActionButton onClick={handleCopy} title="Copiar">
        {copied ? (
          <Check className="size-3.5 text-emerald-400" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </ActionButton>
      {onRegenerate && (
        <ActionButton onClick={onRegenerate} title="Regenerar">
          <RefreshCw className="size-3.5" />
        </ActionButton>
      )}
      <ActionButton onClick={handleContinue} title="Continuar">
        <ArrowDown className="size-3.5" />
      </ActionButton>
      <ActionButton onClick={handleShorten} title="Encurtar">
        <Minimize2 className="size-3.5" />
      </ActionButton>
      <ActionButton onClick={handleNote} title="Adicionar à nota">
        <StickyNote className="size-3.5" />
      </ActionButton>
      <ActionButton onClick={handleQuote} title="Citar no composer">
        <MessageSquareQuote className="size-3.5" />
      </ActionButton>
    </div>
  );

  if (streamStatus === "completed") {
    return <FadeIn delay={0.3}>{bar}</FadeIn>;
  }

  return bar;
}
