"use client";

import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, MessageSquareQuote, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { SlideIn } from "@/components/motion/SlideIn";
import { useNotes } from "@/hooks/useNotes";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useUIStore } from "@/stores/uiStore";
import type { TextSelection } from "@/hooks/useTextSelection";

interface SelectionToolbarProps {
  selection: TextSelection | null;
}

export function SelectionToolbar({ selection }: SelectionToolbarProps) {
  const isMobile = useIsMobile();
  const [copied, setCopied] = useState(false);
  const { appendToNotes } = useNotes();
  const { openContextPanel } = useUIStore();

  const handleQuote = useCallback(() => {
    if (!selection) return;
    window.dispatchEvent(
      new CustomEvent("gaucho:quote-text", { detail: { text: selection.text } }),
    );
  }, [selection]);

  const handleNote = useCallback(() => {
    if (!selection) return;
    appendToNotes(selection.text, selection.messageId);
    openContextPanel("notes");
  }, [selection, appendToNotes, openContextPanel]);

  const handleCopy = useCallback(async () => {
    if (!selection) return;
    try {
      await navigator.clipboard.writeText(selection.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Não consegui copiar.");
    }
  }, [selection]);

  if (isMobile || !selection) return null;

  const top = Math.max(8, selection.rect.top - 48);
  const left = selection.rect.left + selection.rect.width / 2;

  return createPortal(
    <div
      style={{
        position: "fixed",
        top,
        left,
        transform: "translateX(-50%)",
        zIndex: 200,
        pointerEvents: "auto",
      }}
    >
      <SlideIn from="bottom" distance={4} duration={0.15}>
        <div className="flex items-center gap-0.5 rounded-lg border border-white/12 bg-popover px-1 py-1 shadow-lg">
          <button
            type="button"
            className="gc-touch-target flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleQuote}
            title="Citar no composer"
            aria-label="Citar no composer"
          >
            <MessageSquareQuote className="size-3.5" />
          </button>
          <button
            type="button"
            className="gc-touch-target flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleNote}
            title="Adicionar à nota"
            aria-label="Adicionar à nota"
          >
            <StickyNote className="size-3.5" />
          </button>
          <button
            type="button"
            className="gc-touch-target flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleCopy}
            title="Copiar"
            aria-label="Copiar"
          >
            {copied ? (
              <Check className="size-3.5 text-emerald-400" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </button>
        </div>
      </SlideIn>
    </div>,
    document.body,
  );
}
