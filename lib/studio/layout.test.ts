import { describe, expect, it } from "vitest";
import {
  STUDIO_LAYOUT_LIMITS,
  clampAssistantWidth,
  clampConsoleHeight,
  clampExplorerWidth,
  parseStudioLayout,
} from "@/lib/studio/layout";

const SHELL_WIDTH = 1400;
const WORKBENCH_HEIGHT = 800;

describe("Studio layout", () => {
  it("keeps the explorer inside its fixed limits", () => {
    expect(clampExplorerWidth(50, SHELL_WIDTH, 340)).toBe(
      STUDIO_LAYOUT_LIMITS.explorer.min
    );
    expect(clampExplorerWidth(9000, SHELL_WIDTH, 0)).toBe(
      STUDIO_LAYOUT_LIMITS.explorer.max
    );
  });

  it("never lets the explorer squeeze the editor below its minimum", () => {
    const assistantWidth = 600;
    const clamped = clampExplorerWidth(420, 1300, assistantWidth);

    expect(
      1300 - clamped - assistantWidth
    ).toBeGreaterThanOrEqual(STUDIO_LAYOUT_LIMITS.editorMin);
  });

  it("never lets the assistant squeeze the editor below its minimum", () => {
    const explorerWidth = 320;
    const clamped = clampAssistantWidth(640, 1300, explorerWidth);

    expect(
      1300 - clamped - explorerWidth
    ).toBeGreaterThanOrEqual(STUDIO_LAYOUT_LIMITS.editorMin);
  });

  it("keeps the console between its minimum and a fraction of the workbench", () => {
    expect(clampConsoleHeight(10, WORKBENCH_HEIGHT)).toBe(
      STUDIO_LAYOUT_LIMITS.console.min
    );
    expect(clampConsoleHeight(5000, WORKBENCH_HEIGHT)).toBe(
      Math.round(WORKBENCH_HEIGHT * STUDIO_LAYOUT_LIMITS.console.maxRatio)
    );
  });

  it("parses a persisted layout and drops invalid entries", () => {
    const parsed = parseStudioLayout(
      JSON.stringify({
        explorerWidth: 300,
        assistantWidth: "wide",
        consoleHeight: -5,
      })
    );

    expect(parsed).toEqual({
      explorerWidth: 300,
      assistantWidth: null,
      consoleHeight: null,
    });
  });

  it("returns an all-default layout for null or invalid JSON", () => {
    const empty = { explorerWidth: null, assistantWidth: null, consoleHeight: null };

    expect(parseStudioLayout(null)).toEqual(empty);
    expect(parseStudioLayout("{broken")).toEqual(empty);
  });
});
