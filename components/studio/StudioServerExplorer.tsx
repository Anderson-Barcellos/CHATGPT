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
  Folder,
  MessageCircle,
  RotateCcw,
  Settings,
  Upload,
  X,
} from "lucide-react";
import { GPTLogo } from "@/components/ui/gpt-logo";
import { cn } from "@/lib/utils";
import { languageForWorkspacePath } from "@/lib/studio/serverWorkspace";
import type { StudioServerTreeRow } from "@/lib/studio/serverWorkspace";
import styles from "@/components/studio/GauchoStudioShell.module.css";

interface StudioServerExplorerProps {
  tree: StudioServerTreeRow[];
  activeFilePath: string | null;
  busy: boolean;
  onOpenFile: (path: string) => void;
  onOpenSettings: () => void;
  onSaveProject: () => void;
  onRestoreProject: () => void;
  onImportProject: () => void;
  onResetProject: () => void;
  onClose?: () => void;
}

function iconForPath(path: string) {
  const language = languageForWorkspacePath(path);
  if (language === "json") return Braces;
  if (language === "markdown") return BookOpen;
  return FileCode2;
}

export function StudioServerExplorer({
  tree,
  activeFilePath,
  busy,
  onOpenFile,
  onOpenSettings,
  onSaveProject,
  onRestoreProject,
  onImportProject,
  onResetProject,
  onClose,
}: StudioServerExplorerProps) {
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

      <div className={styles.explorerHeading}>Explorador</div>
      <div className={styles.projectRow}>
        <strong>workspace-python</strong>
        <ChevronDown size={14} />
      </div>

      <div className={styles.fileTree}>
        {tree.length === 0 ? (
          <div className={styles.treeEmpty}>Workspace vazio.</div>
        ) : null}
        {tree.map(({ entry, depth }) => {
          if (entry.kind === "directory") {
            return (
              <div
                key={entry.path}
                className={styles.folderRow}
                style={{ paddingLeft: `${12 + depth * 17}px` }}
              >
                <ChevronDown className={styles.folderChevron} />
                <Folder className={styles.folderIcon} />
                <span>{entry.name}</span>
              </div>
            );
          }
          const Icon = iconForPath(entry.path);
          return (
            <button
              key={entry.path}
              type="button"
              onClick={() => onOpenFile(entry.path)}
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
