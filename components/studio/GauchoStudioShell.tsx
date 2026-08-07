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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { StudioServerExplorer } from "@/components/studio/StudioServerExplorer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useStudioWorkspace } from "@/hooks/useStudioWorkspace";
import { useStudioServerWorkspace } from "@/hooks/useStudioServerWorkspace";
import { runCompiledStudioModule } from "@/lib/studio/runner";
import type { StudioAutocompleteStatus } from "@/lib/studio/autocomplete";
import type {
  StudioConsoleEntry,
  StudioFile,
  StudioRunResult,
} from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import styles from "@/components/studio/GauchoStudioShell.module.css";

type StudioMode = "local" | "server";

interface StudioRunSession {
  filePath: string;
  result: StudioRunResult;
}

function fileBadge(name: string) {
  if (name.endsWith(".ts") || name.endsWith(".tsx")) return "TS";
  if (name.endsWith(".js") || name.endsWith(".jsx")) return "JS";
  if (name.endsWith(".py")) return "PY";
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

function defaultArchiveName(): string {
  return `projeto-${new Date().toISOString().slice(0, 10)}`;
}

export function GauchoStudioShell() {
  const {
    workspace,
    activeFile: localActiveFile,
    openFiles: localOpenFiles,
    saveState: localSaveState,
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
  const {
    state: server,
    controller: serverController,
    bootstrap: bootstrapServer,
  } = useStudioServerWorkspace();
  const editorRef = useRef<StudioEditorHandle | null>(null);
  const runAbortRef = useRef<AbortController | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<StudioMode>("local");
  const [editorReady, setEditorReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [mobileExplorerOpen, setMobileExplorerOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [runSession, setRunSession] = useState<StudioRunSession | null>(null);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState(defaultArchiveName);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [pendingRestoreSlug, setPendingRestoreSlug] = useState<string | null>(
    null
  );
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [autocompleteStatus, setAutocompleteStatus] =
    useState<StudioAutocompleteStatus>(
      workspace.autocompleteEnabled ? "idle" : "off"
    );

  const isServer = mode === "server";
  const serverActiveFile: StudioFile | null =
    server.activeFilePath !== null
      ? server.files[server.activeFilePath] ?? null
      : null;
  const serverOpenFiles = useMemo(
    () =>
      server.openFilePaths
        .map((path) => server.files[path])
        .filter((file): file is StudioFile => Boolean(file)),
    [server.files, server.openFilePaths]
  );

  const activeFile = isServer ? serverActiveFile : localActiveFile;
  const openFiles = isServer ? serverOpenFiles : localOpenFiles;
  const isRunning = isServer ? server.running : running;
  const executable = isServer
    ? serverActiveFile?.language === "python"
    : localActiveFile?.language === "typescript" ||
      localActiveFile?.language === "javascript";
  const autocompleteEnabled = hydrated && workspace.autocompleteEnabled;
  const saveLabel = isServer
    ? server.saveState === "error"
      ? "Erro ao salvar"
      : server.saveState === "saved"
      ? "Salvo"
      : "Salvando"
    : localSaveState === "saving"
    ? "Salvando"
    : localSaveState === "error"
    ? "Erro ao salvar"
    : "Salvo";

  useEffect(() => {
    return () => runAbortRef.current?.abort();
  }, []);

  // Entrada no modo servidor: pede senha quando bloqueado e carrega a
  // árvore + arquivo inicial quando desbloqueado.
  useEffect(() => {
    if (!isServer || server.enabled !== true) return;
    if (!server.unlocked) {
      serverController.openUnlockPrompt();
      return;
    }
    if (server.tree.length === 0 || server.activeFilePath === null) {
      void bootstrapServer();
    }
  }, [
    isServer,
    server.enabled,
    server.unlocked,
    server.tree.length,
    server.activeFilePath,
    serverController,
    bootstrapServer,
  ]);

  const handleLocalRun = useCallback(async () => {
    if (!localActiveFile || !executable || running) return;
    const runFilePath = localActiveFile.path;
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
  }, [localActiveFile, executable, running]);

  const handleServerRun = useCallback(async () => {
    await serverController.run();
    const result = serverController.getState().runSession?.result;
    if (!result) return;
    if (result.status === "completed") {
      toast.success(`Execução concluída em ${result.durationMs} ms.`);
    } else if (result.status === "aborted") {
      toast.info("Execução interrompida.");
    } else if (result.status === "timeout") {
      toast.error("A execução excedeu o tempo limite.");
    } else {
      toast.error("A execução terminou com erro.");
    }
  }, [serverController]);

  const handleRun = useCallback(() => {
    if (isServer) void handleServerRun();
    else void handleLocalRun();
  }, [handleLocalRun, handleServerRun, isServer]);

  const handleStop = useCallback(() => {
    if (isServer) void serverController.stop();
    else runAbortRef.current?.abort();
  }, [isServer, serverController]);

  const handleExplorerFileOpen = useCallback(
    (path: string) => {
      openFile(path);
      setMobileExplorerOpen(false);
    },
    [openFile]
  );

  const handleServerExplorerFileOpen = useCallback(
    (path: string) => {
      void serverController.openFile(path);
      setMobileExplorerOpen(false);
    },
    [serverController]
  );

  const handleEditorChange = useCallback(
    (content: string) => {
      if (isServer) serverController.editActiveFile(content);
      else updateActiveFile(content);
    },
    [isServer, serverController, updateActiveFile]
  );

  const handleUnlockSubmit = useCallback(async () => {
    const password = unlockPassword;
    if (!password) return;
    const unlocked = await serverController.unlock(password);
    if (unlocked) {
      setUnlockPassword("");
      toast.success("Workspace Python desbloqueado.");
    }
  }, [serverController, unlockPassword]);

  const handleUnlockCancel = useCallback(() => {
    serverController.cancelUnlock();
    setUnlockPassword("");
    setMode("local");
  }, [serverController]);

  const handleSaveProject = useCallback(async () => {
    const blob = await serverController.saveArchive(saveName);
    if (!blob) {
      toast.error(
        serverController.getState().errorMessage ??
          "Não consegui salvar o projeto."
      );
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${saveName}.zip`;
    anchor.click();
    URL.revokeObjectURL(url);
    setSaveDialogOpen(false);
    toast.success("Projeto salvo e baixado.");
  }, [saveName, serverController]);

  const handleOpenRestore = useCallback(() => {
    void serverController.loadArchives();
    setRestoreDialogOpen(true);
  }, [serverController]);

  const handleRestore = useCallback(async () => {
    if (!pendingRestoreSlug) return;
    const restored = await serverController.restoreArchive(pendingRestoreSlug);
    if (restored) toast.success("Projeto restaurado.");
    else
      toast.error(
        serverController.getState().errorMessage ??
          "Não consegui restaurar o projeto."
      );
  }, [pendingRestoreSlug, serverController]);

  const handleImportSelected = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      event.target.value = "";
      if (file) setPendingImportFile(file);
    },
    []
  );

  const handleImport = useCallback(async () => {
    if (!pendingImportFile) return;
    const imported = await serverController.importArchive(pendingImportFile);
    if (imported) toast.success("Zip importado para o workspace.");
    else
      toast.error(
        serverController.getState().errorMessage ??
          "Não consegui importar o zip."
      );
  }, [pendingImportFile, serverController]);

  const handleReset = useCallback(async () => {
    const reset = await serverController.resetWorkspace();
    if (reset) toast.success("Workspace resetado para o template.");
    else
      toast.error(
        serverController.getState().errorMessage ??
          "Não consegui resetar o workspace."
      );
  }, [serverController]);

  if (!isServer && !localActiveFile) {
    return (
      <div className={styles.fatalState}>
        <Code2 size={22} />
        <p>Não consegui abrir o projeto local do Studio.</p>
      </div>
    );
  }

  const breadcrumbs = activeFile ? activeFile.path.split("/") : [];
  const consoleFilePath = isServer
    ? server.runSession?.filePath ?? null
    : runSession?.filePath ?? null;
  const consoleResult = isServer
    ? server.runSession?.result ?? null
    : runSession?.result ?? null;

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
        {isServer ? (
          <StudioServerExplorer
            tree={server.tree}
            activeFilePath={server.activeFilePath}
            busy={server.busy}
            onOpenFile={handleServerExplorerFileOpen}
            onOpenSettings={() => setSettingsOpen(true)}
            onSaveProject={() => {
              setSaveName(defaultArchiveName());
              setSaveDialogOpen(true);
            }}
            onRestoreProject={handleOpenRestore}
            onImportProject={() => importInputRef.current?.click()}
            onResetProject={() => setResetConfirmOpen(true)}
            onClose={() => setMobileExplorerOpen(false)}
          />
        ) : (
          <StudioExplorer
            files={workspace.files}
            activeFilePath={workspace.activeFilePath}
            onOpenFile={handleExplorerFileOpen}
            onOpenSettings={() => setSettingsOpen(true)}
            onClose={() => setMobileExplorerOpen(false)}
          />
        )}

        <header className={styles.topbar}>
          <div className={styles.executionStatus}>
            {server.enabled ? (
              <div
                className={styles.modeToggle}
                role="group"
                aria-label="Modo de execução do Studio"
              >
                <button
                  type="button"
                  className={cn(!isServer && styles.modeToggleActive)}
                  onClick={() => setMode("local")}
                >
                  Local
                </button>
                <button
                  type="button"
                  className={cn(isServer && styles.modeToggleActive)}
                  onClick={() => setMode("server")}
                >
                  Python
                </button>
              </div>
            ) : null}
            <span
              className={cn(styles.statusDot, isRunning && styles.statusDotRunning)}
            />
            <span>
              {isRunning
                ? "Executando"
                : isServer
                ? "Execução no servidor"
                : "Execução local"}
            </span>
            <span className={styles.topbarDivider} />
            <span className={styles.savedDot} />
            <span className={styles.saveLabel}>{saveLabel}</span>
            <span className={styles.topbarDivider} />
            <StudioAutocompleteControl
              enabled={autocompleteEnabled}
              status={autocompleteEnabled ? autocompleteStatus : "off"}
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
                onClick={isRunning ? handleStop : handleRun}
                disabled={
                  !isRunning &&
                  (isServer
                    ? !executable || !server.unlocked
                    : !editorReady || !executable)
                }
                aria-label={isRunning ? "Parar execução" : "Executar arquivo"}
              >
                {isRunning ? (
                  <Square size={14} fill="currentColor" />
                ) : (
                  <Play size={15} fill="currentColor" />
                )}
                <span>{isRunning ? "Stop" : "Run"}</span>
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
                    file.path === activeFile?.path && styles.fileTabActive
                  )}
                >
                  <button
                    type="button"
                    className={styles.fileTabSelect}
                    onClick={() =>
                      isServer
                        ? serverController.selectFile(file.path)
                        : openFile(file.path)
                    }
                  >
                    <span className={styles.tabBadge}>{fileBadge(file.name)}</span>
                    <span>{file.name}</span>
                  </button>
                  <button
                    type="button"
                    className={styles.tabClose}
                    aria-label={`Fechar ${file.name}`}
                    onClick={() =>
                      isServer
                        ? serverController.closeFile(file.path)
                        : closeFile(file.path)
                    }
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
              {activeFile?.language === "typescript" ? (
                <>
                  <ChevronRight size={12} />
                  <span className={styles.symbolCrumb}>◇ calcular</span>
                </>
              ) : null}
            </div>

            {activeFile ? (
              <StudioEditor
                ref={editorRef}
                file={activeFile}
                autocompleteEnabled={autocompleteEnabled}
                onAutocompleteStatusChange={setAutocompleteStatus}
                onChange={handleEditorChange}
                onReadyChange={setEditorReady}
              />
            ) : (
              <div className={styles.editorSurface}>
                <div className={styles.editorLoading} />
              </div>
            )}
          </section>

          <StudioConsole
            filePath={consoleFilePath}
            result={consoleResult}
            running={isRunning}
            command={
              isServer && consoleFilePath ? `python ${consoleFilePath}` : undefined
            }
            onClear={() =>
              isServer ? serverController.clearRunSession() : setRunSession(null)
            }
          />
        </main>

        {assistantOpen && activeFile ? (
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

      <input
        ref={importInputRef}
        type="file"
        accept=".zip,application/zip"
        onChange={handleImportSelected}
        hidden
      />

      <Dialog
        open={isServer && server.unlockPromptOpen}
        onOpenChange={(open) => {
          if (!open) handleUnlockCancel();
        }}
      >
        <DialogContent className="max-w-md rounded-2xl border-white/10 bg-background/95 p-6 shadow-2xl backdrop-blur-xl">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-base">Workspace Python</DialogTitle>
            <DialogDescription className="leading-relaxed">
              Informe a senha do workspace para liberar edição e execução no
              servidor. O acesso vale por 60 minutos.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleUnlockSubmit();
            }}
            className="space-y-3"
          >
            <Input
              type="password"
              autoFocus
              value={unlockPassword}
              onChange={(event) => setUnlockPassword(event.target.value)}
              placeholder="Senha do workspace"
              aria-label="Senha do workspace"
            />
            {server.unlockError ? (
              <p className="text-sm text-destructive">{server.unlockError}</p>
            ) : null}
            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" onClick={handleUnlockCancel}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!unlockPassword}>
                Desbloquear
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl border-white/10 bg-background/95 p-6 shadow-2xl backdrop-blur-xl">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-base">Salvar projeto</DialogTitle>
            <DialogDescription className="leading-relaxed">
              O workspace inteiro vira um zip no servidor e o download começa em
              seguida.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSaveProject();
            }}
            className="space-y-3"
          >
            <Input
              autoFocus
              value={saveName}
              onChange={(event) => setSaveName(event.target.value)}
              placeholder="nome-do-projeto"
              aria-label="Nome do projeto"
            />
            <DialogFooter className="mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSaveDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={!saveName.trim() || server.busy}>
                Salvar e baixar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl border-white/10 bg-background/95 p-6 shadow-2xl backdrop-blur-xl">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-base">Restaurar projeto</DialogTitle>
            <DialogDescription className="leading-relaxed">
              Escolha um projeto salvo. O conteúdo atual do workspace será
              substituído.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {server.archives.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum projeto salvo ainda.
              </p>
            ) : (
              server.archives.map((archive) => (
                <button
                  key={archive.slug}
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-left text-sm hover:bg-white/5"
                  onClick={() => {
                    setRestoreDialogOpen(false);
                    setPendingRestoreSlug(archive.slug);
                  }}
                >
                  <span>{archive.slug}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(archive.savedAt).toLocaleString("pt-BR")}
                  </span>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingRestoreSlug !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRestoreSlug(null);
        }}
        title="Restaurar projeto salvo?"
        description={`O workspace atual será substituído por "${pendingRestoreSlug ?? ""}". Alterações não salvas em zip serão perdidas.`}
        confirmLabel="Restaurar"
        onConfirm={handleRestore}
      />

      <ConfirmDialog
        open={pendingImportFile !== null}
        onOpenChange={(open) => {
          if (!open) setPendingImportFile(null);
        }}
        title="Importar zip?"
        description={`O workspace atual será substituído pelo conteúdo de "${pendingImportFile?.name ?? ""}".`}
        confirmLabel="Importar"
        onConfirm={handleImport}
      />

      <ConfirmDialog
        open={resetConfirmOpen}
        onOpenChange={setResetConfirmOpen}
        title="Começar projeto novo?"
        description="O workspace atual será substituído pelo template inicial. Salve em zip antes se quiser manter o que está lá."
        confirmLabel="Novo projeto"
        onConfirm={handleReset}
      />

      <SettingsDrawer
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}
