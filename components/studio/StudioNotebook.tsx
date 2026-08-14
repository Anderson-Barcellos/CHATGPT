"use client";

import dynamic from "next/dynamic";
import { Pencil, Play, Plus, RotateCcw, Square, Trash2 } from "lucide-react";
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
  parseNotebook,
  removeNotebookCell,
  serializeNotebook,
  updateNotebookCellSource,
  type StudioNotebookCell,
  type StudioNotebookDocument,
} from "@/lib/studio/notebookFormat";
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
  onAutocompleteStatusChange?: (status: StudioAutocompleteStatus) => void;
  notebookPath: string;
}

function NotebookCellEditor({
  cell,
  autocompleteEnabled,
  leadingContext,
  onChange,
  onRun,
  onAutocompleteStatusChange,
  notebookPath,
}: NotebookCellEditorProps) {
  const { resolvedTheme } = useTheme();
  const [height, setHeight] = useState(CELL_MIN_HEIGHT_PX);
  const autocompleteRef = useRef<StudioAutocompleteProviderHandle | null>(null);
  const autocompleteEnabledRef = useRef(autocompleteEnabled);
  const leadingContextRef = useRef(leadingContext);
  const runRef = useRef(onRun);
  const statusRef = useRef(onAutocompleteStatusChange);
  const pathRef = useRef(notebookPath);

  useEffect(() => {
    autocompleteEnabledRef.current = autocompleteEnabled;
    leadingContextRef.current = leadingContext;
    runRef.current = onRun;
    statusRef.current = onAutocompleteStatusChange;
    pathRef.current = notebookPath;
  });

  const handleMount = useCallback<OnMount>((instance, monaco) => {
    autocompleteRef.current?.dispose();
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
  const png = output.data["image/png"];
  if (png) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={styles.nbOutputImage}
        src={`data:image/png;base64,${png.replace(/\n/g, "")}`}
        alt="Saída gráfica da célula"
      />
    );
  }
  const text = output.data["text/plain"];
  if (typeof text === "string" && text.length > 0) {
    return <pre className={styles.nbOutputText}>{stripAnsi(text)}</pre>;
  }
  return null;
}

interface StudioNotebookProps {
  file: StudioFile;
  autocompleteEnabled: boolean;
  onChange: (content: string) => void;
  onAutocompleteStatusChange?: (status: StudioAutocompleteStatus) => void;
}

export function StudioNotebook({
  file,
  autocompleteEnabled,
  onChange,
  onAutocompleteStatusChange,
}: StudioNotebookProps) {
  const [document, setDocument] = useState<StudioNotebookDocument>(() =>
    parseOrCreate(file.content)
  );
  const [runningCells, setRunningCells] = useState<Set<string>>(new Set());
  const [editingMarkdownId, setEditingMarkdownId] = useState<string | null>(
    null
  );
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
      setEditingMarkdownId(null);
    }
  }, [file.path, file.content]);

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
        if (event.type === "cell_done") {
          setRunningCells((previous) => {
            if (!previous.has(event.cellId)) return previous;
            const next = new Set(previous);
            next.delete(event.cellId);
            return next;
          });
        }
        if (event.type === "kernel_exit") {
          setRunningCells(new Set());
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
    (cell: StudioNotebookCell) => {
      if (cell.kind !== "code" || !kernelReady) return;
      setRunningCells((previous) => new Set(previous).add(cell.id));
      mutate((previous) => clearNotebookCellOutputs(previous, cell.id));
      void controller.execute(cell.id, cell.source);
    },
    [controller, kernelReady, mutate]
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
            onClick={handleRestartKernel}
          >
            <RotateCcw size={13} />
            {restartLabel}
          </button>
        </div>
      </header>

      <div className={styles.notebookCells}>
        {document.cells.map((cell) => {
          const running = runningCells.has(cell.id);
          const isMarkdown = cell.kind === "markdown";
          const editingMarkdown = editingMarkdownId === cell.id;

          return (
            <article
              key={cell.id}
              className={styles.nbCell}
              data-kind={cell.kind}
              data-running={running}
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
                    onClick={() => handleRunCell(cell)}
                    disabled={!kernelReady || running}
                    aria-label="Executar célula"
                    title="Executar (Ctrl+Enter na célula)"
                  >
                    <Play size={13} />
                  </button>
                )}
                <span className={styles.nbCellCount}>
                  {isMarkdown
                    ? "md"
                    : running
                      ? "[*]"
                      : `[${cell.executionCount ?? " "}]`}
                </span>
                <button
                  type="button"
                  className={styles.nbCellGutterButton}
                  onClick={() =>
                    mutate((previous) => removeNotebookCell(previous, cell.id))
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
                    onRun={isMarkdown ? undefined : () => handleRunCell(cell)}
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
              </div>
            </article>
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
