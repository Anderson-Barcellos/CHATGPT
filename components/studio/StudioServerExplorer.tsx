"use client";

import Link from "next/link";
import {
  ArchiveRestore,
  BookOpen,
  Braces,
  ChevronDown,
  Code2,
  Download,
  FileCode2,
  FilePlus2,
  Folder,
  FolderPlus,
  FolderTree,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  Settings,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { GPTLogo } from "@/components/ui/gpt-logo";
import { cn } from "@/lib/utils";
import {
  filterVisibleTreeRows,
  languageForWorkspacePath,
} from "@/lib/studio/serverWorkspace";
import type { StudioServerTreeRow } from "@/lib/studio/serverWorkspace";
import styles from "@/components/studio/GauchoStudioShell.module.css";

interface StudioServerExplorerProps {
  tree: StudioServerTreeRow[];
  activeFilePath: string | null;
  busy: boolean;
  selectedFolderPath?: string | null;
  onOpenFile: (path: string) => void;
  onSelectFolder?: (path: string | null) => void;
  onCreateFile?: () => void;
  onCreateFolder?: () => void;
  onDeleteEntry?: (path: string, kind: "file" | "directory") => void;
  onOpenSettings: () => void;
  onSaveProject: () => void;
  onRestoreProject: () => void;
  onImportProject: () => void;
  onResetProject: () => void;
  onRefreshTree?: () => void;
  onExpand?: () => void;
  onClose?: () => void;
}

function iconForPath(path: string) {
  const language = languageForWorkspacePath(path);
  if (language === "json") return Braces;
  if (language === "markdown") return BookOpen;
  return FileCode2;
}

function parentFolderOf(path: string): string | null {
  const separator = path.lastIndexOf("/");
  return separator === -1 ? null : path.slice(0, separator);
}

export function StudioServerExplorer({
  tree,
  activeFilePath,
  busy,
  selectedFolderPath = null,
  onOpenFile,
  onSelectFolder,
  onCreateFile,
  onCreateFolder,
  onDeleteEntry,
  onOpenSettings,
  onSaveProject,
  onRestoreProject,
  onImportProject,
  onResetProject,
  onRefreshTree,
  onExpand,
  onClose,
}: StudioServerExplorerProps) {
  const [collapsedPaths, setCollapsedPaths] = useState<ReadonlySet<string>>(
    new Set()
  );
  const visibleRows = useMemo(
    () => filterVisibleTreeRows(tree, collapsedPaths),
    [tree, collapsedPaths]
  );

  const toggleFolder = (path: string) => {
    setCollapsedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
    onSelectFolder?.(path);
  };

  return (
    <aside className={styles.sidebar} aria-label="Navegação e arquivos do Studio">
      <div className={styles.brandRow}>
        <div className={styles.brandMark}>
          <GPTLogo size={25} />
        </div>
        <span className={styles.brandTitle}>Gaucho Studio</span>
        {onClose ? (
          <button
            type="button"
            className={styles.sidebarCloseButton}
            onClick={onClose}
            aria-label="Fechar explorador"
          >
            <X size={17} />
          </button>
        ) : null}
      </div>

      <nav className={styles.productNav} aria-label="Produtos Gaucho">
        <Link href="/" className={styles.productNavItem}>
          <MessageCircle size={17} />
          <span>Chat</span>
        </Link>
        <span className={cn(styles.productNavItem, styles.productNavItemActive)}>
          <Code2 size={17} />
          <span>Studio</span>
        </span>
      </nav>

      {onExpand ? (
        <button
          type="button"
          className={styles.railExpandButton}
          onClick={onExpand}
          aria-label="Abrir explorador"
          title="Abrir explorador de arquivos"
        >
          <FolderTree size={17} />
        </button>
      ) : null}

      <div className={styles.explorerHeading}>Explorador</div>
      <div className={styles.projectRow}>
        <button
          type="button"
          className={styles.projectRootButton}
          onClick={() => onSelectFolder?.(null)}
          aria-pressed={selectedFolderPath === null}
          title="Criar na raiz do workspace"
        >
          <strong>workspace-python</strong>
          <ChevronDown size={14} />
        </button>
        <div className={styles.treeActions}>
          {onCreateFile ? (
            <button
              type="button"
              className={styles.treeActionButton}
              onClick={onCreateFile}
              disabled={busy}
              aria-label="Novo arquivo"
              title={
                selectedFolderPath
                  ? `Novo arquivo em ${selectedFolderPath}/`
                  : "Novo arquivo na raiz"
              }
            >
              <FilePlus2 size={13} />
            </button>
          ) : null}
          {onCreateFolder ? (
            <button
              type="button"
              className={styles.treeActionButton}
              onClick={onCreateFolder}
              disabled={busy}
              aria-label="Nova pasta"
              title={
                selectedFolderPath
                  ? `Nova pasta em ${selectedFolderPath}/`
                  : "Nova pasta na raiz"
              }
            >
              <FolderPlus size={13} />
            </button>
          ) : null}
          {onRefreshTree ? (
            <button
              type="button"
              className={styles.treeActionButton}
              onClick={onRefreshTree}
              disabled={busy}
              aria-label="Atualizar arquivos"
              title="Atualizar lista de arquivos"
            >
              <RefreshCw size={13} />
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.fileTree}>
        {tree.length === 0 ? (
          <div className={styles.treeEmpty}>Workspace vazio.</div>
        ) : null}
        {visibleRows.map(({ entry, depth }) => {
          if (entry.kind === "directory") {
            const collapsed = collapsedPaths.has(entry.path);
            return (
              <div key={entry.path} className={styles.treeRow}>
                <button
                  type="button"
                  className={cn(
                    styles.folderRow,
                    entry.path === selectedFolderPath &&
                      styles.folderRowSelected
                  )}
                  style={{ paddingLeft: `${12 + depth * 17}px` }}
                  onClick={() => toggleFolder(entry.path)}
                  aria-expanded={!collapsed}
                  aria-pressed={entry.path === selectedFolderPath}
                >
                  <ChevronDown
                    className={cn(
                      styles.folderChevron,
                      collapsed && styles.folderChevronClosed
                    )}
                  />
                  <Folder className={styles.folderIcon} />
                  <span>{entry.name}</span>
                </button>
                {onDeleteEntry ? (
                  <button
                    type="button"
                    className={styles.treeDeleteButton}
                    onClick={() => onDeleteEntry(entry.path, "directory")}
                    disabled={busy}
                    aria-label={`Excluir ${entry.name}`}
                    title={`Excluir a pasta ${entry.name}`}
                  >
                    <Trash2 size={13} />
                  </button>
                ) : null}
              </div>
            );
          }
          const Icon = iconForPath(entry.path);
          return (
            <div key={entry.path} className={styles.treeRow}>
              <button
                type="button"
                onClick={() => {
                  onOpenFile(entry.path);
                  onSelectFolder?.(parentFolderOf(entry.path));
                }}
                disabled={!entry.editable}
                aria-current={entry.path === activeFilePath ? "page" : undefined}
                className={cn(
                  styles.fileRow,
                  entry.path === activeFilePath && styles.fileRowActive
                )}
                style={{ paddingLeft: `${14 + depth * 17}px` }}
                title={
                  entry.editable
                    ? undefined
                    : "Arquivo binário ou grande demais para editar"
                }
              >
                <Icon className={styles.fileIcon} aria-hidden="true" />
                <span>{entry.name}</span>
              </button>
              {onDeleteEntry ? (
                <button
                  type="button"
                  className={styles.treeDeleteButton}
                  onClick={() => onDeleteEntry(entry.path, "file")}
                  disabled={busy}
                  aria-label={`Excluir ${entry.name}`}
                  title={`Excluir ${entry.name}`}
                >
                  <Trash2 size={13} />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className={styles.serverActions} aria-label="Ciclo de vida do projeto">
        <button type="button" disabled={busy} onClick={onSaveProject}>
          <Download size={15} />
          <span>Salvar projeto</span>
        </button>
        <button type="button" disabled={busy} onClick={onRestoreProject}>
          <ArchiveRestore size={15} />
          <span>Restaurar</span>
        </button>
        <button type="button" disabled={busy} onClick={onImportProject}>
          <Upload size={15} />
          <span>Importar zip</span>
        </button>
        <button type="button" disabled={busy} onClick={onResetProject}>
          <RotateCcw size={15} />
          <span>Novo projeto</span>
        </button>
      </div>

      <button
        type="button"
        className={styles.settingsButton}
        onClick={onOpenSettings}
      >
        <Settings size={17} />
        <span>Configurações</span>
      </button>
    </aside>
  );
}
