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
});
