"use client";

import Link from "next/link";
import {
  Bot,
  ChevronRight,
  Code2,
  FolderTree,
  PanelRightOpen,
  Play,
  Square,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { SettingsDrawer } from "@/components/settings/SettingsDrawer";
import { StudioAssistantPanel } from "@/components/studio/StudioAssistantPanel";
import { StudioAutocompleteControl } from "@/components/studio/StudioAutocompleteControl";
import { StudioConsole } from "@/components/studio/StudioConsole";
import {
  StudioEditor,
  type StudioEditorHandle,
} from "@/components/studio/StudioEditor";
import { StudioExplorer } from "@/components/studio/StudioExplorer";
import { useStudioWorkspace } from "@/hooks/useStudioWorkspace";
import { runCompiledStudioModule } from "@/lib/studio/runner";
import type { StudioAutocompleteStatus } from "@/lib/studio/autocomplete";
import type { StudioConsoleEntry, StudioRunResult } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import styles from "@/components/studio/GauchoStudioShell.module.css";

interface StudioRunSession {
  filePath: string;
  result: StudioRunResult;
}

function fileBadge(name: string) {
  if (name.endsWith(".ts") || name.endsWith(".tsx")) return "TS";
  if (name.endsWith(".js") || name.endsWith(".jsx")) return "JS";
  if (name.endsWith(".json")) return "{}";
  if (name.endsWith(".md")) return "MD";
  return "TXT";
}

function errorEntry(message: string): StudioConsoleEntry {
  return {
    id: `studio-run-error-${Date.now()}`,
    level: "error",
    text: message,
  };
}

export function GauchoStudioShell() {
  const {
    workspace,
    activeFile,
    openFiles,
    saveState,
    hydrated,
    openFile,
    closeFile,
    updateActiveFile,
    addAssistantMessage,
    updateAssistantMessage,
    clearAssistantMessages,
    setSelectedModelId,
    setAutocompleteEnabled,
  } = useStudioWorkspace();
  const editorRef = useRef<StudioEditorHandle | null>(null);
  const runAbortRef = useRef<AbortController | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [mobileExplorerOpen, setMobileExplorerOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [runSession, setRunSession] = useState<StudioRunSession | null>(null);
  const [autocompleteStatus, setAutocompleteStatus] =
    useState<StudioAutocompleteStatus>(
      workspace.autocompleteEnabled ? "idle" : "off"
    );

  const executable =
    activeFile?.language === "typescript" ||
    activeFile?.language === "javascript";
  const autocompleteEnabled =
    hydrated && workspace.autocompleteEnabled;

  useEffect(() => {
    return () => runAbortRef.current?.abort();
  }, []);

  const handleRun = useCallback(async () => {
    if (!activeFile || !executable || running) return;
    const runFilePath = activeFile.path;
    const controller = new AbortController();
    runAbortRef.current = controller;
    setRunning(true);
    setRunSession({
      filePath: runFilePath,
      result: { status: "completed", durationMs: 0, entries: [] },
    });

    try {
      const compiled = await editorRef.current?.compileActiveFile();
      if (!compiled) throw new Error("O editor ainda está carregando.");

      const result = await runCompiledStudioModule(compiled.code, {
        signal: controller.signal,
      });
      const diagnosticEntries: StudioConsoleEntry[] = compiled.diagnostics.map(
        (diagnostic, index) => ({
          id: `studio-diagnostic-${Date.now()}-${index}`,
          level: "warn",
          text: diagnostic,
        })
      );
      setRunSession({
        filePath: runFilePath,
        result: {
          ...result,
          entries: [...diagnosticEntries, ...result.entries],
        },
      });

      if (result.status === "completed") {
        toast.success(`Execução concluída em ${result.durationMs} ms.`);
      } else if (result.status === "aborted") {
        toast.info("Execução interrompida.");
      } else {
        toast.error("A execução terminou com erro.");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha ao executar o arquivo.";
      setRunSession({
        filePath: runFilePath,
        result: {
          status: "failed",
          durationMs: 0,
          entries: [errorEntry(message)],
        },
      });
      toast.error(message);
    } finally {
      if (runAbortRef.current === controller) runAbortRef.current = null;
      setRunning(false);
    }
  }, [activeFile, executable, running]);

  const handleStop = useCallback(() => {
    runAbortRef.current?.abort();
  }, []);

  const handleExplorerFileOpen = useCallback(
    (path: string) => {
      openFile(path);
      setMobileExplorerOpen(false);
    },
    [openFile]
  );

  if (!activeFile) {
    return (
      <div className={styles.fatalState}>
        <Code2 size={22} />
        <p>Não consegui abrir o projeto local do Studio.</p>
      </div>
    );
  }

  const breadcrumbs = activeFile.path.split("/");

  return (
    <>
      <div
        className={cn(
          styles.shell,
          !assistantOpen && styles.shellWithoutAssistant,
          mobileExplorerOpen && styles.mobileExplorerOpen
        )}
        data-visual-theme="atmosphere-glass"
      >
        <StudioExplorer
          files={workspace.files}
          activeFilePath={workspace.activeFilePath}
          onOpenFile={handleExplorerFileOpen}
          onOpenSettings={() => setSettingsOpen(true)}
          onClose={() => setMobileExplorerOpen(false)}
        />

        <header className={styles.topbar}>
          <div className={styles.executionStatus}>
            <span className={cn(styles.statusDot, running && styles.statusDotRunning)} />
            <span>{running ? "Executando" : "Execução local"}</span>
            <span className={styles.topbarDivider} />
            <span className={styles.savedDot} />
            <span className={styles.saveLabel}>
              {saveState === "saving"
                ? "Salvando"
                : saveState === "error"
                ? "Erro ao salvar"
                : "Salvo"}
            </span>
            <span className={styles.topbarDivider} />
            <StudioAutocompleteControl
              enabled={autocompleteEnabled}
              status={
                autocompleteEnabled ? autocompleteStatus : "off"
              }
              disabled={!hydrated}
              onToggle={setAutocompleteEnabled}
            />
          </div>

          <div className={styles.topbarActions}>
            {!assistantOpen ? (
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setAssistantOpen(true)}
                aria-label="Abrir assistente de código"
              >
                <PanelRightOpen size={17} />
              </button>
            ) : null}
            <div className={styles.runButtonGroup}>
              <button
                type="button"
                className={styles.runButton}
                onClick={running ? handleStop : () => void handleRun()}
                disabled={!running && (!editorReady || !executable)}
                aria-label={running ? "Parar execução" : "Executar arquivo"}
              >
                {running ? (
                  <Square size={14} fill="currentColor" />
                ) : (
                  <Play size={15} fill="currentColor" />
                )}
                <span>{running ? "Stop" : "Run"}</span>
              </button>
            </div>
          </div>
        </header>

        <main className={styles.workbench}>
          <section className={styles.editorPanel} aria-label="Editor de código">
            <div className={styles.fileTabs}>
              {openFiles.map((file) => (
                <div
                  key={file.path}
                  className={cn(
                    styles.fileTab,
                    file.path === activeFile.path && styles.fileTabActive
                  )}
                >
                  <button
                    type="button"
                    className={styles.fileTabSelect}
                    onClick={() => openFile(file.path)}
                  >
                    <span className={styles.tabBadge}>{fileBadge(file.name)}</span>
                    <span>{file.name}</span>
                  </button>
                  <button
                    type="button"
                    className={styles.tabClose}
                    aria-label={`Fechar ${file.name}`}
                    onClick={() => closeFile(file.path)}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>

            <div className={styles.breadcrumbs}>
              {breadcrumbs.map((segment, index) => (
                <span key={`${segment}-${index}`}>
                  {index > 0 ? <ChevronRight size={12} /> : null}
                  <span>{segment}</span>
                </span>
              ))}
              {activeFile.language === "typescript" ? (
                <>
                  <ChevronRight size={12} />
                  <span className={styles.symbolCrumb}>◇ calcular</span>
                </>
              ) : null}
            </div>

            <StudioEditor
              ref={editorRef}
              file={activeFile}
              autocompleteEnabled={autocompleteEnabled}
              onAutocompleteStatusChange={setAutocompleteStatus}
              onChange={updateActiveFile}
              onReadyChange={setEditorReady}
            />
          </section>

          <StudioConsole
            filePath={runSession?.filePath ?? null}
            result={runSession?.result ?? null}
            running={running}
            onClear={() => setRunSession(null)}
          />
        </main>

        {assistantOpen ? (
          <StudioAssistantPanel
            file={activeFile}
            messages={workspace.assistantMessages}
            modelId={workspace.selectedModelId}
            onModelChange={setSelectedModelId}
            onAddMessage={addAssistantMessage}
            onUpdateMessage={updateAssistantMessage}
            onClearMessages={clearAssistantMessages}
            onClose={() => setAssistantOpen(false)}
          />
        ) : null}

        <nav className={styles.mobileNav} aria-label="Navegação móvel do Studio">
          <Link href="/">
            <Code2 size={16} />
            Chat
          </Link>
          <button type="button" onClick={() => setMobileExplorerOpen(true)}>
            <FolderTree size={16} />
            Arquivos
          </button>
          <button type="button" onClick={() => editorRef.current?.focus()}>
            <Code2 size={16} />
            Código
          </button>
          <button type="button" onClick={() => setAssistantOpen(true)}>
            <Bot size={16} />
            Assistente
          </button>
        </nav>
      </div>

      <SettingsDrawer
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}
