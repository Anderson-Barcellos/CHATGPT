"use client";

import dynamic from "next/dynamic";
import {
  ChevronDown,
  ChevronUp,
  FastForward,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useTheme } from "next-themes";
import type { Monaco, OnMount } from "@monaco-editor/react";
import { StudioMarkdownPreview } from "@/components/studio/StudioMarkdownPreview";
import { registerMonacoThemes } from "@/lib/monaco/theme";
import type { StudioAutocompleteStatus } from "@/lib/studio/autocomplete";
import {
  registerStudioAutocompleteProvider,
  type StudioAutocompleteProviderHandle,
} from "@/lib/studio/autocompleteProvider";
import {
  createNotebookClientController,
  type StudioNotebookClientController,
  type StudioNotebookClientState,
} from "@/lib/studio/notebookClient";
import {
  addNotebookCell,
  applyNotebookEventToDocument,
  clearNotebookCellOutputs,
  createEmptyNotebook,
  createNotebookCell,
  insertNotebookCell,
  moveNotebookCell,
  parseNotebook,
  removeNotebookCell,
  serializeNotebook,
  updateNotebookCellSource,
  type StudioNotebookCell,
  type StudioNotebookDocument,
} from "@/lib/studio/notebookFormat";
import { parseApiErrorResponse } from "@/lib/api/errors";
import {
  consumeStudioAssistantStream,
  StudioAssistantStreamInterruptedError,
} from "@/lib/studio/assistantStream";
import { extractPythonCodeBlock } from "@/lib/studio/notebookAssist";
import {
  latexToMarkdown,
  selectNotebookOutputView,
} from "@/lib/studio/notebookOutputView";
import { sanitizeNotebookHtml } from "@/lib/studio/sanitizeNotebookHtml";
import { apiUrl } from "@/lib/utils";
import type {
  StudioFile,
} from "@/lib/studio/types";
import type { StudioNotebookOutput } from "@/lib/studio/workspaceServerProtocol";
import styles from "@/components/studio/GauchoStudioShell.module.css";

const MonacoEditor = dynamic(
  async () => {
    const [reactMonaco, monaco] = await Promise.all([
      import("@monaco-editor/react"),
      import("monaco-editor"),
    ]);
    reactMonaco.loader.config({ monaco });
    return reactMonaco.Editor;
  },
  {
    ssr: false,
    loading: () => <div className={styles.editorLoading} />,
  }
);

const CELL_MIN_HEIGHT_PX = 42;
const CELL_MAX_HEIGHT_PX = 420;

const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, "");
}

export function notebookKernelStatusLabel(
  state: StudioNotebookClientState
): string {
  if (state.status === "idle") return "Kernel parado";
  if (state.status === "connecting") return "Iniciando kernel…";
  if (state.status === "error") {
    return state.error ?? "Falha na conexão com o kernel";
  }
  if (state.status === "closed") {
    if (state.exitReason === "idle") {
      return "Kernel encerrado por inatividade";
    }
    if (state.exitReason === "died") return "Kernel morreu";
    return "Kernel encerrado";
  }
  if (state.kernelStatus === "busy") return "Executando…";
  if (state.kernelStatus === "starting") return "Iniciando kernel…";
  return "Kernel pronto";
}

