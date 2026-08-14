import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { StudioConsole } from "@/components/studio/StudioConsole";

describe("StudioConsole", () => {
  it("shows an aborted terminal state even when the run produced no entries", () => {
    const markup = renderToStaticMarkup(
      <StudioConsole
        filePath="src/index.ts"
        result={{ status: "aborted", durationMs: 12, entries: [] }}
        running={false}
        onClear={vi.fn()}
      />
    );

    expect(markup).toContain("Execução interrompida");
    expect(markup).not.toContain("Execute o arquivo para ver a saída");
  });

  it("offers a stdin field only while a run is active and accepts input", () => {
    const running = renderToStaticMarkup(
      <StudioConsole
        filePath="main.py"
        result={{ status: "completed", durationMs: 0, entries: [] }}
        running
        onClear={vi.fn()}
        onSendInput={vi.fn()}
      />
    );
    const idle = renderToStaticMarkup(
      <StudioConsole
        filePath="main.py"
        result={{ status: "completed", durationMs: 30, entries: [] }}
        running={false}
        onClear={vi.fn()}
        onSendInput={vi.fn()}
      />
    );

    expect(running).toContain("Entrada para o programa");
    expect(idle).not.toContain("Entrada para o programa");
  });
});
