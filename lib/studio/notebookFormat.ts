import type {
  StudioNotebookEvent,
  StudioNotebookOutput,
} from "@/lib/studio/workspaceServerProtocol";

export interface StudioNotebookCell {
  id: string;
  kind: "code" | "markdown";
  source: string;
  executionCount: number | null;
  outputs: StudioNotebookOutput[];
}

export interface StudioNotebookDocument {
  cells: StudioNotebookCell[];
}

export type ParseNotebookResult =
  | { ok: true; notebook: StudioNotebookDocument }
  | { ok: false; error: string };

function joinSource(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return raw.filter((part) => typeof part === "string").join("");
  }
  return "";
}

function joinDataBundle(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const data: Record<string, string> = {};
  for (const [mime, value] of Object.entries(raw as Record<string, unknown>)) {
    data[mime] = joinSource(value);
  }
  return data;
}

function parseOutput(raw: unknown): StudioNotebookOutput | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const output = raw as Record<string, unknown>;

  switch (output.output_type) {
    case "stream":
      return {
        kind: "stream",
        name: output.name === "stderr" ? "stderr" : "stdout",
        text: joinSource(output.text),
      };
    case "execute_result":
      return {
        kind: "execute_result",
        data: joinDataBundle(output.data),
        executionCount:
          typeof output.execution_count === "number"
            ? output.execution_count
            : null,
      };
    case "display_data":
      return { kind: "display_data", data: joinDataBundle(output.data) };
    case "error":
      return {
        kind: "error",
        ename: typeof output.ename === "string" ? output.ename : "",
        evalue: typeof output.evalue === "string" ? output.evalue : "",
        traceback: Array.isArray(output.traceback)
          ? output.traceback.filter(
              (line): line is string => typeof line === "string"
            )
          : [],
      };
    default:
      return null;
  }
}

function generateCellId(): string {
  return `cell-${Math.random().toString(36).slice(2, 10)}`;
}

export function parseNotebook(raw: string): ParseNotebookResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "O arquivo não é um JSON válido." };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "O arquivo não é um notebook nbformat." };
  }
  const document = parsed as Record<string, unknown>;
  if (document.nbformat !== 4) {
    return { ok: false, error: "Só notebooks nbformat v4 são suportados." };
  }
  if (!Array.isArray(document.cells)) {
    return { ok: false, error: "O notebook não tem lista de células." };
  }

  const usedIds = new Set<string>();
  const cells: StudioNotebookCell[] = [];
  for (const rawCell of document.cells) {
    if (!rawCell || typeof rawCell !== "object" || Array.isArray(rawCell)) {
      continue;
    }
    const cell = rawCell as Record<string, unknown>;
    const kind = cell.cell_type === "markdown" ? "markdown" : "code";

    let id = typeof cell.id === "string" && cell.id.length > 0 ? cell.id : "";
    while (id.length === 0 || usedIds.has(id)) {
      id = generateCellId();
    }
    usedIds.add(id);

    const outputs: StudioNotebookOutput[] = [];
    if (kind === "code" && Array.isArray(cell.outputs)) {
      for (const rawOutput of cell.outputs) {
        const output = parseOutput(rawOutput);
        if (output) outputs.push(output);
      }
    }

    cells.push({
      id,
      kind,
      source: joinSource(cell.source),
      executionCount:
        kind === "code" && typeof cell.execution_count === "number"
          ? cell.execution_count
          : null,
      outputs,
    });
  }

  return { ok: true, notebook: { cells } };
}

function serializeOutput(output: StudioNotebookOutput): Record<string, unknown> {
  switch (output.kind) {
    case "stream":
      return { output_type: "stream", name: output.name, text: output.text };
    case "execute_result":
      return {
        output_type: "execute_result",
        execution_count: output.executionCount,
        data: output.data,
        metadata: {},
      };
    case "display_data":
      return { output_type: "display_data", data: output.data, metadata: {} };
    case "error":
      return {
        output_type: "error",
        ename: output.ename,
        evalue: output.evalue,
        traceback: output.traceback,
      };
  }
}