export function formatCellDuration(ms: number): string {
  if (ms < 60_000) {
    const seconds = Math.floor(ms / 100) / 10;
    return `${seconds.toFixed(1).replace(".", ",")}s`;
  }
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}min ${seconds}s`;
}

export function buildLeadingContext(
  cells: StudioNotebookCell[],
  cellId: string
): string {
  const parts: string[] = [];
  for (const cell of cells) {
    if (cell.id === cellId) break;
    if (cell.kind === "code" && cell.source.length > 0) {
      parts.push(cell.source);
    }
  }
  return parts.length > 0 ? `${parts.join("\n\n")}\n\n` : "";
}

function parseOrCreate(content: string): StudioNotebookDocument {
  if (content.trim().length === 0) return createEmptyNotebook();
  const parsed = parseNotebook(content);
  return parsed.ok ? parsed.notebook : createEmptyNotebook();
}

function configureMonaco(monaco: Monaco) {
  registerMonacoThemes(monaco);
}

interface NotebookCellEditorProps {
  cell: StudioNotebookCell;
  autocompleteEnabled: boolean;
  leadingContext: string;
  onChange: (source: string) => void;
  onRun?: () => void;
  onRunAndAdvance?: () => void;
  onRunAndInsertBelow?: () => void;
  onFocus?: () => void;
  focusToken?: number;
  onAutocompleteStatusChange?: (status: StudioAutocompleteStatus) => void;
  notebookPath: string;
}

function NotebookCellEditor({
  cell,
  autocompleteEnabled,
  leadingContext,
  onChange,
  onRun,
  onRunAndAdvance,
  onRunAndInsertBelow,
  onFocus,
  focusToken = 0,
  onAutocompleteStatusChange,
  notebookPath,
}: NotebookCellEditorProps) {
  const { resolvedTheme } = useTheme();
  const [height, setHeight] = useState(CELL_MIN_HEIGHT_PX);
  const autocompleteRef = useRef<StudioAutocompleteProviderHandle | null>(null);
  const autocompleteEnabledRef = useRef(autocompleteEnabled);
  const leadingContextRef = useRef(leadingContext);
  const runRef = useRef(onRun);
  const advanceRef = useRef(onRunAndAdvance);
  const insertBelowRef = useRef(onRunAndInsertBelow);
  const focusRef = useRef(onFocus);
  const statusRef = useRef(onAutocompleteStatusChange);
  const pathRef = useRef(notebookPath);
  const instanceRef = useRef<Parameters<OnMount>[0] | null>(null);

  useEffect(() => {
    autocompleteEnabledRef.current = autocompleteEnabled;
    leadingContextRef.current = leadingContext;
    runRef.current = onRun;
    advanceRef.current = onRunAndAdvance;
    insertBelowRef.current = onRunAndInsertBelow;
    focusRef.current = onFocus;
    statusRef.current = onAutocompleteStatusChange;
    pathRef.current = notebookPath;
  });

  const handleMount = useCallback<OnMount>((instance, monaco) => {
    autocompleteRef.current?.dispose();
    instanceRef.current = instance;
    const desktopQuery = window.matchMedia(
      "(min-width: 861px) and (pointer: fine)"
    );
    autocompleteRef.current = registerStudioAutocompleteProvider({
      monaco,
      editor: instance,
      isEnabled: () => autocompleteEnabledRef.current,
      isDesktop: () => desktopQuery.matches,
      getFilePath: () => pathRef.current,
      getLeadingContext: () => leadingContextRef.current,
      onStatusChange: (status) => statusRef.current?.(status),
    });
    instance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      runRef.current?.();
    });
    instance.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
      advanceRef.current?.();
    });
    instance.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.Enter, () => {
      insertBelowRef.current?.();
    });
    instance.onDidFocusEditorText(() => {
      focusRef.current?.();
    });
    const syncHeight = () => {
      const contentHeight = Math.min(
        CELL_MAX_HEIGHT_PX,
        Math.max(CELL_MIN_HEIGHT_PX, instance.getContentHeight())
      );
      setHeight(contentHeight);
    };
    instance.onDidContentSizeChange(syncHeight);
    syncHeight();
  }, []);

  useEffect(() => {
    autocompleteRef.current?.setEnabled(autocompleteEnabled);
  }, [autocompleteEnabled]);

  useEffect(() => {
    if (focusToken > 0) instanceRef.current?.focus();
  }, [focusToken]);

  useEffect(() => {
    return () => {
      autocompleteRef.current?.dispose();
      autocompleteRef.current = null;
    };
  }, []);

  return (
    <div className={styles.nbCellEditor} style={{ height }}>
      <MonacoEditor
        path={`${notebookPath}#${cell.id}`}
        language={cell.kind === "markdown" ? "markdown" : "python"}
        value={cell.source}
        theme={resolvedTheme === "light" ? "gc-light" : "gc-dark"}
        beforeMount={configureMonaco}
        onMount={handleMount}
        onChange={(value) => onChange(value ?? "")}
        keepCurrentModel
        options={{
          automaticLayout: true,
          minimap: { enabled: false },
          fontFamily:
            "'Geist Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace",
          fontLigatures: true,
          fontSize: 13,
          lineHeight: 19,
          padding: { top: 8, bottom: 8 },
          scrollBeyondLastLine: false,
          scrollbar: {
            vertical: "hidden",
            verticalScrollbarSize: 0,
            horizontalScrollbarSize: 6,
            useShadows: false,
            alwaysConsumeMouseWheel: false,
          },
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          renderLineHighlight: "none",
          lineNumbers: "off",
          folding: false,
          glyphMargin: false,
          lineDecorationsWidth: 0,
          wordWrap: "on",
          tabSize: 4,
          insertSpaces: true,
          stickyScroll: { enabled: false },
          contextmenu: true,
        }}
      />
    </div>
  );
}

