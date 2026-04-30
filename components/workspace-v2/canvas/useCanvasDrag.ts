"use client";

import { useCallback, useRef, useState } from "react";

function clampPos(x: number, y: number, w: number, h: number) {
  return {
    x: Math.max(-(w - 80), Math.min(window.innerWidth - 80, x)),
    y: Math.max(0, Math.min(window.innerHeight - 40, y)),
  };
}

export function useCanvasDrag(
  position: { x: number; y: number },
  dimensions: { w: number; h: number },
  onPositionChange: (pos: { x: number; y: number }) => void,
) {
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const startRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const dimRef = useRef(dimensions);
  dimRef.current = dimensions;

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      startRef.current = { px: e.clientX, py: e.clientY, ox: position.x, oy: position.y };
    },
    [position.x, position.y],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!startRef.current) return;
    const { w, h } = dimRef.current;
    setDragPos(
      clampPos(
        startRef.current.ox + (e.clientX - startRef.current.px),
        startRef.current.oy + (e.clientY - startRef.current.py),
        w,
        h,
      ),
    );
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!startRef.current) return;
      const { w, h } = dimRef.current;
      const clamped = clampPos(
        startRef.current.ox + (e.clientX - startRef.current.px),
        startRef.current.oy + (e.clientY - startRef.current.py),
        w,
        h,
      );
      onPositionChange(clamped);
      setDragPos(null);
      startRef.current = null;
    },
    [onPositionChange],
  );

  const onPointerCancel = useCallback(() => {
    setDragPos(null);
    startRef.current = null;
  }, []);

  return {
    currentPos: dragPos ?? position,
    isDragging: dragPos !== null,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
