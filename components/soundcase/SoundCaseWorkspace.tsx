"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { DirectionSidebar } from "@/components/soundcase/DirectionSidebar";
import { SoundCaseEditor } from "@/components/soundcase/SoundCaseEditor";
import { SoundCaseLibrary } from "@/components/soundcase/SoundCaseLibrary";
import { SoundCasePlayer } from "@/components/soundcase/SoundCasePlayer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useSoundCaseRealtimeSession } from "@/components/soundcase/SoundCaseRealtimeProvider";
import { useSoundCase } from "@/hooks/useSoundCase";
import { useSoundCaseLibrary } from "@/hooks/useSoundCaseLibrary";
import { buildSoundCaseRealtimeSegments } from "@/hooks/useSoundCaseRealtime";
import { soundCaseApi } from "@/lib/soundcase/api";
import type { SoundCaseGenerationSettings } from "@/lib/soundcase/types";
import styles from "./SoundCase.module.css";

const DEFAULT_SETTINGS: SoundCaseGenerationSettings = {
  automatic: true, playbackMode: "realtime", format: "mp3",
  voiceOverride: null, speedOverride: null, instructionsOverride: null,
};

export type SoundCaseWorkspaceVariant = "page" | "panel";

export function prepareSoundCaseRealtimeGeneration(stop: () => void, prime: () => void) {
  stop();
  prime();
}

