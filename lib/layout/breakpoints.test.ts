import { describe, expect, it } from "vitest";
import {
  CONTEXT_PANEL_DOCKED_WIDTH_PX,
  CONTEXT_EXPANDED_SIDEBAR_BREAKPOINT,
  CONTEXT_PANEL_EXPANDED_WIDTH_PX,
  CONTEXT_SIDEBAR_BREAKPOINT,
  MESSAGE_FRAME_FULL_WIDTH_PX,
  SHELL_CHROME_PX,
  SHELL_RAIL_WIDTH_PX,
  THREAD_PADDING_PX,
} from "@/lib/layout/breakpoints";

describe("encaixe do painel operacional", () => {
  it("reserva o painel ampliado antes de encaixar sem comprimir o chat", () => {
    expect(CONTEXT_PANEL_EXPANDED_WIDTH_PX).toBe(760);
    expect(CONTEXT_EXPANDED_SIDEBAR_BREAKPOINT).toBe(1933);
    expect(CONTEXT_EXPANDED_SIDEBAR_BREAKPOINT - CONTEXT_PANEL_EXPANDED_WIDTH_PX).toBe(CONTEXT_SIDEBAR_BREAKPOINT - CONTEXT_PANEL_DOCKED_WIDTH_PX);
  });
  it("só encaixa quando o quadro de mensagens mantém a largura máxima ao lado do painel", () => {
    expect(SHELL_RAIL_WIDTH_PX).toBe(232);
    expect(CONTEXT_PANEL_DOCKED_WIDTH_PX).toBe(600);
    // Balão do usuário: min(76%, 42rem) → 672 px exigem 884,2 px de área útil.
    expect(MESSAGE_FRAME_FULL_WIDTH_PX).toBe(Math.ceil((42 * 16) / 0.76));
    expect(CONTEXT_SIDEBAR_BREAKPOINT).toBe(
      SHELL_RAIL_WIDTH_PX + CONTEXT_PANEL_DOCKED_WIDTH_PX + MESSAGE_FRAME_FULL_WIDTH_PX + THREAD_PADDING_PX + SHELL_CHROME_PX
    );
    expect(CONTEXT_SIDEBAR_BREAKPOINT).toBe(1773);
  });
});

describe("harness do painel acompanha o corte", () => {
  it("usa o mesmo CONTEXT_SIDEBAR_BREAKPOINT no QA Playwright", async () => {
    const { readFileSync } = await import("node:fs");
    const harness = readFileSync(new URL("../../scripts/qa-discover-panel.mjs", import.meta.url), "utf8");
    expect(harness).toContain(`const DOCK = ${CONTEXT_SIDEBAR_BREAKPOINT};`);
  });
});
