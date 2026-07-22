"use client";

import { useCallback, useRef, useState } from "react";
import {
  ArrowDown,
  Check,
  Copy,
  MessageSquareQuote,
  Minimize2,
  RefreshCw,
  Sparkles,
  StickyNote,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { FadeIn } from "@/components/motion/FadeIn";
import { MiniAudioPlayer } from "@/components/chat/MiniAudioPlayer";
import { useNotes } from "@/hooks/useNotes";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useUIStore } from "@/stores/uiStore";
import { cn } from "@/lib/utils";
import type { MessageStreamStatus } from "@/types";

interface QuickActionsBarProps {
  content: string;
  messageId: string;
  streamStatus?: MessageStreamStatus;
  onRegenerate?: () => void;
  className?: string;
  alwaysVisible?: boolean;
}

function ActionButton({
  onClick,
  title,
  disabled,
  className,
  children,
}: {
  onClick: () => void;
  title: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex size-7 items-center justify-center rounded-md text-muted-foreground/70 hover:bg-[var(--gc-surface-control-hover)] hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
        className
      )}
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
  alwaysVisible = false,
}: QuickActionsBarProps) {
  const isMobile = useIsMobile();
  const [copied, setCopied] = useState(false);
  const [touched, setTouched] = useState(false);
  const [audioPlayerOpen, setAudioPlayerOpen] = useState(false);
  const touchTimer = useRef<number | undefined>(undefined);

  const handleTouchStart = useCallback(() => {
    if (!isMobile) return;
    setTouched(true);
    window.clearTimeout(touchTimer.current);
    touchTimer.current = window.setTimeout(() => setTouched(false), 2000);
  }, [isMobile]);
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

  const handlePulseDraft = useCallback(() => {
    setActivePanelTab("pulse");
    window.dispatchEvent(
      new CustomEvent("gaucho:pulse-draft-from-text", { detail: { text: content } })
    );
  }, [content, setActivePanelTab]);

  const handleQuote = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("gaucho:quote-text", { detail: { text: content } })
    );
  }, [content]);

  const handleContinue = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("gaucho:send-message", { detail: { text: "Continue." } })
    );
  }, []);

  const handleShorten = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("gaucho:send-message", {
        detail: { text: "Encurte a resposta acima." },
      })
    );
  }, []);

  if (streamStatus === "streaming") return null;

  const bar = (
    <div
      onTouchStart={handleTouchStart}
      className={cn(
        "flex flex-wrap items-center gap-0.5",
        alwaysVisible
          ? "opacity-100"
          : isMobile
            ? touched
              ? "opacity-100"
              : "opacity-55 transition-opacity"
            : "opacity-0 transition-opacity group-hover:opacity-100",
        className
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
      <ActionButton
        onClick={() => setAudioPlayerOpen(true)}
        title="Abrir player de áudio"
        disabled={content.trim().length === 0}
      >
        <Volume2 className="size-3.5" />
      </ActionButton>
      <ActionButton onClick={handleContinue} title="Continuar">
        <ArrowDown className="size-3.5" />
      </ActionButton>
      <ActionButton onClick={handleShorten} title="Encurtar">
        <Minimize2 className="size-3.5" />
      </ActionButton>
      <ActionButton onClick={handleNote} title="Adicionar à nota">
        <StickyNote className="size-3.5" />
      </ActionButton>
      <ActionButton
        onClick={handlePulseDraft}
        title="Criar Pulse"
        disabled={content.trim().length === 0}
      >
        <Sparkles className="size-3.5" />
      </ActionButton>
      <ActionButton onClick={handleQuote} title="Citar no composer">
        <MessageSquareQuote className="size-3.5" />
      </ActionButton>
    </div>
  );

  const wrappedBar = (
    <div className={cn("flex flex-col items-start", className)}>
      {bar}
      {audioPlayerOpen && (
        <MiniAudioPlayer
          content={content}
          messageId={messageId}
          onClose={() => setAudioPlayerOpen(false)}
        />
      )}
    </div>
  );

  if (
    streamStatus === "completed" ||
    streamStatus === "interrupted" ||
    streamStatus === "aborted" ||
    streamStatus === "failed"
  ) {
    return <FadeIn delay={0.3}>{wrappedBar}</FadeIn>;
  }

  return wrappedBar;
}
