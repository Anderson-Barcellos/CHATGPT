import { describe, expect, it } from "vitest";
import type { StudioNotebookCell } from "@/lib/studio/notebookFormat";
import {
  buildLeadingContext,
  notebookKernelStatusLabel,
  stripAnsi,
} from "./StudioNotebook";

function cell(
  id: string,
  kind: "code" | "markdown",
  source: string
): StudioNotebookCell {
  return { id, kind, source, executionCount: null, outputs: [] };
}

describe("notebookKernelStatusLabel", () => {
  it("descreve os estados de conexão", () => {
    expect(
      notebookKernelStatusLabel({
        status: "idle",
        kernelStatus: null,
        exitReason: null,
        error: null,
      })
    ).toBe("Kernel parado");
    expect(
      notebookKernelStatusLabel({
        status: "open",
        kernelStatus: "busy",
        exitReason: null,
        error: null,
      })
    ).toBe("Executando…");
    expect(
      notebookKernelStatusLabel({
        status: "open",
        kernelStatus: "idle",
        exitReason: null,
        error: null,
      })
    ).toBe("Kernel pronto");
  });

  it("distingue as razões de encerramento e erro", () => {
    expect(
      notebookKernelStatusLabel({
        status: "closed",
        kernelStatus: null,
        exitReason: "idle",
        error: null,
      })
    ).toBe("Kernel encerrado por inatividade");
    expect(
      notebookKernelStatusLabel({
        status: "closed",
        kernelStatus: null,
        exitReason: "died",
        error: null,
      })
    ).toBe("Kernel morreu");
    expect(
      notebookKernelStatusLabel({
        status: "error",
        kernelStatus: null,
        exitReason: null,
        error: "O notebook já está aberto em outra aba.",
      })
    ).toBe("O notebook já está aberto em outra aba.");
  });
});

describe("buildLeadingContext", () => {
  it("concatena só as células de código anteriores", () => {
    const cells = [
      cell("a", "code", "import math"),
      cell("b", "markdown", "# título"),
      cell("c", "code", "x = 1"),
      cell("d", "code", "print(x)"),
    ];
    expect(buildLeadingContext(cells, "d")).toBe("import math\n\nx = 1\n\n");
    expect(buildLeadingContext(cells, "a")).toBe("");
  });
});

describe("stripAnsi", () => {
  it("remove códigos de cor de tracebacks do IPython", () => {
    expect(stripAnsi("\u001b[0;31mZeroDivisionError\u001b[0m: division")).toBe(
      "ZeroDivisionError: division"
    );
  });
});
