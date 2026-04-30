"use client";

import { useCallback, useRef, useState } from "react";

export type ResizeDir = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

export const RESIZE_DIRS: ResizeDir[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

const MIN_W = 420;
const MIN_H = 300;

interface ResizeStart {
  px: number;
  py: number;
  ox: number;
  oy: number;
  ow: number;
  oh: number;
  dir: ResizeDir;
}

function computeLayout(start: ResizeStart, cpx: number, cpy: number) {
  const dx = cpx - start.px;
  const dy = cpy - start.py;
  const maxW = Math.floor(window.innerWidth * 0.9);
  const maxH = Math.floor(window.innerHeight * 0.9);

  let { ox: x, oy: y, ow: w, oh: h, dir } = start;

  if (dir.includes("e")) w = Math.max(MIN_W, Math.min(maxW, w + dx));
  if (dir.includes("s")) h = Math.max(MIN_H, Math.min(maxH, h + dy));
  if (dir.includes("w")) {
    const nw = Math.max(MIN_W, Math.min(maxW, w - dx));
    x += w - nw;
    w = nw;
  }
  if (dir.includes("n")) {
    const nh = Math.max(MIN_H, Math.min(maxH, h - dy));
    y += h - nh;
    h = nh;
  }

  return { x, y, w, h };
}

export function useCanvasResize(
  position: { x: number; y: number },
  dimensions: { w: number; h: number },
  onPositionChange: (pos: { x: number; y: number }) => void,
  onDimensionsChange: (dim: { w: number; h: number }) => void,
) {
  const [liveLayout, setLiveLayout] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const startRef = useRef<ResizeStart | null>(null);
  const posRef = useRef(position);
  const dimRef = useRef(dimensions);
  posRef.current = position;
  dimRef.current = dimensions;

  const getHandlers = useCallback(
    (dir: ResizeDir) => ({
      onPointerDown(e: React.PointerEvent<HTMLElement>) {
        e.stopPropagation();
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        startRef.current = {
          px: e.clientX,
          py: e.clientY,
          ox: posRef.current.x,
          oy: posRef.current.y,
          ow: dimRef.current.w,
          oh: dimRef.current.h,
          dir,
        };
      },
      onPointerMove(e: React.PointerEvent<HTMLElement>) {
        if (!startRef.current) return;
        setLiveLayout(computeLayout(startRef.current, e.clientX, e.clientY));
      },
      onPointerUp(e: React.PointerEvent<HTMLElement>) {
        if (!startRef.current) return;
        const layout = computeLayout(startRef.current, e.clientX, e.clientY);
        onPositionChange({ x: layout.x, y: layout.y });
        onDimensionsChange({ w: layout.w, h: layout.h });
        setLiveLayout(null);
        startRef.current = null;
      },
      onPointerCancel() {
        setLiveLayout(null);
        startRef.current = null;
      },
    }),
    [onPositionChange, onDimensionsChange],
  );

  return {
    currentLayout: liveLayout ?? { ...position, ...dimensions },
    isResizing: liveLayout !== null,
    getHandlers,
  };
}
