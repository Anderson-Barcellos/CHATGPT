"use client";

import { useCallback, useEffect, useRef, useState, type TouchEvent, type MouseEvent } from "react";

const INTERACTIVE = "button, a, input, textarea, select, [role='button'], [contenteditable='true']";
export function isMessageInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(INTERACTIVE));
}

/** Pequenos movimentos do dedo não são rolagem; cancelamentos nunca abrem o menu. */
export function useMessageLongPress(enabled: boolean, onOpen: () => void) {
  const [pressing, setPressing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTouch = useRef(-Infinity);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const cancel = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    if (feedbackTimer.current !== null) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = null;
    timer.current = null;
    origin.current = null;
    setPressing(false);
  }, []);

  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
    if (feedbackTimer.current !== null) clearTimeout(feedbackTimer.current);
  }, []);

  const onTouchStart = useCallback((event: TouchEvent<HTMLElement>) => {
    cancel();
    lastTouch.current = Date.now();
    if (!enabled || event.touches.length !== 1 || isMessageInteractiveTarget(event.target)) return;
    const touch = event.touches[0];
    origin.current = { x: touch.clientX, y: touch.clientY };
    feedbackTimer.current = setTimeout(() => setPressing(true), 450);
    timer.current = setTimeout(() => {
      cancel();
      onOpen();
    }, 900);
  }, [cancel, enabled, onOpen]);

  const onTouchMove = useCallback((event: TouchEvent<HTMLElement>) => {
    if (!origin.current) return;
    const touch = event.touches[0];
    if (event.touches.length !== 1 || !touch ||
        Math.hypot(touch.clientX - origin.current.x, touch.clientY - origin.current.y) > 10) cancel();
  }, [cancel]);

  const onContextMenu = useCallback((event: MouseEvent<HTMLElement>) => {
    if (!enabled || isMessageInteractiveTarget(event.target)) return;
    event.preventDefault();
    // O contextmenu nativo do toque não pode antecipar o nosso temporizador.
    if (origin.current || Date.now() - lastTouch.current < 1500) return;
    cancel();
    onOpen();
  }, [cancel, enabled, onOpen]);

  return { pressing, cancel, onTouchStart, onTouchMove, onTouchEnd: cancel, onTouchCancel: cancel, onContextMenu };
}