function NotebookOutput({ output }: { output: StudioNotebookOutput }) {
  if (output.kind === "stream") {
    return (
      <pre
        className={styles.nbOutputText}
        data-stream={output.name}
      >
        {stripAnsi(output.text)}
      </pre>
    );
  }
  if (output.kind === "error") {
    return (
      <pre className={styles.nbOutputError}>
        {stripAnsi(output.traceback.join("\n")) ||
          `${output.ename}: ${output.evalue}`}
      </pre>
    );
  }
  const view = selectNotebookOutputView(output.data);
  if (!view) return null;
  if (view.kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={styles.nbOutputImage}
        src={view.src}
        alt="Saída gráfica da célula"
      />
    );
  }
  if (view.kind === "html") {
    return (
      <div
        className={styles.nbOutputHtml}
        dangerouslySetInnerHTML={{ __html: sanitizeNotebookHtml(view.html) }}
      />
    );
  }
  if (view.kind === "latex") {
    return (
      <div className={styles.nbOutputRich}>
        <StudioMarkdownPreview content={latexToMarkdown(view.source)} />
      </div>
    );
  }
  if (view.kind === "markdown") {
    return (
      <div className={styles.nbOutputRich}>
        <StudioMarkdownPreview content={view.source} />
      </div>
    );
  }
  return <pre className={styles.nbOutputText}>{stripAnsi(view.text)}</pre>;
}

interface StudioNotebookProps {
  file: StudioFile;
  autocompleteEnabled: boolean;
  assistantModelId: string;
  onChange: (content: string) => void;
  onAutocompleteStatusChange?: (status: StudioAutocompleteStatus) => void;
}

