"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  STUDIO_LAYOUT_STORAGE_KEY,
  clampAssistantWidth,
  clampConsoleHeight,
  clampExplorerWidth,
  parseStudioLayout,
  type StudioLayout,
} from "@/lib/studio/layout";

export type StudioLayoutPanel = "explorer" | "assistant" | "console";

const PANEL_VARS: Record<StudioLayoutPanel, string> = {
  explorer: "--studio-explorer-w",
  assistant: "--studio-assistant-w",
  console: "--studio-console-h",
};

const PANEL_KEYS: Record<StudioLayoutPanel, keyof StudioLayout> = {
  explorer: "explorerWidth",
  assistant: "assistantWidth",
  console: "consoleHeight",
};

const KEYBOARD_STEP_PX = 16;

// Abaixo deste ponto o CSS colapsa o explorer em rail de ícones; os tamanhos
// customizados só valem no layout largo de desktop.
const WIDE_LAYOUT_QUERY = "(min-width: 1121px)";

function readGridColumns(shell: HTMLElement): number[] {
  return getComputedStyle(shell)
    .gridTemplateColumns.split(" ")
    .map((token) => parseFloat(token))
    .filter((value) => Number.isFinite(value));
}

interface UseStudioLayoutOptions {
  shellRef: React.RefObject<HTMLElement | null>;
  workbenchRef: React.RefObject<HTMLElement | null>;
}

export function useStudioLayout({
  shellRef,
  workbenchRef,
}: UseStudioLayoutOptions) {
  const layoutRef = useRef<StudioLayout>({
    explorerWidth: null,
    assistantWidth: null,
    consoleHeight: null,
  });
  const [wide, setWide] = useState(false);
  const wideRef = useRef(false);

  const applyVars = useCallback(() => {
    const shell = shellRef.current;
    if (!shell) return;
    for (const panel of Object.keys(PANEL_VARS) as StudioLayoutPanel[]) {
      const value = layoutRef.current[PANEL_KEYS[panel]];
      if (wideRef.current && value !== null) {
        shell.style.setProperty(PANEL_VARS[panel], `${value}px`);
      } else {
        shell.style.removeProperty(PANEL_VARS[panel]);
      }
    }
  }, [shellRef]);

  const persist = useCallback(() => {
    try {
      window.localStorage.setItem(
        STUDIO_LAYOUT_STORAGE_KEY,
        JSON.stringify(layoutRef.current)
      );
    } catch {
      // Sem quota/storage: o layout segue válido só nesta sessão.
    }
  }, []);

  useEffect(() => {
    layoutRef.current = parseStudioLayout(
      window.localStorage.getItem(STUDIO_LAYOUT_STORAGE_KEY)
    );

    const media = window.matchMedia(WIDE_LAYOUT_QUERY);
    const syncWide = () => {
      wideRef.current = media.matches;
      setWide(media.matches);
      applyVars();
    };
    syncWide();
    media.addEventListener("change", syncWide);
    return () => media.removeEventListener("change", syncWide);
  }, [applyVars]);

  const setPanelSize = useCallback(
    (panel: StudioLayoutPanel, rawValue: number) => {
      const shell = shellRef.current;
      const workbench = workbenchRef.current;
      if (!shell || !workbench) return;

      const shellWidth = shell.getBoundingClientRect().width;
      const columns = readGridColumns(shell);
      const explorerWidth = columns[0] ?? 0;
      const assistantWidth = columns.length >= 3 ? columns[columns.length - 1] : 0;

      let value: number;
      if (panel === "explorer") {
        value = clampExplorerWidth(rawValue, shellWidth, assistantWidth);
      } else if (panel === "assistant") {
        value = clampAssistantWidth(rawValue, shellWidth, explorerWidth);
      } else {
        value = clampConsoleHeight(
          rawValue,
          workbench.getBoundingClientRect().height
        );
      }

      layoutRef.current = { ...layoutRef.current, [PANEL_KEYS[panel]]: value };
      applyVars();
    },
    [applyVars, shellRef, workbenchRef]
  );

  const resetPanel = useCallback(
    (panel: StudioLayoutPanel) => {
      layoutRef.current = { ...layoutRef.current, [PANEL_KEYS[panel]]: null };
      applyVars();
      persist();
    },
    [applyVars, persist]
  );

  const startDrag = useCallback(
    (panel: StudioLayoutPanel, event: React.PointerEvent<HTMLElement>) => {
      const shell = shellRef.current;
      const workbench = workbenchRef.current;
      if (!shell || !workbench) return;
      event.preventDefault();

      const handle = event.currentTarget;
      handle.setPointerCapture(event.pointerId);
      handle.setAttribute("data-dragging", "true");
      const shellRect = shell.getBoundingClientRect();
      const workbenchRect = workbench.getBoundingClientRect();

      const onMove = (move: PointerEvent) => {
        if (panel === "explorer") {
          setPanelSize(panel, move.clientX - shellRect.left);
        } else if (panel === "assistant") {
          setPanelSize(panel, shellRect.right - move.clientX);
        } else {
          setPanelSize(panel, workbenchRect.bottom - move.clientY);
        }
      };
      const onUp = () => {
        handle.removeAttribute("data-dragging");
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);
        persist();
      };

      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onUp);
    },
    [persist, setPanelSize, shellRef, workbenchRef]
  );

  const nudgePanel = useCallback(
    (panel: StudioLayoutPanel, event: React.KeyboardEvent<HTMLElement>) => {
      const shell = shellRef.current;
      const workbench = workbenchRef.current;
      if (!shell || !workbench) return;

      const horizontal = panel !== "console";
      const decreaseKey = horizontal ? "ArrowLeft" : "ArrowDown";
      const increaseKey = horizontal ? "ArrowRight" : "ArrowUp";
      if (event.key !== decreaseKey && event.key !== increaseKey) return;
      event.preventDefault();

      let direction = event.key === increaseKey ? 1 : -1;
      // O assistente cresce para a esquerda: seta-esquerda o alarga.
      if (panel === "assistant") direction = -direction;

      const columns = readGridColumns(shell);
      const current =
        panel === "explorer"
          ? columns[0] ?? 0
          : panel === "assistant"
            ? columns[columns.length - 1] ?? 0
            : (getComputedStyle(workbench)
                .gridTemplateRows.split(" ")
                .map((token) => parseFloat(token))
                .filter((value) => Number.isFinite(value))
                .at(-1) ?? 0);

      setPanelSize(panel, current + direction * KEYBOARD_STEP_PX);
      persist();
    },
    [persist, setPanelSize, shellRef, workbenchRef]
  );

  return { wide, startDrag, resetPanel, nudgePanel };
}
