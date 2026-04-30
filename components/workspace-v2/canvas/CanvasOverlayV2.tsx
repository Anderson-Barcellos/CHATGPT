"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Download, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { CanvasContent } from "@/components/workspace-v2/canvas/CanvasContent";
import { CanvasDragHandle } from "@/components/workspace-v2/canvas/CanvasDragHandle";
import { CanvasResizeHandle } from "@/components/workspace-v2/canvas/CanvasResizeHandle";
import { useCanvasDrag } from "@/components/workspace-v2/canvas/useCanvasDrag";
import { useCanvasResize, RESIZE_DIRS } from "@/components/workspace-v2/canvas/useCanvasResize";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useUIStore } from "@/stores/uiStore";
import type { DocumentMessageArtifact } from "@/types";

export function CanvasOverlayV2() {
  const {
    artifactOpen,
    activeArtifact,
    canvasPosition,
    canvasDimensions,
    canvasMaximized,
    setCanvasPosition,
    setCanvasDimensions,
    setCanvasMaximized,
    closeArtifact,
  } = useUIStore();

  const isMobile = useIsMobile();
  const [copied, setCopied] = useState(false);

  const { currentPos, handlers: dragHandlers } = useCanvasDrag(
    canvasPosition,
    canvasDimensions,
    setCanvasPosition,
  );

  const { currentLayout, isResizing, getHandlers } = useCanvasResize(
    canvasPosition,
    canvasDimensions,
    setCanvasPosition,
    setCanvasDimensions,
  );

  const displayPos = isResizing
    ? { x: currentLayout.x, y: currentLayout.y }
    : currentPos;

  const displayDim = isResizing
    ? { w: currentLayout.w, h: currentLayout.h }
    : canvasDimensions;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && artifactOpen) closeArtifact();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [artifactOpen, closeArtifact]);

  useEffect(() => {
    const reclamp = () => {
      const { x, y } = canvasPosition;
      const { w, h } = canvasDimensions;
      const nx = Math.max(-(w - 80), Math.min(window.innerWidth - 80, x));
      const ny = Math.max(0, Math.min(window.innerHeight - 40, y));
      if (nx !== x || ny !== y) setCanvasPosition({ x: nx, y: ny });
    };
    window.addEventListener("resize", reclamp);
    return () => window.removeEventListener("resize", reclamp);
  }, [canvasPosition, canvasDimensions, setCanvasPosition]);

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

  const handleMaximize = useCallback(() => {
    setCanvasMaximized(!canvasMaximized);
  }, [canvasMaximized, setCanvasMaximized]);

  if (isMobile) {
    return (
      <Sheet open={artifactOpen} onOpenChange={(open) => !open && closeArtifact()}>
        <SheetContent side="bottom" className="flex h-[90vh] flex-col gap-0 p-0">
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

  const overlayStyle = canvasMaximized
    ? ({
        position: "fixed" as const,
        left: "5vw",
        top: "5vh",
        width: "90vw",
        height: "90vh",
        zIndex: 150,
      } as React.CSSProperties)
    : ({
        position: "fixed" as const,
        left: displayPos.x,
        top: displayPos.y,
        width: displayDim.w,
        height: displayDim.h,
        zIndex: 150,
      } as React.CSSProperties);

  return (
    <>
      <AnimatePresence>
        {artifactOpen && (
          <motion.div
            key="canvas-backdrop"
            className="fixed inset-0 z-[140] bg-background/40 backdrop-blur-[24px]"
            style={{ pointerEvents: "none" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {artifactOpen && activeArtifact && (
          <motion.div
            key="canvas-overlay"
            className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-background shadow-2xl"
            style={overlayStyle}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <CanvasDragHandle
              title={activeArtifact.title}
              isMaximized={canvasMaximized}
              copied={copied}
              onMaximize={handleMaximize}
              onClose={closeArtifact}
              onCopy={handleCopy}
              onDownload={handleDownload}
              onPointerDown={dragHandlers.onPointerDown}
              onPointerMove={dragHandlers.onPointerMove}
              onPointerUp={dragHandlers.onPointerUp}
              onPointerCancel={dragHandlers.onPointerCancel}
            />

            <div className="relative min-h-0 flex-1 overflow-hidden">
              <CanvasContent artifact={activeArtifact} />
            </div>

            {!canvasMaximized &&
              RESIZE_DIRS.map((dir) => (
                <CanvasResizeHandle key={dir} dir={dir} {...getHandlers(dir)} />
              ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
