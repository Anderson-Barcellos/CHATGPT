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
    expect(markup).not.toContain("-15s");
    expect(markup).not.toContain("+15s");
    expect(markup).not.toContain("Ouvir");
  });
});
