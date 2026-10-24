import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import * as PulsePanelModule from "@/components/workspace-v2/PulsePanelV2";
import type { PulseRun } from "@/lib/pulse/types";

vi.mock("@/components/chat/MiniAudioPlayer", () => ({
  MiniAudioPlayer: () => <div data-testid="shared-mini-audio-player" />,
}));

describe("Pulse audio controls", () => {
  it("uses the same single audio entry point as chat", () => {
    const PulseAudioControls = (
      PulsePanelModule as typeof PulsePanelModule & {
        PulseAudioControls?: React.ComponentType<{ run: PulseRun }>;
      }
    ).PulseAudioControls;

    expect(PulseAudioControls).toBeTypeOf("function");
    if (!PulseAudioControls) return;

    const run: PulseRun = {
      id: "pulse-run-1",
      taskId: "pulse-task-1",
      title: "Resumo diário",
      content: "Uma geração Pulse pronta para leitura.",
      citations: [],
      status: "completed",
      createdAt: "2026-07-19T12:00:00.000Z",
      updatedAt: "2026-07-19T12:00:00.000Z",
    };

    const markup = renderToStaticMarkup(<PulseAudioControls run={run} />);

    expect(markup.match(/title="Abrir player de áudio"/g)).toHaveLength(1);
    expect(markup).toContain("text-micro");
    expect(markup).not.toContain("-15s");
    expect(markup).not.toContain("+15s");
    expect(markup).not.toContain("Ouvir");
  });
});

describe("Pulse model selector", () => {
  it("oferece o 6.1 Sol como padrão, traz o 5.6 Sol de volta e não lista o Grok", () => {
    expect(PulsePanelModule.PULSE_MODEL_OPTIONS.map((option) => option.value)).toEqual([
      "gpt-6.1-sol",
      "gpt-6-astra",
      "gpt-6-luna",
      "gpt-5.6-sol",
    ]);
    expect(PulsePanelModule.PULSE_MODEL_OPTIONS[0].label).toContain("padrão");
  });

  it("rotula os dois Sol separados e mantém o rótulo histórico dos runs com Grok", () => {
    const { pulseModelLabel } = PulsePanelModule;

    expect(pulseModelLabel("gpt-6.1-sol", "medium")).toBe("Sol 6.1 · Medium");
    expect(pulseModelLabel("gpt-5.6-sol", "high")).toBe("Sol 5.6 · High");
    expect(pulseModelLabel("gpt-6-sol", "medium")).toBe("Sol · Medium");
    expect(pulseModelLabel("gpt-6-luna", "medium")).toBe("Luna · Medium");
    expect(pulseModelLabel("grok-4.7", "medium")).toBe("Grok · Medium");
  });
});