export function StudioNotebook({
  file,
  autocompleteEnabled,
  assistantModelId,
  onChange,
  onAutocompleteStatusChange,
}: StudioNotebookProps) {
  const [document, setDocument] = useState<StudioNotebookDocument>(() =>
    parseOrCreate(file.content)
  );
  const [runningCells, setRunningCells] = useState<Set<string>>(new Set());
  const [queuedCells, setQueuedCells] = useState<Set<string>>(new Set());
  const [pendingInput, setPendingInput] = useState<{
    cellId: string;
    prompt: string;
    password: boolean;
  } | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [editingMarkdownId, setEditingMarkdownId] = useState<string | null>(
    null
  );
  const [assist, setAssist] = useState<{
    cellId: string;
    phase: "prompt" | "streaming" | "preview" | "error";
    promptText: string;
    responseText: string;
    errorMessage?: string;
  } | null>(null);
  const assistAbortRef = useRef<AbortController | null>(null);
  const [cellDurations, setCellDurations] = useState<Map<string, number>>(
    () => new Map()
  );
  const [focusedCellId, setFocusedCellId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<{
    cellId: string;
    token: number;
  } | null>(null);
  const runStartsRef = useRef<Map<string, number>>(new Map());
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const [controller] = useState<StudioNotebookClientController>(() =>
    createNotebookClientController()
  );

  const kernelState = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState
  );

  // O componente é remontado por key quando o path muda; aqui só protege
  // contra reuso indevido da mesma instância com outro arquivo.
  const pathRef = useRef(file.path);
  useEffect(() => {
    if (pathRef.current !== file.path) {
      pathRef.current = file.path;
      setDocument(parseOrCreate(file.content));
      setRunningCells(new Set());
      setQueuedCells(new Set());
      setPendingInput(null);
      setInputValue("");
      setEditingMarkdownId(null);
      assistAbortRef.current?.abort();
      setAssist(null);
      setCellDurations(new Map());
      setFocusedCellId(null);
      setFocusRequest(null);
      runStartsRef.current.clear();
    }
  }, [file.path, file.content]);

  useEffect(() => {
    return () => assistAbortRef.current?.abort();
  }, []);

  const mutate = useCallback(
    (patch: (previous: StudioNotebookDocument) => StudioNotebookDocument) => {
      setDocument((previous) => {
        const next = patch(previous);
        if (next !== previous) {
          onChangeRef.current(serializeNotebook(next));
        }
        return next;
      });
    },
    []
  );

  const connect = useCallback(() => {
    controller.connect({
      onEvent: (event) => {
        if (event.type === "cell_started") {
          runStartsRef.current.set(event.cellId, Date.now());
          setQueuedCells((previous) => {
            if (!previous.has(event.cellId)) return previous;
            const next = new Set(previous);
            next.delete(event.cellId);
            return next;
          });
          setRunningCells((previous) => new Set(previous).add(event.cellId));
        }
        if (event.type === "input_request") {
          setPendingInput({
            cellId: event.cellId,
            prompt: event.prompt,
            password: event.password,
          });
          setInputValue("");
        }
        if (event.type === "cell_done") {
          const startedAt = runStartsRef.current.get(event.cellId);
          if (startedAt !== undefined) {
            runStartsRef.current.delete(event.cellId);
            const elapsedMs = Date.now() - startedAt;
            setCellDurations((previous) => {
              const next = new Map(previous);
              next.set(event.cellId, elapsedMs);
              return next;
            });
          }
          setPendingInput((previous) =>
            previous?.cellId === event.cellId ? null : previous
          );
          setRunningCells((previous) => {
            if (!previous.has(event.cellId)) return previous;
            const next = new Set(previous);
            next.delete(event.cellId);
            return next;
          });
          setQueuedCells((previous) => {
            if (!previous.has(event.cellId)) return previous;
            const next = new Set(previous);
            next.delete(event.cellId);
            return next;
          });
        }
        if (event.type === "kernel_exit") {
          setRunningCells(new Set());
          setQueuedCells(new Set());
          setPendingInput(null);
          runStartsRef.current.clear();
        }
        mutate((previous) => applyNotebookEventToDocument(previous, event));
      },
    });
  }, [controller, mutate]);

  useEffect(() => {
    connect();
    return () => {
      controller.dispose();
    };
    // Conecta uma vez por montagem; o dispose solta o SSE (o kernel segue
    // vivo no servidor com idle-kill).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kernelReady =
    kernelState.status === "open" && kernelState.kernelStatus !== "starting";

  const handleRunCell = useCallback(
    (cell: StudioNotebookCell): Promise<boolean> => {
      if (cell.kind !== "code" || !kernelReady) return Promise.resolve(false);
      setCellDurations((previous) => {
        if (!previous.has(cell.id)) return previous;
        const next = new Map(previous);
        next.delete(cell.id);
        return next;
      });
      setQueuedCells((previous) => new Set(previous).add(cell.id));
      mutate((previous) => clearNotebookCellOutputs(previous, cell.id));
      return controller.execute(cell.id, cell.source);
    },
    [controller, kernelReady, mutate]
  );

  const requestFocus = useCallback((cellId: string) => {
    setFocusRequest((previous) => ({
      cellId,
      token: (previous?.token ?? 0) + 1,
    }));
  }, []);

  const insertCodeCellAfter = useCallback(
    (afterCellId: string | undefined, kind: "code" | "markdown") => {
      const cell = createNotebookCell(kind);
      mutate((previous) => insertNotebookCell(previous, cell, afterCellId));
      if (kind === "markdown") {
        setEditingMarkdownId(cell.id);
      } else {
        requestFocus(cell.id);
      }
    },
    [mutate, requestFocus]
  );

  const handleRunAndAdvance = useCallback(
    (cell: StudioNotebookCell) => {
      void handleRunCell(cell);
      const index = document.cells.findIndex(({ id }) => id === cell.id);
      const next = document.cells[index + 1];
      if (next) {
        if (next.kind === "code") requestFocus(next.id);
        return;
      }
      insertCodeCellAfter(cell.id, "code");
    },
    [document.cells, handleRunCell, insertCodeCellAfter, requestFocus]
  );

  const handleRunAndInsertBelow = useCallback(
    (cell: StudioNotebookCell) => {
      void handleRunCell(cell);
      insertCodeCellAfter(cell.id, "code");
    },
    [handleRunCell, insertCodeCellAfter]
  );

  const runCellsInOrder = useCallback(
    (cells: StudioNotebookCell[]) => {
      // Os POSTs precisam ser serializados: em paralelo eles podem chegar
      // fora de ordem no servidor e a fila do kernel inverter as células.
      void (async () => {
        for (const cell of cells) {
          if (cell.kind === "code" && cell.source.trim().length > 0) {
            await handleRunCell(cell);
          }
        }
      })();
    },
    [handleRunCell]
  );

  const handleRunAll = useCallback(() => {
    runCellsInOrder(document.cells);
  }, [document.cells, runCellsInOrder]);

  const handleRunAbove = useCallback(() => {
    if (!focusedCellId) return;
    const index = document.cells.findIndex(({ id }) => id === focusedCellId);
    if (index <= 0) return;
    runCellsInOrder(document.cells.slice(0, index));
  }, [document.cells, focusedCellId, runCellsInOrder]);

  const toggleAssist = useCallback((cellId: string) => {
    assistAbortRef.current?.abort();
    setAssist((previous) =>
      previous?.cellId === cellId
        ? null
        : { cellId, phase: "prompt", promptText: "", responseText: "" }
    );
  }, []);

  const runCellAssist = useCallback(
    async (
      cell: StudioNotebookCell,
      intent: "fix" | "generate",
      promptText: string
    ) => {
      const errorOutput = cell.outputs.find(
        (output) => output.kind === "error"
      );
      const errorText =
        errorOutput?.kind === "error"
          ? stripAnsi(errorOutput.traceback.join("\n")) ||
            `${errorOutput.ename}: ${errorOutput.evalue}`
          : "";
      assistAbortRef.current?.abort();
      const abort = new AbortController();
      assistAbortRef.current = abort;
      setAssist({
        cellId: cell.id,
        phase: "streaming",
        promptText,
        responseText: "",
      });

      try {
        const response = await fetch(apiUrl("/api/studio/assist"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: promptText,
            model: assistantModelId,
            file: {
              path: file.path,
              language: "python",
              content: buildLeadingContext(document.cells, cell.id),
            },
            history: [],
            cell: { intent, source: cell.source, error: errorText },
          }),
          signal: abort.signal,
        });
        if (!response.ok) throw await parseApiErrorResponse(response);
        if (!response.body) throw new Error("Stream indisponível.");

        const accumulated = await consumeStudioAssistantStream(
          response.body,
          (content) => {
            setAssist((previous) =>
              previous?.cellId === cell.id
                ? { ...previous, responseText: content }
                : previous
            );
          }
        );
        if (!accumulated.trim()) {
          throw new Error("O modelo não retornou conteúdo.");
        }
        setAssist((previous) =>
          previous?.cellId === cell.id
            ? { ...previous, phase: "preview", responseText: accumulated }
            : previous
        );
      } catch (error) {
        const aborted =
          error instanceof DOMException && error.name === "AbortError";
        if (aborted) {
          setAssist((previous) =>
            previous?.cellId === cell.id ? null : previous
          );
          return;
        }
        const partial =
          error instanceof StudioAssistantStreamInterruptedError
            ? error.partialContent
            : "";
        setAssist((previous) => {
          if (previous?.cellId !== cell.id) return previous;
          if (partial.trim()) {
            return { ...previous, phase: "preview", responseText: partial };
          }
          return {
            ...previous,
            phase: "error",
            errorMessage:
              error instanceof Error
                ? error.message
                : "Falha ao consultar o assistente.",
          };
        });
      } finally {
        if (assistAbortRef.current === abort) assistAbortRef.current = null;
      }
    },
    [assistantModelId, document.cells, file.path]
  );

  const applyAssist = useCallback(
    (cellId: string) => {
      if (assist?.cellId !== cellId || assist.phase !== "preview") return;
      const code = extractPythonCodeBlock(assist.responseText);
      mutate((current) => updateNotebookCellSource(current, cellId, code));
      setAssist(null);
    },
    [assist, mutate]
  );

  const handleRestartKernel = useCallback(() => {
    if (kernelState.status === "closed" || kernelState.status === "error") {
      connect();
      return;
    }
    // Reconecta quando o stream atual fechar de vez; o connect novo cria um
    // kernel zerado no servidor.
    const unsubscribe = controller.subscribe(() => {
      if (controller.getState().status !== "closed") return;
      unsubscribe();
      setTimeout(() => connect(), 0);
    });
    void controller.shutdown();
  }, [connect, controller, kernelState.status]);

  const handleInterrupt = useCallback(() => {
    void controller.interrupt();
  }, [controller]);

  const leadingContexts = useMemo(() => {
    const map = new Map<string, string>();
    for (const cell of document.cells) {
      map.set(cell.id, buildLeadingContext(document.cells, cell.id));
    }
    return map;
  }, [document.cells]);

  const statusLabel = notebookKernelStatusLabel(kernelState);
  const restartLabel =
    kernelState.status === "closed" || kernelState.status === "error"
      ? "Novo kernel"
      : "Reiniciar kernel";

  return (
    <div className={styles.notebookPane} aria-label="Notebook do workspace">
      <header className={styles.notebookHeader}>
        <span
          className={styles.notebookStatus}
          data-status={kernelState.status}
          data-kernel={kernelState.kernelStatus ?? "none"}
        >
          {statusLabel}
        </span>
        <div className={styles.notebookActions}>
          {kernelState.kernelStatus === "busy" ? (
            <button
              type="button"
              className={styles.notebookActionButton}
              onClick={handleInterrupt}
            >
              <Square size={13} />
              Interromper
            </button>
          ) : null}
          <button
            type="button"
            className={styles.notebookActionButton}
            onClick={handleRunAll}
            disabled={!kernelReady}
            title="Executar todas as células de código em ordem"
          >
            <FastForward size={13} />
            Executar tudo
          </button>
          <button
            type="button"
            className={styles.notebookActionButton}
            onClick={handleRunAbove}
            disabled={!kernelReady || !focusedCellId}
            title="Executar as células acima da célula em foco"
          >
            <Play size={13} />
            Executar acima
          </button>
          <button
            type="button"
            className={styles.notebookActionButton}
            onClick={handleRestartKernel}
          >
            <RotateCcw size={13} />
            {restartLabel}
          </button>
        </div>
      </header>

      <div className={styles.notebookCells}>
        {document.cells.map((cell, cellIndex) => {
          const running = runningCells.has(cell.id);
          const queued = queuedCells.has(cell.id);
          const isMarkdown = cell.kind === "markdown";
          const editingMarkdown = editingMarkdownId === cell.id;
          const duration = cellDurations.get(cell.id);

          return (
            <div key={cell.id} className={styles.nbCellGroup}>
              <article
                className={styles.nbCell}
                data-kind={cell.kind}
                data-running={running}
                data-queued={queued}
              >
                <div className={styles.nbCellGutter}>
                  {isMarkdown ? (
                    <button
                      type="button"
                      className={styles.nbCellGutterButton}
                      onClick={() =>
                        setEditingMarkdownId(editingMarkdown ? null : cell.id)
                      }
                      aria-label={
                        editingMarkdown
                          ? "Concluir edição da célula"
                          : "Editar célula de markdown"
                      }
                      title={editingMarkdown ? "Concluir" : "Editar"}
                    >
                      <Pencil size={13} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={styles.nbCellGutterButton}
                      onClick={() => void handleRunCell(cell)}
                      disabled={!kernelReady || running || queued}
                      aria-label="Executar célula"
                      title="Executar (Ctrl+Enter na célula)"
                    >
                      <Play size={13} />
                    </button>
                  )}
                  <span
                    className={styles.nbCellCount}
                    title={queued ? "Na fila de execução" : undefined}
                  >
                    {isMarkdown
                      ? "md"
                      : running
                        ? "[*]"
                        : queued
                          ? "[…]"
                          : `[${cell.executionCount ?? " "}]`}
                  </span>
                  {!isMarkdown && duration !== undefined && !running ? (
                    <span
                      className={styles.nbCellDuration}
                      title="Duração da última execução"
                    >
                      {formatCellDuration(duration)}
                    </span>
                  ) : null}
                  {!isMarkdown ? (
                    <button
                      type="button"
                      className={styles.nbCellGutterButton}
                      onClick={() => toggleAssist(cell.id)}
                      data-active={assist?.cellId === cell.id}
                      aria-label="Assistente da célula"
                      title="Assistente (gerar ou corrigir a célula)"
                    >
                      <Sparkles size={13} />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={styles.nbCellGutterButton}
                    onClick={() =>
                      mutate((previous) =>
                        moveNotebookCell(previous, cell.id, "up")
                      )
                    }
                    disabled={cellIndex === 0}
                    aria-label="Mover célula para cima"
                    title="Mover para cima"
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button
                    type="button"
                    className={styles.nbCellGutterButton}
                    onClick={() =>
                      mutate((previous) =>
                        moveNotebookCell(previous, cell.id, "down")
                      )
                    }
                    disabled={cellIndex === document.cells.length - 1}
                    aria-label="Mover célula para baixo"
                    title="Mover para baixo"
                  >
                    <ChevronDown size={13} />
                  </button>
                  <button
                    type="button"
                    className={styles.nbCellGutterButton}
                    onClick={() =>
                      mutate((previous) =>
                        removeNotebookCell(previous, cell.id)
                      )
                    }
                    aria-label="Remover célula"
                    title="Remover célula"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div className={styles.nbCellBody}>
                  {isMarkdown && !editingMarkdown ? (
                    <div
                      className={styles.nbMarkdownRendered}
                      onDoubleClick={() => setEditingMarkdownId(cell.id)}
                    >
                      <StudioMarkdownPreview
                        content={
                          cell.source.trim().length > 0
                            ? cell.source
                            : "*Célula de markdown vazia — clique no lápis para editar.*"
                        }
                      />
                    </div>
                  ) : (
                    <NotebookCellEditor
                      cell={cell}
                      notebookPath={file.path}
                      autocompleteEnabled={autocompleteEnabled && !isMarkdown}
                      leadingContext={leadingContexts.get(cell.id) ?? ""}
                      onChange={(source) =>
                        mutate((previous) =>
                          updateNotebookCellSource(previous, cell.id, source)
                        )
                      }
                      onRun={isMarkdown ? undefined : () => void handleRunCell(cell)}
                      onRunAndAdvance={
                        isMarkdown
                          ? () => setEditingMarkdownId(null)
                          : () => handleRunAndAdvance(cell)
                      }
                      onRunAndInsertBelow={
                        isMarkdown
                          ? undefined
                          : () => handleRunAndInsertBelow(cell)
                      }
                      onFocus={() => setFocusedCellId(cell.id)}
                      focusToken={
                        focusRequest?.cellId === cell.id
                          ? focusRequest.token
                          : 0
                      }
                      onAutocompleteStatusChange={onAutocompleteStatusChange}
                    />
                  )}

                  {cell.outputs.length > 0 ? (
                    <div className={styles.nbOutputs}>
                      {cell.outputs.map((output, index) => (
                        <NotebookOutput key={index} output={output} />
                      ))}
                    </div>
                  ) : null}

                  {pendingInput?.cellId === cell.id ? (
                    <form
                      className={styles.nbInputRow}
                      onSubmit={(event) => {
                        event.preventDefault();
                        void controller.inputReply(inputValue);
                        setPendingInput(null);
                        setInputValue("");
                      }}
                    >
                      <label className={styles.nbInputPrompt}>
                        {pendingInput.prompt || "input()"}
                      </label>
                      <input
                        autoFocus
                        className={styles.nbInputField}
                        type={pendingInput.password ? "password" : "text"}
                        value={inputValue}
                        onChange={(event) => setInputValue(event.target.value)}
                        aria-label="Resposta para o input() da célula"
                      />
                      <button
                        type="submit"
                        className={styles.notebookActionButton}
                      >
                        Enviar
                      </button>
                    </form>
                  ) : null}

                  {assist?.cellId === cell.id ? (
                    <div className={styles.nbAssist}>
                      {assist.phase === "prompt" ? (
                        <form
                          className={styles.nbAssistPromptRow}
                          onSubmit={(event) => {
                            event.preventDefault();
                            const text = assist.promptText.trim();
                            if (text) void runCellAssist(cell, "generate", text);
                          }}
                        >
                          <input
                            autoFocus
                            className={styles.nbInputField}
                            placeholder="O que gerar ou mudar nesta célula?"
                            value={assist.promptText}
                            onChange={(event) =>
                              setAssist((previous) =>
                                previous?.cellId === cell.id
                                  ? {
                                      ...previous,
                                      promptText: event.target.value,
                                    }
                                  : previous
                              )
                            }
                            aria-label="Pedido para o assistente da célula"
                          />
                          {cell.outputs.some(
                            (output) => output.kind === "error"
                          ) ? (
                            <button
                              type="button"
                              className={styles.notebookActionButton}
                              onClick={() =>
                                void runCellAssist(
                                  cell,
                                  "fix",
                                  "Corrija o erro desta célula."
                                )
                              }
                            >
                              Corrigir erro
                            </button>
                          ) : null}
                          <button
                            type="submit"
                            className={styles.notebookActionButton}
                            disabled={assist.promptText.trim().length === 0}
                          >
                            Gerar
                          </button>
                        </form>
                      ) : null}

                      {assist.phase === "streaming" ? (
                        <>
                          <pre className={styles.nbAssistPreview}>
                            {assist.responseText || "Consultando o assistente…"}
                          </pre>
                          <div className={styles.nbAssistActions}>
                            <button
                              type="button"
                              className={styles.notebookActionButton}
                              onClick={() => assistAbortRef.current?.abort()}
                            >
                              <Square size={13} />
                              Cancelar
                            </button>
                          </div>
                        </>
                      ) : null}

                      {assist.phase === "preview" ? (
                        <>
                          <pre className={styles.nbAssistPreview}>
                            {extractPythonCodeBlock(assist.responseText)}
                          </pre>
                          <div className={styles.nbAssistActions}>
                            <button
                              type="button"
                              className={styles.notebookActionButton}
                              onClick={() => applyAssist(cell.id)}
                            >
                              Aplicar na célula
                            </button>
                            <button
                              type="button"
                              className={styles.notebookActionButton}
                              onClick={() => setAssist(null)}
                            >
                              Descartar
                            </button>
                          </div>
                        </>
                      ) : null}

                      {assist.phase === "error" ? (
                        <>
                          <p className={styles.nbAssistError}>
                            {assist.errorMessage ??
                              "Falha ao consultar o assistente."}
                          </p>
                          <div className={styles.nbAssistActions}>
                            <button
                              type="button"
                              className={styles.notebookActionButton}
                              onClick={() => setAssist(null)}
                            >
                              Fechar
                            </button>
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </article>

              {cellIndex < document.cells.length - 1 ? (
                <div className={styles.nbInsertRow}>
                  <button
                    type="button"
                    className={styles.nbInsertButton}
                    onClick={() => insertCodeCellAfter(cell.id, "code")}
                  >
                    <Plus size={11} />
                    Código
                  </button>
                  <button
                    type="button"
                    className={styles.nbInsertButton}
                    onClick={() => insertCodeCellAfter(cell.id, "markdown")}
                  >
                    <Plus size={11} />
                    Markdown
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}

        <div className={styles.nbAddRow}>
          <button
            type="button"
            className={styles.notebookActionButton}
            onClick={() => mutate((previous) => addNotebookCell(previous, "code"))}
          >
            <Plus size={13} />
            Código
          </button>
          <button
            type="button"
            className={styles.notebookActionButton}
            onClick={() =>
              mutate((previous) => addNotebookCell(previous, "markdown"))
            }
          >
            <Plus size={13} />
            Markdown
          </button>
        </div>
      </div>
    </div>
  );
}
