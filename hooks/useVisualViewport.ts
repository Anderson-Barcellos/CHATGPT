"use client";

import { useEffect } from "react";

/**
 * Acompanha o `window.visualViewport` no celular.
 *
 * No Safari do iOS o teclado não encolhe o layout viewport (100dvh continua o
 * mesmo); só o visual viewport diminui e o navegador "empurra" a página pra
 * mostrar o campo focado. Este hook grava a altura visível numa variável CSS
 * (`--gc-visual-viewport-height`), marca `data-keyboard-open` no `<html>` e
 * devolve o scroll da janela pra 0, de modo que o shell encolha junto com o
 * teclado em vez de ser deslocado.
 */

export const VISUAL_VIEWPORT_HEIGHT_VAR = "--gc-visual-viewport-height";
export const KEYBOARD_OPEN_ATTR = "data-keyboard-open";
/** Diferença mínima (px) entre a janela e o visual viewport pra considerar teclado aberto. */
export const KEYBOARD_THRESHOLD_PX = 100;

export interface VisualViewportSnapshot {
  height: number;
  offsetTop: number;
  innerHeight: number;
}

export function isKeyboardOpen(snapshot: VisualViewportSnapshot): boolean {
  return snapshot.innerHeight - snapshot.height > KEYBOARD_THRESHOLD_PX;
}

export function applyVisualViewport(
  root: HTMLElement,
  snapshot: VisualViewportSnapshot | null
): void {
  if (!snapshot) {
    root.style.removeProperty(VISUAL_VIEWPORT_HEIGHT_VAR);
    root.removeAttribute(KEYBOARD_OPEN_ATTR);
    return;
  }
  root.style.setProperty(VISUAL_VIEWPORT_HEIGHT_VAR, `${Math.round(snapshot.height)}px`);
  if (isKeyboardOpen(snapshot)) {
    root.setAttribute(KEYBOARD_OPEN_ATTR, "true");
  } else {
    root.removeAttribute(KEYBOARD_OPEN_ATTR);
  }
}

export function useVisualViewport(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const viewport = window.visualViewport;
    if (!viewport) return;

    const root = document.documentElement;
    let frame: number | null = null;

    const sync = () => {
      frame = null;
      const snapshot: VisualViewportSnapshot = {
        height: viewport.height,
        offsetTop: viewport.offsetTop,
        innerHeight: window.innerHeight,
      };
      applyVisualViewport(root, snapshot);
      if (isKeyboardOpen(snapshot) && (window.scrollY !== 0 || snapshot.offsetTop !== 0)) {
        window.scrollTo(0, 0);
      }
    };

    const schedule = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(sync);
    };

    viewport.addEventListener("resize", schedule);
    viewport.addEventListener("scroll", schedule);
    sync();

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", schedule);
      viewport.removeEventListener("scroll", schedule);
      applyVisualViewport(root, null);
    };
  }, [enabled]);
}
