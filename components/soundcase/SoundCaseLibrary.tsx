"use client";

import { MoreVertical, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { SoundCaseProject, SoundCaseProjectDetail } from "@/lib/soundcase/types";
import styles from "./SoundCase.module.css";

export interface SoundCaseLibraryProps {
  projects: SoundCaseProject[];
  project: SoundCaseProjectDetail | null;
  selectedVersionId: string | null;
  onCreate: () => void;
  onSelectProject: (id: string) => void;
  onSelectVersion: (id: string) => void;
  onResumeVersion: (id: string) => void;
  onDeleteVersion: (id: string) => void;
  onDeleteProject: (id: string) => void;
}

export function SoundCaseLibrary(props: SoundCaseLibraryProps) {
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "project" | "version"; id: string; label: string } | null>(null);
  const sortedProjects = [...props.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const sortedVersions = [...(props.project?.versions ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <aside className={styles.library} aria-label="Seus SoundCases">
      <div className={styles.sideHeading}>Seus SoundCases <span>{props.projects.length}</span></div>
      <button className={styles.newProject} type="button" onClick={props.onCreate}><Plus /> Novo SoundCase</button>
      <div className={styles.projectList}>
        {sortedProjects.map((item) => (
          <button key={item.id} type="button" className={styles.projectRow} data-active={item.id === props.project?.id} aria-current={item.id === props.project?.id ? "true" : undefined} onClick={() => props.onSelectProject(item.id)}>
            <span><strong>{item.title}</strong><small>{new Date(item.updatedAt).toLocaleDateString("pt-BR")}</small></span>
            <MoreVertical />
          </button>
        ))}
      </div>
      {props.project ? (
        <div className={styles.versionList}>
          <div className={styles.librarySubhead}><span>Gerações</span><button aria-label={`Excluir projeto ${props.project.title}`} onClick={() => setDeleteTarget({ kind: "project", id: props.project!.id, label: props.project!.title })}><Trash2 /></button></div>
          {sortedVersions.map((version) => (
            <div key={version.id} className={styles.versionRow} data-active={version.id === props.selectedVersionId}>
              <button type="button" onClick={() => props.onSelectVersion(version.id)}>
                <strong>{version.title}</strong>
                <small>{version.status === "interrupted" ? "Interrompido" : version.status === "failed" ? "Falhou" : version.status === "ready" ? "Pronto" : `${Math.round(version.progress.ratio * 100)}% · ${version.status}`}</small>
              </button>
              {version.status === "interrupted" || version.status === "failed" ? <button className={styles.rowAction} aria-label={`Retomar geração ${version.title}`} onClick={() => props.onResumeVersion(version.id)}><RotateCcw /></button> : null}
              <button className={styles.rowAction} aria-label={`Excluir geração ${version.title}`} onClick={() => setDeleteTarget({ kind: "version", id: version.id, label: version.title })}><Trash2 /></button>
            </div>
          ))}
          {!sortedVersions.length ? <p className={styles.libraryEmpty}>As gerações concluídas ficam reunidas aqui.</p> : null}
        </div>
      ) : null}
      <ConfirmDialog
        open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={deleteTarget?.kind === "project" ? "Excluir SoundCase?" : "Excluir geração?"}
        description={`“${deleteTarget?.label ?? ""}” será removido do acervo privado.`}
        confirmLabel="Excluir"
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.kind === "project") props.onDeleteProject(deleteTarget.id);
          else props.onDeleteVersion(deleteTarget.id);
        }}
      />
    </aside>
  );
}
