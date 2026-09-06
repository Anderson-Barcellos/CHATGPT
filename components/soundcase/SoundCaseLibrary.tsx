"use client";

import { CalendarDays, ChevronDown, Clock3, FileAudio, FileText, Plus, Radio, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
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
  versions: SoundCaseVersionSummary[];
  player: ReactNode;
  expandedVersionId: string | null;
  busy?: boolean;
  selectedVersionId: string | null;
  /** Qual geração está soando agora e por qual fonte; `null` quando nada toca. */
  playback: SoundCasePlaybackState | null;
  /** Voz efetiva da versão selecionada; só a projeção completa conhece. */
  selectedVoice?: string | null;
  onCreate: () => void;
  onSelectProject: (id: string) => void;
  onSelectVersion: (id: string, projectId: string) => void;
  onResumeVersion: (id: string, projectId: string) => void;
  onDeleteVersion: (id: string, projectId: string) => void;
  onDeleteProject: (id: string) => void;
}

function VersionCard(props: {
  version: SoundCaseVersionSummary;
  selected: boolean;
  expanded: boolean;
  player: ReactNode;
  busy?: boolean;
  playback: SoundCasePlaybackState | null;
  selectedVoice?: string | null;
  onSelect: () => void;
  onResume: () => void;
  onDelete: () => void;
}) {
  const { version, selected, expanded } = props;
  const view = describeSoundCaseVersion(version);
  const playing = props.playback?.versionId === version.id ? props.playback : null;
  const coverReady = version.cover.status === "ready" || version.cover.status === "fallback";
  const resumable = version.status === "interrupted" || version.status === "failed";
  const durationSeconds = version.audio.status === "ready" ? version.audio.durationSeconds : version.estimatedDurationSeconds;

  return (
    <article data-slot="soundcase-version-card" className={styles.versionCard} data-active={selected} data-tone={view.tone}>
      <button type="button" className={styles.versionCardMain} disabled={props.busy} aria-expanded={expanded} aria-controls={`player-${version.id}`} aria-label={`${expanded ? "Recolher" : "Ouvir"} ${version.title}`} aria-current={selected ? "true" : undefined} onClick={props.onSelect}>
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
          {expanded && version.summary ? <p>{version.summary}</p> : null}
          {expanded ? (
            <dl>
              <div><dt><Clock3 /> Duração</dt><dd>{version.audio.status === "ready" ? "" : "~"}{Math.max(1, Math.ceil(durationSeconds / 60))} min</dd></div>
              {props.selectedVoice ? <div><dt><Sparkles /> Voz</dt><dd>{props.selectedVoice}</dd></div> : null}
              <div><dt><CalendarDays /> Criado</dt><dd>{new Date(version.createdAt).toLocaleDateString("pt-BR")}</dd></div>
            </dl>
          ) : null}
          <span className={styles.cardListen}>{expanded ? "Recolher player" : view.playable ? "Ouvir" : "Acompanhar"} <ChevronDown /></span>
        </div>
      </button>
      {/* Keep the selected audio element alive when its controls are collapsed. */}
      <div id={`player-${version.id}`} hidden={!expanded} className={styles.cardPlayer}>
        {selected ? props.player : null}
      </div>
      <div className={styles.versionCardActions}>
        {resumable ? <button type="button" className={styles.rowAction} aria-label={`Retomar geração ${version.title}`} onClick={props.onResume}><RotateCcw /></button> : null}
        <button type="button" className={styles.rowAction} aria-label={`Excluir geração ${version.title}`} onClick={props.onDelete}><Trash2 /></button>
      </div>
    </article>
  );
}

export function SoundCaseLibrary(props: SoundCaseLibraryProps) {
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "project" | "version"; id: string; projectId?: string; label: string } | null>(null);
  const sortedProjects = [...props.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const sortedVersions = [...props.versions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <aside className={styles.library} aria-label="Seus SoundCases">
      <div className={styles.libraryHeading}>
        <div><h1>Suas narrações</h1><p>{sortedVersions.length ? `${sortedVersions.length} no acervo · escolha uma para ouvir` : "Seus textos ganham voz e ficam guardados aqui."}</p></div>
        <button className={styles.newProject} disabled={props.busy} type="button" onClick={props.onCreate}><Plus /> Nova narração</button>
      </div>
        <div className={styles.audioGrid}>
          {sortedVersions.map((version) => (
            <VersionCard
              key={version.id}
              version={version}
              selected={version.id === props.selectedVersionId}
              expanded={version.id === props.expandedVersionId}
              player={props.player}
              busy={props.busy}
              playback={props.playback}
              selectedVoice={version.id === props.selectedVersionId ? props.selectedVoice : null}
              onSelect={() => props.onSelectVersion(version.id, version.projectId)}
              onResume={() => props.onResumeVersion(version.id, version.projectId)}
              onDelete={() => setDeleteTarget({ kind: "version", id: version.id, projectId: version.projectId, label: version.title })}
            />
          ))}
          {!sortedVersions.length ? <p className={styles.libraryEmpty}>Crie sua primeira narração. O cartão aparece assim que a geração começar.</p> : null}
        </div>
      {sortedProjects.length ? <details className={styles.savedTexts}>
        <summary><FileText /> Textos salvos e rascunhos <span>{sortedProjects.length}</span></summary>
        <div className={styles.projectList}>
          {sortedProjects.map((item) => (
            <div key={item.id} className={styles.savedTextRow}>
              <button disabled={props.busy} type="button" className={styles.projectRow} onClick={() => props.onSelectProject(item.id)}>
                <span><strong>{item.title}</strong><small>{item.activeVersionId ? "Consultar texto / criar outra versão" : "Continuar rascunho"}</small></span><FileText />
              </button>
              <button disabled={props.busy} className={styles.rowAction} aria-label={`Excluir projeto ${item.title}`} onClick={() => setDeleteTarget({ kind: "project", id: item.id, label: item.title })}><Trash2 /></button>
            </div>
          ))}
        </div>
      </details> : null}
      <ConfirmDialog
        open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={deleteTarget?.kind === "project" ? "Excluir SoundCase?" : "Excluir geração?"}
        description={`“${deleteTarget?.label ?? ""}” será removido do acervo privado.`}
        confirmLabel="Excluir"
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.kind === "project") props.onDeleteProject(deleteTarget.id);
          else props.onDeleteVersion(deleteTarget.id, deleteTarget.projectId!);
        }}
      />
    </aside>
  );
}
