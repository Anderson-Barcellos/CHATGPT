import { describe, expect, it } from "vitest";
import {
  addNotebookCell,
  applyNotebookEventToDocument,
  clearNotebookCellOutputs,
  createEmptyNotebook,
  moveNotebookCell,
  parseNotebook,
  removeNotebookCell,
  serializeNotebook,
  updateNotebookCellSource,
} from "./notebookFormat";

const MINIMAL_NOTEBOOK = JSON.stringify({
  nbformat: 4,
  nbformat_minor: 5,
  metadata: {},
  cells: [
    {
      id: "cell-a",
      cell_type: "code",
      source: ["x = 21 * 2\n", "print(x)"],
      metadata: {},
      execution_count: 3,
      outputs: [
        { output_type: "stream", name: "stdout", text: ["42\n"] },
        {
          output_type: "execute_result",
          execution_count: 3,
          data: { "text/plain": ["42"] },
          metadata: {},
        },
        {
          output_type: "display_data",
          data: { "image/png": "aGVsbG8=", "text/plain": ["<Figure>"] },
          metadata: {},
        },
        {
          output_type: "error",
          ename: "ValueError",
          evalue: "nope",
          traceback: ["tb1", "tb2"],
        },
      ],
    },
    {
      id: "cell-b",
      cell_type: "markdown",
      source: "# Título",
      metadata: {},
    },
  ],
});

describe("parseNotebook", () => {
  it("lê células code/markdown juntando source em string", () => {
    const parsed = parseNotebook(MINIMAL_NOTEBOOK);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.notebook.cells).toHaveLength(2);
    const [code, markdown] = parsed.notebook.cells;
    expect(code).toMatchObject({
      id: "cell-a",
      kind: "code",
      source: "x = 21 * 2\nprint(x)",
      executionCount: 3,
    });
    expect(markdown).toMatchObject({
      id: "cell-b",
      kind: "markdown",
      source: "# Título",
      executionCount: null,
      outputs: [],
    });
  });

  it("traduz os quatro tipos de output pro modelo interno", () => {
    const parsed = parseNotebook(MINIMAL_NOTEBOOK);
    if (!parsed.ok) throw new Error("parse");
    const outputs = parsed.notebook.cells[0]!.outputs;
    expect(outputs).toEqual([
      { kind: "stream", name: "stdout", text: "42\n" },
      {
        kind: "execute_result",
        data: { "text/plain": "42" },
        executionCount: 3,
      },
      {
        kind: "display_data",
        data: { "image/png": "aGVsbG8=", "text/plain": "<Figure>" },
      },
      { kind: "error", ename: "ValueError", evalue: "nope", traceback: ["tb1", "tb2"] },
    ]);
  });

  it("rejeita JSON inválido e nbformat diferente de 4", () => {
    expect(parseNotebook("{nada").ok).toBe(false);
    expect(
      parseNotebook(JSON.stringify({ nbformat: 3, cells: [] })).ok
    ).toBe(false);
    expect(parseNotebook(JSON.stringify({ nbformat: 4 })).ok).toBe(false);
  });

  it("gera ids únicos pra células sem id", () => {
    const raw = JSON.stringify({
      nbformat: 4,
      nbformat_minor: 4,
      metadata: {},
      cells: [
        { cell_type: "code", source: "1", metadata: {}, outputs: [] },
        { cell_type: "code", source: "2", metadata: {}, outputs: [] },
      ],
    });
    const parsed = parseNotebook(raw);
    if (!parsed.ok) throw new Error("parse");
    const [a, b] = parsed.notebook.cells;
    expect(a!.id.length).toBeGreaterThan(0);
    expect(b!.id.length).toBeGreaterThan(0);
    expect(a!.id).not.toBe(b!.id);
  });
});

