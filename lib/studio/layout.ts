export interface StudioLayout {
  explorerWidth: number | null;
  assistantWidth: number | null;
  consoleHeight: number | null;
}

export const STUDIO_LAYOUT_STORAGE_KEY = "gaucho-studio:layout:v1";

// Limites em px CSS; null em qualquer eixo significa "usar o padrão do CSS".
export const STUDIO_LAYOUT_LIMITS = {
  explorer: { min: 180, max: 420 },
  assistant: { min: 280, max: 640 },
  console: { min: 110, maxRatio: 0.65 },
  editorMin: 460,
} as const;

function clampWithEditor(
  value: number,
  min: number,
  max: number,
  shellWidth: number,
  otherWidth: number
): number {
  const editorCap = shellWidth - otherWidth - STUDIO_LAYOUT_LIMITS.editorMin;
  return Math.round(Math.min(Math.max(value, min), Math.max(min, Math.min(max, editorCap))));
}

export function clampExplorerWidth(
  value: number,
  shellWidth: number,
  assistantWidth: number
): number {
  const { min, max } = STUDIO_LAYOUT_LIMITS.explorer;
  return clampWithEditor(value, min, max, shellWidth, assistantWidth);
}

export function clampAssistantWidth(
  value: number,
  shellWidth: number,
  explorerWidth: number
): number {
  const { min, max } = STUDIO_LAYOUT_LIMITS.assistant;
  return clampWithEditor(value, min, max, shellWidth, explorerWidth);
}

export function clampConsoleHeight(
  value: number,
  workbenchHeight: number
): number {
  const { min, maxRatio } = STUDIO_LAYOUT_LIMITS.console;
  const max = Math.max(min, Math.round(workbenchHeight * maxRatio));
  return Math.round(Math.min(Math.max(value, min), max));
}

function normalizeEntry(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : null;
}

export function parseStudioLayout(raw: string | null): StudioLayout {
  const empty: StudioLayout = {
    explorerWidth: null,
    assistantWidth: null,
    consoleHeight: null,
  };
  if (!raw) return empty;

  try {
    const candidate = JSON.parse(raw) as Partial<Record<keyof StudioLayout, unknown>>;
    return {
      explorerWidth: normalizeEntry(candidate.explorerWidth),
      assistantWidth: normalizeEntry(candidate.assistantWidth),
      consoleHeight: normalizeEntry(candidate.consoleHeight),
    };
  } catch {
    return empty;
  }
}