export function SoundCaseWorkspace({ variant = "page" }: { variant?: SoundCaseWorkspaceVariant }) {
  const soundcase = useSoundCase();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [generating, setGenerating] = useState(false);
  const [directionOpen, setDirectionOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);
  const navigationRef = useRef(false);
  const library = useSoundCaseLibrary(soundcase.projects, soundcase.project, soundcase.selectedVersion);
  const [pendingRealtimeVersionId, setPendingRealtimeVersionId] = useState<string | null>(null);
  // Guarda a versão cujo arquivo está tocando: trocar de versão invalida sozinho, sem effect.
  const [playingFinalVersionId, setPlayingFinalVersionId] = useState<string | null>(null);
  const realtimeTextRef = useRef("");
  const startedRealtimeVersionRef = useRef<string | null>(null);
  const realtime = useSoundCaseRealtimeSession();
  const isPanel = variant === "panel";

  const stopRealtimeContext = () => {
    realtime.stop();
    setPendingRealtimeVersionId(null);
    startedRealtimeVersionRef.current = null;
  };
  const words = useMemo(() => {
    const text = soundcase.draftText.trim();
    return text ? text.split(/\s+/u).length : 0;
  }, [soundcase.draftText]);
  const estimate = Math.ceil((words / 150 / (settings.speedOverride ?? 1)) * 60);
  const overLimit = estimate > 90 * 60 || new TextEncoder().encode(soundcase.draftText).byteLength > 1024 * 1024;
  const actionsDisabled = !words || overLimit || Boolean(soundcase.conflict);
  const selectedVersionId = soundcase.selectedVersion?.id ?? null;
  // Realtime tem precedência: o player interrompe o arquivo antes de iniciar a leitura ao vivo.
  const playback = realtime.isActive && realtime.versionId
    ? { versionId: realtime.versionId, source: "realtime" as const }
    : playingFinalVersionId && playingFinalVersionId === selectedVersionId
      ? { versionId: selectedVersionId, source: "file" as const }
      : null;
  const selectedVoice = soundcase.selectedVersion?.effectiveSettings?.voice.value ?? soundcase.selectedVersion?.direction?.voice ?? null;

  useEffect(() => {
    const version = soundcase.selectedVersion;
    if (!version || version.id !== pendingRealtimeVersionId || !version.direction || !version.effectiveSettings || startedRealtimeVersionRef.current === version.id) return;
    startedRealtimeVersionRef.current = version.id;
    setPendingRealtimeVersionId(null);
    void realtime.start({
      projectId: version.projectId,
      versionId: version.id,
      segments: buildSoundCaseRealtimeSegments(realtimeTextRef.current),
    });
  }, [pendingRealtimeVersionId, realtime, soundcase.selectedVersion]);

  const generate = async (playbackMode: "realtime" | "silent") => {
    if (playbackMode === "realtime") {
      prepareSoundCaseRealtimeGeneration(stopRealtimeContext, realtime.prime);
      realtimeTextRef.current = soundcase.draftText;
      startedRealtimeVersionRef.current = null;
    } else {
      realtime.stop();
    }
    setGenerating(true);
    try {
      const version = await soundcase.generate({ ...settings, playbackMode });
      setPendingRealtimeVersionId(playbackMode === "realtime" ? version.id : null);
      setExpandedVersionId(version.id);
      setEditorOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível iniciar a geração.");
    } finally { setGenerating(false); }
  };

  const editor = (
    <SoundCaseEditor
      title={soundcase.project?.title ?? ""}
      text={soundcase.draftText}
      wordCount={words}
      estimatedDurationSeconds={estimate}
      disabled={soundcase.loading || generating || navigating}
      onChange={soundcase.setDraftText}
      onImport={(file) => soundcase.importText(file).then(() => undefined)}
      onCreate={!soundcase.project ? () => {
        stopRealtimeContext();
        return soundcase.createProject({ title: "Novo SoundCase" }).then(() => undefined);
      } : undefined}
    />
  );

  const navigate = async (action: () => Promise<unknown>) => {
    if (navigationRef.current || generating) return;
    navigationRef.current = true;
    setNavigating(true);
    try { await action(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível abrir a narração."); }
    finally { navigationRef.current = false; setNavigating(false); }
  };

  const result = soundcase.selectedVersion ? (
    <SoundCasePlayer
      key={soundcase.selectedVersion.id}
      version={soundcase.selectedVersion}
      audioUrl={soundCaseApi.audioUrl(soundcase.selectedVersion.projectId, soundcase.selectedVersion.id)}
      realtime={{ ...realtime, isActive: realtime.isActive && realtime.versionId === selectedVersionId }}
      onPlaybackChange={(playing) => setPlayingFinalVersionId(playing ? selectedVersionId : null)}
    />
  ) : null;

  return (
    <div className={isPanel ? styles.panelBody : styles.acervoBody} data-variant={variant}>
      <div className={styles.acervoScroll}>
        {soundcase.error ? <p className={styles.acervoError} role="alert">{soundcase.error}</p> : null}
        {soundcase.loading ? <p className={styles.libraryEmpty} role="status">Carregando suas narrações…</p> : null}
        <section hidden={!editorOpen} className={styles.creation} aria-label="Criar narração">
          <div className={styles.creationHeading}>
            <button type="button" disabled={generating || navigating} onClick={() => setEditorOpen(false)}><ArrowLeft /> Voltar ao acervo</button>
            <span>{soundcase.saving ? "Salvando…" : soundcase.isDirty ? "Salvamento pendente" : "Texto salvo"}</span>
          </div>
          {editorOpen ? editor : null}
          <Collapsible open={directionOpen} onOpenChange={setDirectionOpen}>
            <CollapsibleTrigger className={styles.panelSectionTrigger} data-open={directionOpen}>
              <span>Voz e direção de leitura</span><ChevronDown />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <DirectionSidebar settings={settings} onChange={setSettings} onGenerate={(mode) => void generate(mode)}
                busy={generating} disabled={actionsDisabled} showActions={false} />
            </CollapsibleContent>
          </Collapsible>
          <div className={styles.creationActions}>
            <button className={styles.primaryAction} type="button" disabled={actionsDisabled || generating || navigating} onClick={() => void generate("realtime")}>
              {generating ? "Preparando…" : "Gerar e ouvir agora"}
            </button>
            <button className={styles.secondaryAction} type="button" disabled={actionsDisabled || generating || navigating} onClick={() => void generate("silent")}>Gerar somente arquivo</button>
          </div>
        </section>
        <div hidden={editorOpen}>
          {library.error ? <p className={styles.acervoError} role="alert">{library.error} <button onClick={library.retry}>Tentar novamente</button></p> : null}
          {library.loading ? <p className={styles.libraryEmpty} role="status">Atualizando o acervo…</p> : null}
          <SoundCaseLibrary
            projects={soundcase.projects} project={soundcase.project} versions={library.versions}
            selectedVersionId={selectedVersionId} expandedVersionId={expandedVersionId} player={result}
            playback={playback} selectedVoice={selectedVoice} busy={navigating || generating || soundcase.loading}
            onCreate={() => void navigate(async () => {
              stopRealtimeContext();
              await soundcase.createProject({ title: "Nova narração" });
              setEditorOpen(true);
            })}
            onSelectProject={(id) => void navigate(async () => {
              if (id !== soundcase.project?.id) {
                stopRealtimeContext();
                await soundcase.setActiveProjectId(id);
              }
              setEditorOpen(true);
            })}
            onSelectVersion={(id, projectId) => {
              if (id === selectedVersionId) {
                setExpandedVersionId((current) => current === id ? null : id);
                return;
              }
              void navigate(async () => {
                stopRealtimeContext();
                await soundcase.selectVersion(id, projectId);
                setPlayingFinalVersionId(null);
                setExpandedVersionId(id);
              });
            }}
            onResumeVersion={(id, projectId) => void navigate(async () => {
              stopRealtimeContext();
              await soundcase.resumeVersion(id, projectId);
              setExpandedVersionId(id);
            })}
            onDeleteVersion={(id, projectId) => void navigate(async () => {
              stopRealtimeContext();
              await soundcase.deleteVersion(id, projectId);
              await soundcase.refreshProjects();
            })}
            onDeleteProject={(id) => void navigate(async () => {
              stopRealtimeContext();
              await soundcase.deleteProject(id);
            })}
          />
        </div>
      </div>
      {soundcase.conflict ? (
        <div className={styles.conflictBar} role="alert">
          <span>Este texto mudou em outra aba. Seu conteúdo local foi preservado.</span>
          <button onClick={() => void soundcase.resolveConflict("local")}>Manter o meu</button>
          <button onClick={() => void soundcase.resolveConflict("server")}>Usar o salvo</button>
        </div>
      ) : null}
    </div>
  );
}
