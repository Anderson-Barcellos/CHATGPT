import { describe, expect, it } from "vitest";
import {
  getNextReasoningPanelOpenState,
  getReasoningThinkingContent,
} from "@/components/chat/ReasoningPanel";

describe("getNextReasoningPanelOpenState", () => {
  it("auto-opens while reasoning is thinking", () => {
    const nextOpen = getNextReasoningPanelOpenState({
      currentOpen: false,
      isThinking: true,
      previousThinking: false,
    });

    expect(nextOpen).toBe(true);
  });

  it("auto-collapses when reasoning transitions from thinking to non-thinking", () => {
    const nextOpen = getNextReasoningPanelOpenState({
      currentOpen: true,
      isThinking: false,
      previousThinking: true,
    });

    expect(nextOpen).toBe(false);
  });

  it("preserves manual user choice after stream is already terminal", () => {
    const nextOpen = getNextReasoningPanelOpenState({
      currentOpen: true,
      isThinking: false,
      previousThinking: false,
    });

    expect(nextOpen).toBe(true);
  });
});

describe("getReasoningThinkingContent", () => {
  it("prefers full reasoning text when available", () => {
    const content = getReasoningThinkingContent({
      summary: "Resumo parcial",
      full: "Raciocinio completo em andamento",
    });

    expect(content).toBe("Raciocinio completo em andamento");
  });

  it("falls back to summary while full reasoning is empty", () => {
    const content = getReasoningThinkingContent({
      summary: "Resumo em andamento",
      full: "",
    });

    expect(content).toBe("Resumo em andamento");
  });
});
