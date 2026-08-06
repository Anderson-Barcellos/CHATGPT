"use client";

import Link from "next/link";
import {
  BookOpen,
  Braces,
  ChevronDown,
  Code2,
  FileCode2,
  Folder,
  FolderOpen,
  MessageCircle,
  Settings,
  X,
} from "lucide-react";
import { GPTLogo } from "@/components/ui/gpt-logo";
import { cn } from "@/lib/utils";
import type { StudioFile } from "@/lib/studio/types";
import styles from "@/components/studio/GauchoStudioShell.module.css";

interface StudioExplorerProps {
  files: Record<string, StudioFile>;
  activeFilePath: string;
  onOpenFile: (path: string) => void;
  onOpenSettings: () => void;
  onClose?: () => void;
}

const ICON_BY_LANGUAGE = {
  typescript: FileCode2,
  javascript: FileCode2,
  json: Braces,
  markdown: BookOpen,
  plaintext: FileCode2,
} as const;

function FileRow({
  file,
  active,
  depth,
  onClick,
}: {
  file: StudioFile;
  active: boolean;
  depth: number;
  onClick: () => void;
}) {
  const Icon = ICON_BY_LANGUAGE[file.language];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(styles.fileRow, active && styles.fileRowActive)}
      style={{ paddingLeft: `${14 + depth * 17}px` }}
    >
      <Icon className={styles.fileIcon} aria-hidden="true" />
      <span>{file.name}</span>
    </button>
  );
}

function FolderRow({ label, depth = 0, open = false }: { label: string; depth?: number; open?: boolean }) {
  const FolderIcon = open ? FolderOpen : Folder;
  return (
    <div
      className={styles.folderRow}
      style={{ paddingLeft: `${12 + depth * 17}px` }}
    >
      <ChevronDown
        className={cn(styles.folderChevron, !open && styles.folderChevronClosed)}
      />
      <FolderIcon className={styles.folderIcon} />
      <span>{label}</span>
    </div>
  );
}

export function StudioExplorer({
  files,
  activeFilePath,
  onOpenFile,
  onOpenSettings,
  onClose,
}: StudioExplorerProps) {
  const file = (path: string) => files[path];

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
        <strong>calculadora-app</strong>
        <ChevronDown size={14} />
      </div>

      <div className={styles.fileTree}>
        <FolderRow label="src" open />
        <FolderRow label="utils" depth={1} open />
        {file("src/utils/calculadora.ts") ? (
          <FileRow
            file={file("src/utils/calculadora.ts")}
            active={activeFilePath === "src/utils/calculadora.ts"}
            depth={2}
            onClick={() => onOpenFile("src/utils/calculadora.ts")}
          />
        ) : null}
        {file("src/index.ts") ? (
          <FileRow
            file={file("src/index.ts")}
            active={activeFilePath === "src/index.ts"}
            depth={1}
            onClick={() => onOpenFile("src/index.ts")}
          />
        ) : null}
        {file("src/tipos.ts") ? (
          <FileRow
            file={file("src/tipos.ts")}
            active={activeFilePath === "src/tipos.ts"}
            depth={1}
            onClick={() => onOpenFile("src/tipos.ts")}
          />
        ) : null}
        <FolderRow label="tests" />
        <FolderRow label="dist" />
        <FolderRow label="node_modules" />
        {file("package.json") ? (
          <FileRow
            file={file("package.json")}
            active={activeFilePath === "package.json"}
            depth={0}
            onClick={() => onOpenFile("package.json")}
          />
        ) : null}
        {file("tsconfig.json") ? (
          <FileRow
            file={file("tsconfig.json")}
            active={activeFilePath === "tsconfig.json"}
            depth={0}
            onClick={() => onOpenFile("tsconfig.json")}
          />
        ) : null}
        {file("README.md") ? (
          <FileRow
            file={file("README.md")}
            active={activeFilePath === "README.md"}
            depth={0}
            onClick={() => onOpenFile("README.md")}
          />
        ) : null}
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
