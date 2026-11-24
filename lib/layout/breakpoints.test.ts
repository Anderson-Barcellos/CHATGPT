import { describe, expect, it } from "vitest";
import {
  CONTEXT_PANEL_DOCKED_WIDTH_PX,
  CONTEXT_EXPANDED_SIDEBAR_BREAKPOINT,
  CONTEXT_PANEL_EXPANDED_WIDTH_PX,
  CONTEXT_SIDEBAR_BREAKPOINT,
  MESSAGE_FRAME_FULL_WIDTH_PX,
  SHELL_RAIL_COMPACT_WIDTH_PX,
  SHELL_RAIL_WIDTH_PX,
  THREE_COLUMN_FULL_BREAKPOINT,
} from "@/lib/layout/breakpoints";

describe("encaixe reativo do painel operacional e trilha colapsável", () => {
  it("define o encaixe lateral em 1280px (normal) e 1440px (ampliado)", () => {
    expect(CONTEXT_PANEL_DOCKED_WIDTH_PX).toBe(600);
    expect(CONTEXT_PANEL_EXPANDED_WIDTH_PX).toBe(760);
    expect(CONTEXT_SIDEBAR_BREAKPOINT).toBe(1280);
    expect(CONTEXT_EXPANDED_SIDEBAR_BREAKPOINT).toBe(1440);
    expect(CONTEXT_EXPANDED_SIDEBAR_BREAKPOINT - CONTEXT_PANEL_EXPANDED_WIDTH_PX).toBe(
      CONTEXT_SIDEBAR_BREAKPOINT - CONTEXT_PANEL_DOCKED_WIDTH_PX
    );
  });

  it("define larguras da trilha esquerda (compacta e aberta) e corte de 3 colunas simultâneas", () => {
    expect(SHELL_RAIL_COMPACT_WIDTH_PX).toBe(52);
    expect(SHELL_RAIL_WIDTH_PX).toBe(232);
    expect(THREE_COLUMN_FULL_BREAKPOINT).toBe(1680);
    expect(MESSAGE_FRAME_FULL_WIDTH_PX).toBe(Math.ceil(Math.max(768 / 0.76, 896 / 0.88)));
  });
});

describe("harness do painel acompanha o corte", () => {
  it("usa o mesmo CONTEXT_SIDEBAR_BREAKPOINT no QA Playwright", async () => {
    const { readFileSync } = await import("node:fs");
    const harness = readFileSync(new URL("../../scripts/qa-discover-panel.mjs", import.meta.url), "utf8");
    expect(harness).toContain(`const DOCK = ${CONTEXT_SIDEBAR_BREAKPOINT};`);
  });
});
