"use client";

import { Check, Copy, Download, Maximize2, Minimize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CanvasDragHandleProps {
  title: string;
  isMaximized: boolean;
  copied: boolean;
  onMaximize: () => void;
  onClose: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
}

export function CanvasDragHandle({
  title,
  isMaximized,
  copied,
  onMaximize,
  onClose,
  onCopy,
  onDownload,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: CanvasDragHandleProps) {
  return (
    <div
      className="flex h-10 shrink-0 select-none items-center justify-between gap-2 rounded-t-xl border-b border-white/8 bg-white/[0.03] px-3 hover:bg-white/[0.05]"
      style={{ cursor: "grab" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <span className="min-w-0 truncate text-xs font-semibold text-foreground">{title}</span>

      <div
        className="flex shrink-0 items-center gap-0.5"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Button variant="ghost" size="icon" className="size-7" onClick={onCopy} title="Copiar">
          {copied ? (
            <Check className="size-3.5 text-emerald-400" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </Button>
        <Button variant="ghost" size="icon" className="size-7" onClick={onDownload} title="Baixar">
          <Download className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onMaximize}
          title={isMaximized ? "Restaurar" : "Maximizar"}
        >
          {isMaximized ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        </Button>
        <Button variant="ghost" size="icon" className="size-7" onClick={onClose} title="Fechar">
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
