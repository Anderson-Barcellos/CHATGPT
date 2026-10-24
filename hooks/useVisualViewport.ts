"use client";

import { useEffect } from "react";

/**
 * Acompanha o `window.visualViewport` no celular.
 *
 * No Safari do iOS o teclado não encolhe o layout viewport (100dvh continua o
 * mesmo); só o visual viewport diminui e o navegador "empurra" a página pra
 * mostrar o campo focado. Este hook grava a altura visível numa variável CSS
 * (`--gc-visual-viewport-height`), marca `data-keyboard-open` no `<html>` e
 * acompanha o deslocamento visual, sem disputar o panning nativo do Safari.
 * Zoom manual nunca é tratado como teclado e permanece livre.
 *
 * Com o teclado fechado o hook devolve a altura ao CSS (`100dvh`): no iOS 27
 * o WebKit volta a informar a altura curta depois do teclado, e travar esse
 * valor deixava uma faixa vazia embaixo da PWA. Na web app da tela inicial o
 * hook também marca `data-standalone` e mede a faixa que o WebKit deixa sem
 * pintar (`--gc-standalone-bottom-gap`), para o dock descontá-la da safe area.
 */

export const VISUAL_VIEWPORT_HEIGHT_VAR = "--gc-visual-viewport-height";
export const VISUAL_VIEWPORT_OFFSET_TOP_VAR = "--gc-visual-viewport-offset-top";
export const KEYBOARD_OPEN_ATTR = "data-keyboard-open";
export const STANDALONE_ATTR = "data-standalone";
export const STANDALONE_BOTTOM_GAP_VAR = "--gc-standalone-bottom-gap";
/** Diferença mínima (px) entre a janela e o visual viewport pra considerar teclado aberto. */
export const KEYBOARD_THRESHOLD_PX = 100;

export interface VisualViewportSnapshot {
  height: number;
  offsetTop: number;
  scrollY?: number;
  innerHeight: number;
  scale?: number;
  hasEditableFocus?: boolean;
  /** Web app aberta pelo ícone da tela inicial. */
  standalone?: boolean;
  /** Altura física da tela na orientação atual. */
  physicalHeight?: number;
  /** `document.documentElement.clientHeight`: onde o WebKit acha que a tela termina. */
  clientHeight?: number;
}

/** No iOS `screen.width/height` não giram: retrato usa o lado maior, paisagem o menor. */
export function physicalViewportHeight(
  screenWidth: number,
  screenHeight: number,
  innerWidth: number,
  innerHeight: number
): number {
  return innerWidth > innerHeight
    ? Math.min(screenWidth, screenHeight)
    : Math.max(screenWidth, screenHeight);
}

export function isKeyboardOpen(snapshot: VisualViewportSnapshot): boolean {
  return Math.abs((snapshot.scale ?? 1) - 1) < 0.05 &&
    snapshot.hasEditableFocus !== false &&
    snapshot.innerHeight - snapshot.height > KEYBOARD_THRESHOLD_PX;
}

export function applyVisualViewport(
  root: HTMLElement,
  snapshot: VisualViewportSnapshot | null
): void {
  if (snapshot?.standalone) {
    const gap = Math.max(0, Math.round((snapshot.physicalHeight ?? 0) - (snapshot.clientHeight ?? 0)));
    root.setAttribute(STANDALONE_ATTR, "");
    root.style.setProperty(STANDALONE_BOTTOM_GAP_VAR, `${gap}px`);
  } else {
    root.removeAttribute(STANDALONE_ATTR);
    root.style.removeProperty(STANDALONE_BOTTOM_GAP_VAR);
  }

  if (snapshot && isKeyboardOpen(snapshot)) {
    root.style.setProperty(VISUAL_VIEWPORT_HEIGHT_VAR, `${Math.round(snapshot.height)}px`);
    root.style.setProperty(VISUAL_VIEWPORT_OFFSET_TOP_VAR, `${Math.round(snapshot.offsetTop + (snapshot.scrollY ?? 0))}px`);
    root.setAttribute(KEYBOARD_OPEN_ATTR, "true");
    return;
  }
  root.style.removeProperty(VISUAL_VIEWPORT_HEIGHT_VAR);
  root.style.removeProperty(VISUAL_VIEWPORT_OFFSET_TOP_VAR);
  root.removeAttribute(KEYBOARD_OPEN_ATTR);
}

function isStandaloneDisplay(): boolean {
  const displayModeStandalone =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  return displayModeStandalone || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function useVisualViewport(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const viewport = window.visualViewport;
    if (!viewport) return;

    const root = document.documentElement;
    let frame: number | null = null;
    let keyboardWasOpen = false;

    const sync = () => {
      frame = null;
      const snapshot: VisualViewportSnapshot = {
        height: viewport.height,
        offsetTop: viewport.offsetTop,
        scrollY: window.scrollY,
        innerHeight: window.innerHeight,
        scale: viewport.scale,
        hasEditableFocus: keyboardWasOpen || Boolean(document.activeElement?.matches(
          "textarea, input:not([type='button']):not([type='checkbox']):not([type='radio']):not([type='range']):not([type='submit']), [contenteditable='true']"
        )),
        standalone: isStandaloneDisplay(),
        physicalHeight: physicalViewportHeight(
          window.screen.width,
          window.screen.height,
          window.innerWidth,
          window.innerHeight
        ),
        clientHeight: root.clientHeight,
      };
      applyVisualViewport(root, snapshot);
      const keyboardOpen = isKeyboardOpen(snapshot);
      // Só desfaz o pan residual ao fechar o teclado; nunca durante zoom ou digitação.
      if (keyboardWasOpen && !keyboardOpen && Math.abs((snapshot.scale ?? 1) - 1) < 0.05 && window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
      keyboardWasOpen = keyboardOpen;
    };

    const schedule = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(sync);
    };

    viewport.addEventListener("resize", schedule);
    viewport.addEventListener("scroll", schedule);
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    sync();

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", schedule);
      viewport.removeEventListener("scroll", schedule);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
      applyVisualViewport(root, null);
    };
  }, [enabled]);
}
