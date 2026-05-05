"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Download, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { CanvasContent } from "@/components/workspace-v2/canvas/CanvasContent";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useUIStore } from "@/stores/uiStore";
import type { DocumentMessageArtifact } from "@/types";

export function CanvasOverlayV2() {
  const {
    artifactOpen,
    activeArtifact,
    closeArtifact,
  } = useUIStore();

  const isMobile = useIsMobile();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && artifactOpen) closeArtifact();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [artifactOpen, closeArtifact]);

  const handleCopy = useCallback(async () => {
    if (!activeArtifact) return;
    const content =
      activeArtifact.kind === "document"
        ? activeArtifact.content
        : JSON.stringify(activeArtifact.quiz, null, 2);
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Não consegui copiar.");
    }
  }, [activeArtifact]);

  const handleDownload = useCallback(() => {
    if (!activeArtifact) return;
    const isDoc = activeArtifact.kind === "document";
    const docArtifact = isDoc ? (activeArtifact as DocumentMessageArtifact) : null;
    const content = isDoc
      ? docArtifact!.content
      : JSON.stringify((activeArtifact as Extract<typeof activeArtifact, { kind: "quiz" }>).quiz, null, 2);
    const ext = isDoc ? (docArtifact!.type === "html" ? "html" : "md") : "json";
    const mime = isDoc
      ? docArtifact!.type === "html"
        ? "text/html"
        : "text/markdown"
      : "application/json";
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeArtifact.title || "artefato"}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeArtifact]);

  if (!isMobile) return null;

  return (
    <Sheet open={artifactOpen} onOpenChange={(open) => !open && closeArtifact()}>
      <SheetContent side="bottom" className="flex h-[calc(90dvh-env(safe-area-inset-bottom))] flex-col gap-0 p-0">
        <div className="flex shrink-0 items-center justify-between border-b border-white/8 px-3 py-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={closeArtifact}
            >
              ← Conversa
            </button>
            {activeArtifact && (
              <>
                <span className="text-xs text-muted-foreground">/</span>
                <span className="min-w-0 truncate text-xs font-medium text-foreground">
                  {activeArtifact.title}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="size-7" onClick={handleCopy}>
              {copied ? (
                <Check className="size-3.5 text-emerald-400" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </Button>
            <Button variant="ghost" size="icon" className="size-7" onClick={handleDownload}>
              <Download className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7" onClick={closeArtifact}>
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          {activeArtifact && <CanvasContent artifact={activeArtifact} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