describe("serializeNotebook", () => {
  it("escreve nbformat 4.5 com kernelspec python e roundtrip estável", () => {
    const parsed = parseNotebook(MINIMAL_NOTEBOOK);
    if (!parsed.ok) throw new Error("parse");

    const serialized = serializeNotebook(parsed.notebook);
    const asJson = JSON.parse(serialized);
    expect(asJson.nbformat).toBe(4);
    expect(asJson.nbformat_minor).toBe(5);
    expect(asJson.metadata.kernelspec.language).toBe("python");
    expect(asJson.cells[0].id).toBe("cell-a");
    expect(asJson.cells[1].cell_type).toBe("markdown");
    expect(asJson.cells[1].outputs).toBeUndefined();

    const reparsed = parseNotebook(serialized);
    expect(reparsed.ok).toBe(true);
    if (!reparsed.ok) return;
    expect(reparsed.notebook).toEqual(parsed.notebook);
  });
});

describe("operações de documento", () => {
  function baseDocument() {
    const parsed = parseNotebook(MINIMAL_NOTEBOOK);
    if (!parsed.ok) throw new Error("parse");
    return parsed.notebook;
  }

  it("addNotebookCell insere depois da célula indicada com id novo", () => {
    const document = baseDocument();
    const next = addNotebookCell(document, "markdown", "cell-a");
    expect(next.cells).toHaveLength(3);
    expect(next.cells[1]!.kind).toBe("markdown");
    expect(next.cells[1]!.id).not.toBe("cell-a");
    expect(next.cells[2]!.id).toBe("cell-b");
    expect(document.cells).toHaveLength(2);
  });

  it("addNotebookCell sem âncora anexa no fim", () => {
    const next = addNotebookCell(baseDocument(), "code");
    expect(next.cells).toHaveLength(3);
    expect(next.cells[2]!.kind).toBe("code");
  });

  it("removeNotebookCell tira a célula e updateNotebookCellSource troca o texto", () => {
    const document = baseDocument();
    expect(removeNotebookCell(document, "cell-b").cells).toHaveLength(1);
    const updated = updateNotebookCellSource(document, "cell-a", "y = 1");
    expect(updated.cells[0]!.source).toBe("y = 1");
  });

  it("moveNotebookCell troca a célula com a vizinha na direção pedida", () => {
    const document = baseDocument();
    const up = moveNotebookCell(document, "cell-b", "up");
    expect(up.cells.map(({ id }) => id)).toEqual(["cell-b", "cell-a"]);
    const down = moveNotebookCell(document, "cell-a", "down");
    expect(down.cells.map(({ id }) => id)).toEqual(["cell-b", "cell-a"]);
    expect(document.cells.map(({ id }) => id)).toEqual(["cell-a", "cell-b"]);
  });

  it("moveNotebookCell é no-op nas bordas e com id desconhecido", () => {
    const document = baseDocument();
    expect(moveNotebookCell(document, "cell-a", "up")).toBe(document);
    expect(moveNotebookCell(document, "cell-b", "down")).toBe(document);
    expect(moveNotebookCell(document, "cell-x", "up")).toBe(document);
  });

  it("clearNotebookCellOutputs limpa outputs preservando o resto", () => {
    const cleared = clearNotebookCellOutputs(baseDocument(), "cell-a");
    expect(cleared.cells[0]!.outputs).toEqual([]);
    expect(cleared.cells[0]!.source).toContain("x = 21");
  });

  it("applyNotebookEventToDocument acumula outputs e fecha com executionCount", () => {
    let document = clearNotebookCellOutputs(baseDocument(), "cell-a");
    document = applyNotebookEventToDocument(document, {
      type: "cell_output",
      cellId: "cell-a",
      output: { kind: "stream", name: "stdout", text: "oi\n" },
    });
    document = applyNotebookEventToDocument(document, {
      type: "cell_done",
      cellId: "cell-a",
      status: "ok",
      executionCount: 7,
    });
    expect(document.cells[0]!.outputs).toEqual([
      { kind: "stream", name: "stdout", text: "oi\n" },
    ]);
    expect(document.cells[0]!.executionCount).toBe(7);

    const untouched = applyNotebookEventToDocument(document, {
      type: "kernel_status",
      status: "idle",
    });
    expect(untouched).toBe(document);
  });
});

describe("createEmptyNotebook", () => {
  it("nasce com uma célula de código vazia", () => {
    const notebook = createEmptyNotebook();
    expect(notebook.cells).toHaveLength(1);
    expect(notebook.cells[0]).toMatchObject({
      kind: "code",
      source: "",
      executionCount: null,
      outputs: [],
    });
  });
});
