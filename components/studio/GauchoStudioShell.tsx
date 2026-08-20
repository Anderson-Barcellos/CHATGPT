"use client";

import Link from "next/link";
import {
  Bot,
  ChevronRight,
  Code2,
  FolderTree,
  Lock,
  PanelRightOpen,
  Play,
  Square,
  TerminalSquare,
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
import { StudioMarkdownPreview } from "@/components/studio/StudioMarkdownPreview";
import { StudioNotebook } from "@/components/studio/StudioNotebook";
import { StudioServerExplorer } from "@/components/studio/StudioServerExplorer";
import { StudioTerminal } from "@/components/studio/StudioTerminal";
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
import { useStudioLayout } from "@/hooks/useStudioLayout";
import { useStudioPrefs } from "@/hooks/useStudioPrefs";
import { useStudioServerWorkspace } from "@/hooks/useStudioServerWorkspace";
import type { StudioAutocompleteStatus } from "@/lib/studio/autocomplete";
import type { StudioFile } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import styles from "@/components/studio/GauchoStudioShell.module.css";

function fileBadge(name: string) {
  if (name.endsWith(".py")) return "PY";
  if (name.endsWith(".ts") || name.endsWith(".tsx")) return "TS";
  if (name.endsWith(".js") || name.endsWith(".jsx")) return "JS";
  if (name.endsWith(".ipynb")) return "NB";
  if (name.endsWith(".json")) return "{}";
  if (name.endsWith(".md")) return "MD";
  return "TXT";
}

type StudioMarkdownView = "code" | "split" | "preview";

const MARKDOWN_VIEW_OPTIONS: Array<{
  value: StudioMarkdownView;
  label: string;
}> = [
  { value: "code", label: "Código" },
  { value: "split", label: "Dividido" },
  { value: "preview", label: "Preview" },
];

function defaultArchiveName(): string {
  return `projeto-${new Date().toISOString().slice(0, 10)}`;
}

export function GauchoStudioShell() {
  const {
    prefs,
    hydrated,
    addAssistantMessage,
    updateAssistantMessage,
    clearAssistantMessages,
    setSelectedModelId,
    setAutocompleteEnabled,
  } = useStudioPrefs();
  const {
    state: server,
    controller: serverController,
    bootstrap: bootstrapServer,
  } = useStudioServerWorkspace();
  const editorRef = useRef<StudioEditorHandle | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const workbenchRef = useRef<HTMLElement | null>(null);
  const { startDrag, resetPanel, nudgePanel } = useStudioLayout({
    shellRef,
    workbenchRef,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [mobileExplorerOpen, setMobileExplorerOpen] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState(defaultArchiveName);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [pendingRestoreSlug, setPendingRestoreSlug] = useState<string | null>(
    null
  );
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(
    null
  );
  const [createKind, setCreateKind] = useState<"file" | "folder" | null>(null);
  const [createName, setCreateName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{
    path: string;
    kind: "file" | "directory";
  } | null>(null);
  const [autocompleteStatus, setAutocompleteStatus] =
    useState<StudioAutocompleteStatus>(
      prefs.autocompleteEnabled ? "idle" : "off"
    );

  const activeFile: StudioFile | null =
    server.activeFilePath !== null
      ? server.files[server.activeFilePath] ?? null
      : null;
  const openFiles = useMemo(
    () =>
      server.openFilePaths
        .map((path) => server.files[path])
        .filter((file): file is StudioFile => Boolean(file)),
    [server.files, server.openFilePaths]
  );

  const isRunning = server.running;
  const executable = activeFile?.language === "python";
  const isMarkdownFile = activeFile?.language === "markdown";
  const isNotebookFile = Boolean(activeFile?.path.endsWith(".ipynb"));
  const [markdownView, setMarkdownView] = useState<StudioMarkdownView>("split");
  const [terminalOpen, setTerminalOpen] = useState(false);
  const autocompleteEnabled = hydrated && prefs.autocompleteEnabled;
  const saveLabel =
    server.saveState === "error"
      ? "Erro ao salvar"
      : server.saveState === "saved"
      ? "Salvo"
      : "Salvando";

  // Pede senha quando bloqueado e carrega a árvore + arquivo inicial quando
  // desbloqueado.
  useEffect(() => {
    if (server.enabled !== true) return;
    if (!server.unlocked) {
      serverController.openUnlockPrompt();
      return;
    }
    if (server.tree.length === 0 || server.activeFilePath === null) {
      void bootstrapServer();
    }
  }, [
    server.enabled,
    server.unlocked,
    server.tree.length,
    server.activeFilePath,
    serverController,
    bootstrapServer,
  ]);

  const handleRefreshTree = useCallback(() => {
    if (!server.unlocked) return;
    void serverController.loadTree();
  }, [server.unlocked, serverController]);

  // Terminal e notebook criam arquivos que o cliente não vê acontecer: a
  // árvore re-sincroniza quando a janela recupera foco, a cada 8 s enquanto o
  // terminal está aberto e uma última vez quando ele fecha.
  useEffect(() => {
    if (!server.unlocked) return;
    const onFocus = () => void serverController.loadTree();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [server.unlocked, serverController]);

  useEffect(() => {
    if (!server.unlocked || !terminalOpen) return;
    const interval = window.setInterval(() => {
      void serverController.loadTree();
    }, 8000);
    return () => {
      window.clearInterval(interval);
      void serverController.loadTree();
    };
  }, [server.unlocked, serverController, terminalOpen]);

  const handleRun = useCallback(async () => {
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

  const handleStop = useCallback(() => {
    void serverController.stop();
  }, [serverController]);

  const runnable = !isRunning && executable && server.unlocked;

  const handleRunShortcut = useCallback(() => {
    if (!runnable) return;
    void handleRun();
  }, [handleRun, runnable]);

  // Ctrl/Cmd+Enter fora do editor (dentro dele o Monaco tem o próprio binding);
  // Ctrl+` alterna o terminal (padrão VS Code, via code pra ignorar layout).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && !event.metaKey && event.code === "Backquote") {
        event.preventDefault();
        if (server.unlocked) setTerminalOpen((open) => !open);
        return;
      }
      if (!(event.ctrlKey || event.metaKey) || event.key !== "Enter") return;
      event.preventDefault();
      handleRunShortcut();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleRunShortcut, server.unlocked]);

  const handleExplorerFileOpen = useCallback(
    (path: string) => {
      void serverController.openFile(path);
      setMobileExplorerOpen(false);
    },
    [serverController]
  );

  const handleEditorChange = useCallback(
    (content: string) => {
      serverController.editActiveFile(content);
    },
    [serverController]
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

  const handleOpenCreate = useCallback((kind: "file" | "folder") => {
    setCreateName("");
    setCreateKind(kind);
  }, []);

  const handleCreateSubmit = useCallback(async () => {
    if (!createKind) return;
    const name = createName.trim().replace(/^\/+|\/+$/g, "");
    if (!name) return;
    const path = selectedFolderPath ? `${selectedFolderPath}/${name}` : name;

    const state = serverController.getState();
    if (state.tree.some((row) => row.entry.path === path)) {
      toast.error(`Já existe "${path}" no workspace.`);
      return;
    }

    const created =
      createKind === "file"
        ? await serverController.createFile(path)
        : await serverController.createFolder(path);
    if (!created) {
      toast.error(
        serverController.getState().errorMessage ??
          (createKind === "file"
            ? "Não consegui criar o arquivo."
            : "Não consegui criar a pasta.")
      );
      return;
    }
    if (createKind === "folder") setSelectedFolderPath(path);
    setCreateKind(null);
    toast.success(
      createKind === "file" ? `Arquivo ${path} criado.` : `Pasta ${path} criada.`
    );
  }, [createKind, createName, selectedFolderPath, serverController]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!pendingDelete) return;
    const { path } = pendingDelete;
    const deleted = await serverController.deleteEntry(path);
    if (!deleted) {
      toast.error(
        serverController.getState().errorMessage ??
          "Não consegui excluir do workspace."
      );
      return;
    }
    setSelectedFolderPath((current) =>
      current !== null && (current === path || current.startsWith(`${path}/`))
        ? null
        : current
    );
    toast.success(`"${path}" excluído.`);
  }, [pendingDelete, serverController]);

  const handleReset = useCallback(async () => {
    const reset = await serverController.resetWorkspace();
    if (reset) toast.success("Workspace resetado para o template.");
    else
      toast.error(
        serverController.getState().errorMessage ??
          "Não consegui resetar o workspace."
      );
  }, [serverController]);

  if (server.enabled === false) {
    return (
      <div className={styles.fatalState}>
        <Code2 size={22} />
        <p>
          O workspace Python não está habilitado no servidor. Configure
          STUDIO_WORKSPACE_PASSWORD para ativar o Studio.
        </p>
      </div>
    );
  }

  const breadcrumbs = activeFile ? activeFile.path.split("/") : [];
  const consoleFilePath = server.runSession?.filePath ?? null;
  const consoleResult = server.runSession?.result ?? null;

  return (
    <>
      <div
        ref={shellRef}
        className={cn(
          styles.shell,
          !assistantOpen && styles.shellWithoutAssistant,
          mobileExplorerOpen && styles.mobileExplorerOpen
        )}
        data-visual-theme="atmosphere-glass"
      >
        <StudioServerExplorer
          tree={server.tree}
          activeFilePath={server.activeFilePath}
          busy={server.busy}
          selectedFolderPath={selectedFolderPath}
          onOpenFile={handleExplorerFileOpen}
          onSelectFolder={setSelectedFolderPath}
          onCreateFile={() => handleOpenCreate("file")}
          onCreateFolder={() => handleOpenCreate("folder")}
          onDeleteEntry={(path, kind) => setPendingDelete({ path, kind })}
          onRefreshTree={handleRefreshTree}
          onExpand={() => setMobileExplorerOpen(true)}
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

        <header className={styles.topbar}>
          <div className={styles.executionStatus}>
            <span
              className={cn(styles.statusDot, isRunning && styles.statusDotRunning)}
            />
            <span>{isRunning ? "Executando" : "Python no servidor"}</span>
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
            <button
              type="button"
              className={styles.iconButton}
              data-active={terminalOpen}
              onClick={() => setTerminalOpen((open) => !open)}
              disabled={!server.unlocked}
              aria-label={terminalOpen ? "Fechar terminal" : "Abrir terminal"}
              aria-pressed={terminalOpen}
              title="Terminal (Ctrl+`)"
            >
              <TerminalSquare size={17} />
            </button>
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
                onClick={isRunning ? handleStop : () => void handleRun()}
                disabled={!isRunning && (!executable || !server.unlocked)}
                aria-label={isRunning ? "Parar execução" : "Executar arquivo"}
                title={isRunning ? "Parar execução" : "Executar arquivo (Ctrl+Enter)"}
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

        <button
          type="button"
          className={cn(styles.splitter, styles.splitterExplorer)}
          role="separator"
          aria-orientation="vertical"
          aria-label="Redimensionar explorador"
          onPointerDown={(event) => startDrag("explorer", event)}
          onDoubleClick={() => resetPanel("explorer")}
          onKeyDown={(event) => nudgePanel("explorer", event)}
        />
        {assistantOpen ? (
          <button
            type="button"
            className={cn(styles.splitter, styles.splitterAssistant)}
            role="separator"
            aria-orientation="vertical"
            aria-label="Redimensionar assistente"
            onPointerDown={(event) => startDrag("assistant", event)}
            onDoubleClick={() => resetPanel("assistant")}
            onKeyDown={(event) => nudgePanel("assistant", event)}
          />
        ) : null}

        <main ref={workbenchRef} className={styles.workbench}>
          {terminalOpen && server.unlocked ? (
            // O terminal toma a área editor/console inteira; o desmonte ao
            // voltar solta só o stream — a sessão bash segue viva no servidor
            // e o reabrir reanexa com replay.
            <StudioTerminal />
          ) : (
            <>
          <button
            type="button"
            className={cn(styles.splitter, styles.splitterConsole)}
            role="separator"
            aria-orientation="horizontal"
            aria-label="Redimensionar console"
            onPointerDown={(event) => startDrag("console", event)}
            onDoubleClick={() => resetPanel("console")}
            onKeyDown={(event) => nudgePanel("console", event)}
          />
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
                    onClick={() => serverController.selectFile(file.path)}
                  >
                    <span className={styles.tabBadge}>{fileBadge(file.name)}</span>
                    <span>{file.name}</span>
                  </button>
                  <button
                    type="button"
                    className={styles.tabClose}
                    aria-label={`Fechar ${file.name}`}
                    onClick={() => serverController.closeFile(file.path)}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>

            <div className={styles.breadcrumbs}>
              <div className={styles.breadcrumbTrail}>
                {breadcrumbs.map((segment, index) => (
                  <span key={`${segment}-${index}`}>
                    {index > 0 ? <ChevronRight size={12} /> : null}
                    <span>{segment}</span>
                  </span>
                ))}
              </div>
              {isMarkdownFile ? (
                <div
                  className={styles.viewToggle}
                  role="group"
                  aria-label="Modo de visualização do markdown"
                >
                  {MARKDOWN_VIEW_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={styles.viewToggleButton}
                      data-active={markdownView === option.value}
                      aria-pressed={markdownView === option.value}
                      onClick={() => setMarkdownView(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {server.enabled === true && !server.unlocked ? (
              <div className={styles.editorSurface}>
                <div className={styles.lockedState}>
                  <Lock size={20} />
                  <p>O workspace Python está bloqueado.</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => serverController.openUnlockPrompt()}
                  >
                    Desbloquear
                  </Button>
                </div>
              </div>
            ) : activeFile ? (
              isNotebookFile ? (
                <StudioNotebook
                  key={activeFile.path}
                  file={activeFile}
                  autocompleteEnabled={autocompleteEnabled}
                  assistantModelId={prefs.selectedModelId}
                  onAutocompleteStatusChange={setAutocompleteStatus}
                  onChange={handleEditorChange}
                />
              ) : isMarkdownFile && markdownView === "preview" ? (
                <StudioMarkdownPreview content={activeFile.content} />
              ) : isMarkdownFile && markdownView === "split" ? (
                <div className={styles.editorSplit}>
                  <StudioEditor
                    ref={editorRef}
                    file={activeFile}
                    autocompleteEnabled={autocompleteEnabled}
                    onAutocompleteStatusChange={setAutocompleteStatus}
                    onChange={handleEditorChange}
                    onRunShortcut={handleRunShortcut}
                  />
                  <StudioMarkdownPreview content={activeFile.content} />
                </div>
              ) : (
                <StudioEditor
                  ref={editorRef}
                  file={activeFile}
                  autocompleteEnabled={autocompleteEnabled}
                  onAutocompleteStatusChange={setAutocompleteStatus}
                  onChange={handleEditorChange}
                  onRunShortcut={handleRunShortcut}
                />
              )
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
              consoleFilePath ? `python ${consoleFilePath}` : undefined
            }
            onClear={() => serverController.clearRunSession()}
            onSendInput={(text) => void serverController.sendStdin(text)}
          />
            </>
          )}
        </main>

        {assistantOpen && activeFile ? (
          <StudioAssistantPanel
            file={activeFile}
            messages={prefs.assistantMessages}
            modelId={prefs.selectedModelId}
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
        open={server.unlockPromptOpen}
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

      <Dialog
        open={createKind !== null}
        onOpenChange={(open) => {
          if (!open) setCreateKind(null);
        }}
      >
        <DialogContent className="max-w-md rounded-2xl border-white/10 bg-background/95 p-6 shadow-2xl backdrop-blur-xl">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-base">
              {createKind === "folder" ? "Nova pasta" : "Novo arquivo"}
            </DialogTitle>
            <DialogDescription className="leading-relaxed">
              {createKind === "folder"
                ? "A pasta será criada em "
                : "O arquivo será criado em "}
              <span className="font-mono">
                {selectedFolderPath ? `${selectedFolderPath}/` : "raiz do workspace"}
              </span>
              . Clique numa pasta do explorador para mudar o destino.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreateSubmit();
            }}
            className="space-y-3"
          >
            <Input
              autoFocus
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder={createKind === "folder" ? "dados" : "script.py"}
              aria-label={
                createKind === "folder" ? "Nome da pasta" : "Nome do arquivo"
              }
            />
            <DialogFooter className="mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateKind(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={!createName.trim() || server.busy}>
                Criar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={`Excluir "${pendingDelete?.path ?? ""}"?`}
        description={
          pendingDelete?.kind === "directory"
            ? "A pasta e todo o conteúdo dela serão removidos do servidor. Não dá para desfazer."
            : "O arquivo será removido do servidor. Não dá para desfazer."
        }
        confirmLabel="Excluir"
        onConfirm={handleDeleteConfirm}
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
