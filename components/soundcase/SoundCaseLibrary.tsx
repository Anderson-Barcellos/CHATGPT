"use client";

import { CalendarDays, Clock3, FileAudio, MoreVertical, Plus, Radio, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { soundCaseApi } from "@/lib/soundcase/api";
import { describeSoundCaseVersion } from "@/lib/soundcase/progress";
import type { SoundCaseProject, SoundCaseProjectDetail, SoundCaseVersionSummary } from "@/lib/soundcase/types";
import styles from "./SoundCase.module.css";

/* eslint-disable @next/next/no-img-element -- Private cover URLs require the authenticated browser request; the Next image optimizer cannot replay that session. */

export interface SoundCasePlaybackState {
  versionId: string;
  source: "realtime" | "file";
}

export interface SoundCaseLibraryProps {
  projects: SoundCaseProject[];
  project: SoundCaseProjectDetail | null;
  selectedVersionId: string | null;
  /** Qual geração está soando agora e por qual fonte; `null` quando nada toca. */
  playback: SoundCasePlaybackState | null;
  /** Voz efetiva da versão selecionada; só a projeção completa conhece. */
  selectedVoice?: string | null;
  onCreate: () => void;
  onSelectProject: (id: string) => void;
  onSelectVersion: (id: string) => void;
  onResumeVersion: (id: string) => void;
  onDeleteVersion: (id: string) => void;
  onDeleteProject: (id: string) => void;
}

function VersionCard(props: {
  version: SoundCaseVersionSummary;
  selected: boolean;
  playback: SoundCasePlaybackState | null;
  selectedVoice?: string | null;
  onSelect: () => void;
  onResume: () => void;
  onDelete: () => void;
}) {
  const { version, selected } = props;
  const view = describeSoundCaseVersion(version);
  const playing = props.playback?.versionId === version.id ? props.playback : null;
  const coverReady = version.cover.status === "ready" || version.cover.status === "fallback";
  const resumable = version.status === "interrupted" || version.status === "failed";
  const durationSeconds = version.audio.status === "ready" ? version.audio.durationSeconds : version.estimatedDurationSeconds;

  return (
    <article data-slot="soundcase-version-card" className={styles.versionCard} data-active={selected} data-tone={view.tone}>
      <button type="button" className={styles.versionCardMain} aria-current={selected ? "true" : undefined} onClick={props.onSelect}>
        <div className={styles.coverFrame}>
          {coverReady
            ? <img src={soundCaseApi.coverUrl(version.projectId, version.id)} alt={`Capa de ${version.title}`} />
            : <div className={styles.coverPending}><Sparkles /> Criando capa</div>}
        </div>
        <div className={styles.versionCopy}>
          <strong>{version.title}</strong>
          {playing ? (
            <span className={styles.versionPlaying}>
              {playing.source === "realtime" ? <Radio /> : <FileAudio />}
              {playing.source === "realtime" ? "Tocando · Realtime" : "Tocando · arquivo"}
            </span>
          ) : null}
          <small className={styles.versionStatus} data-tone={view.tone}>{view.label}</small>
          {view.tone === "active" ? <span className={styles.versionMeter} aria-hidden><span style={{ width: `${Math.round(view.ratio * 100)}%` }} /></span> : null}
          {selected && version.summary ? <p>{version.summary}</p> : null}
          {selected ? (
            <dl>
              <div><dt><Clock3 /> Duração</dt><dd>{version.audio.status === "ready" ? "" : "~"}{Math.max(1, Math.ceil(durationSeconds / 60))} min</dd></div>
              {props.selectedVoice ? <div><dt><Sparkles /> Voz</dt><dd>{props.selectedVoice}</dd></div> : null}
              <div><dt><CalendarDays /> Criado</dt><dd>{new Date(version.createdAt).toLocaleDateString("pt-BR")}</dd></div>
            </dl>
          ) : null}
        </div>
      </button>
      <div className={styles.versionCardActions}>
        {resumable ? <button type="button" className={styles.rowAction} aria-label={`Retomar geração ${version.title}`} onClick={props.onResume}><RotateCcw /></button> : null}
        <button type="button" className={styles.rowAction} aria-label={`Excluir geração ${version.title}`} onClick={props.onDelete}><Trash2 /></button>
      </div>
    </article>
  );
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
            <VersionCard
              key={version.id}
              version={version}
              selected={version.id === props.selectedVersionId}
              playback={props.playback}
              selectedVoice={version.id === props.selectedVersionId ? props.selectedVoice : null}
              onSelect={() => props.onSelectVersion(version.id)}
              onResume={() => props.onResumeVersion(version.id)}
              onDelete={() => setDeleteTarget({ kind: "version", id: version.id, label: version.title })}
            />
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