export function serializeNotebook(notebook: StudioNotebookDocument): string {
  const cells = notebook.cells.map((cell) => {
    if (cell.kind === "markdown") {
      return {
        id: cell.id,
        cell_type: "markdown",
        metadata: {},
        source: cell.source,
      };
    }
    return {
      id: cell.id,
      cell_type: "code",
      metadata: {},
      source: cell.source,
      execution_count: cell.executionCount,
      outputs: cell.outputs.map(serializeOutput),
    };
  });

  return `${JSON.stringify(
    {
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {
        kernelspec: {
          display_name: "Python 3 (Gaucho Studio)",
          language: "python",
          name: "python3",
        },
        language_info: { name: "python" },
      },
      cells,
    },
    null,
    1
  )}\n`;
}

export function createNotebookCell(
  kind: "code" | "markdown"
): StudioNotebookCell {
  return {
    id: generateCellId(),
    kind,
    source: "",
    executionCount: null,
    outputs: [],
  };
}

export function insertNotebookCell(
  notebook: StudioNotebookDocument,
  cell: StudioNotebookCell,
  afterCellId?: string
): StudioNotebookDocument {
  const anchor = afterCellId
    ? notebook.cells.findIndex(({ id }) => id === afterCellId)
    : -1;
  const cells = [...notebook.cells];
  cells.splice(anchor === -1 ? cells.length : anchor + 1, 0, cell);
  return { cells };
}

export function addNotebookCell(
  notebook: StudioNotebookDocument,
  kind: "code" | "markdown",
  afterCellId?: string
): StudioNotebookDocument {
  return insertNotebookCell(notebook, createNotebookCell(kind), afterCellId);
}

export function moveNotebookCell(
  notebook: StudioNotebookDocument,
  cellId: string,
  direction: "up" | "down"
): StudioNotebookDocument {
  const index = notebook.cells.findIndex(({ id }) => id === cellId);
  if (index === -1) return notebook;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= notebook.cells.length) return notebook;
  const cells = [...notebook.cells];
  const [cell] = cells.splice(index, 1);
  cells.splice(target, 0, cell as StudioNotebookCell);
  return { cells };
}

export function removeNotebookCell(
  notebook: StudioNotebookDocument,
  cellId: string
): StudioNotebookDocument {
  return { cells: notebook.cells.filter(({ id }) => id !== cellId) };
}

function patchCell(
  notebook: StudioNotebookDocument,
  cellId: string,
  patch: (cell: StudioNotebookCell) => StudioNotebookCell
): StudioNotebookDocument {
  let changed = false;
  const cells = notebook.cells.map((cell) => {
    if (cell.id !== cellId) return cell;
    changed = true;
    return patch(cell);
  });
  return changed ? { cells } : notebook;
}

export function updateNotebookCellSource(
  notebook: StudioNotebookDocument,
  cellId: string,
  source: string
): StudioNotebookDocument {
  return patchCell(notebook, cellId, (cell) => ({ ...cell, source }));
}

export function clearNotebookCellOutputs(
  notebook: StudioNotebookDocument,
  cellId: string
): StudioNotebookDocument {
  return patchCell(notebook, cellId, (cell) => ({ ...cell, outputs: [] }));
}

export function applyNotebookEventToDocument(
  notebook: StudioNotebookDocument,
  event: StudioNotebookEvent
): StudioNotebookDocument {
  if (event.type === "cell_output") {
    return patchCell(notebook, event.cellId, (cell) => ({
      ...cell,
      outputs: [...cell.outputs, event.output],
    }));
  }
  if (event.type === "cell_done") {
    return patchCell(notebook, event.cellId, (cell) => ({
      ...cell,
      executionCount: event.executionCount ?? cell.executionCount,
    }));
  }
  return notebook;
}

export function createEmptyNotebook(): StudioNotebookDocument {
  return {
    cells: [
      {
        id: generateCellId(),
        kind: "code",
        source: "",
        executionCount: null,
        outputs: [],
      },
    ],
  };
}
