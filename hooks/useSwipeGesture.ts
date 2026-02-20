"use client";

import { useEffect, useRef } from "react";

interface SwipeConfig {
  edgeWidth?: number;
  threshold?: number;
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  enabled?: boolean;
}

export function useSwipeGesture({
  edgeWidth = 30,
  threshold = 50,
  onSwipeRight,
  onSwipeLeft,
  enabled = true,
}: SwipeConfig) {
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const isEdgeRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      startRef.current = { x: touch.clientX, y: touch.clientY, t: Date.now() };
      isEdgeRef.current = touch.clientX <= edgeWidth;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!startRef.current) return;

      const touch = e.changedTouches[0];
      const dx = touch.clientX - startRef.current.x;
      const dy = touch.clientY - startRef.current.y;
      const elapsed = Date.now() - startRef.current.t;

      startRef.current = null;

      // Ignore vertical-dominant movement (user is scrolling)
      if (Math.abs(dy) > Math.abs(dx)) return;

      const velocity = Math.abs(dx) / elapsed;
      const meetsThreshold = Math.abs(dx) >= threshold || velocity > 0.5;

      if (!meetsThreshold) return;

      if (dx > 0 && isEdgeRef.current) {
        onSwipeRight?.();
      } else if (dx < 0) {
        onSwipeLeft?.();
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [enabled, edgeWidth, threshold, onSwipeRight, onSwipeLeft]);
}
