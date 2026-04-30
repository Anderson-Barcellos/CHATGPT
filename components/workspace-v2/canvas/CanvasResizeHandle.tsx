"use client";

import { cn } from "@/lib/utils";
import type { ResizeDir } from "@/components/workspace-v2/canvas/useCanvasResize";

const CURSOR: Record<ResizeDir, string> = {
  n: "cursor-n-resize",
  ne: "cursor-ne-resize",
  e: "cursor-e-resize",
  se: "cursor-se-resize",
  s: "cursor-s-resize",
  sw: "cursor-sw-resize",
  w: "cursor-w-resize",
  nw: "cursor-nw-resize",
};

const POSITION: Record<ResizeDir, string> = {
  n: "top-0 left-3 right-3 h-1.5",
  ne: "top-0 right-0 w-3 h-3",
  e: "top-3 right-0 bottom-3 w-1.5",
  se: "bottom-0 right-0 w-3 h-3",
  s: "bottom-0 left-3 right-3 h-1.5",
  sw: "bottom-0 left-0 w-3 h-3",
  w: "top-3 left-0 bottom-3 w-1.5",
  nw: "top-0 left-0 w-3 h-3",
};

interface CanvasResizeHandleProps {
  dir: ResizeDir;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: () => void;
}

export function CanvasResizeHandle({
  dir,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: CanvasResizeHandleProps) {
  return (
    <div
      className={cn("absolute z-20 select-none", CURSOR[dir], POSITION[dir])}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    />
  );
}
