"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Library, Volume2, X } from "lucide-react";
import { toast } from "sonner";
import { DirectionSidebar } from "@/components/soundcase/DirectionSidebar";
import { SoundCaseEditor } from "@/components/soundcase/SoundCaseEditor";
import { SoundCaseLibrary } from "@/components/soundcase/SoundCaseLibrary";
import { SoundCaseMobileDock } from "@/components/soundcase/SoundCaseMobileDock";
import { SoundCasePlayer } from "@/components/soundcase/SoundCasePlayer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useSoundCaseRealtimeSession } from "@/components/soundcase/SoundCaseRealtimeProvider";
import { useSoundCase } from "@/hooks/useSoundCase";
import { buildSoundCaseRealtimeSegments } from "@/hooks/useSoundCaseRealtime";
import { soundCaseApi } from "@/lib/soundcase/api";
import { getSoundCaseProgress } from "@/lib/soundcase/progress";
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
  const [libraryOpen, setLibraryOpen] = useState(false);
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
  const progress = soundcase.selectedVersion ? getSoundCaseProgress(soundcase.selectedVersion) : null;
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
      progress={progress}
      disabled={soundcase.loading}
      onChange={soundcase.setDraftText}
      onImport={(file) => soundcase.importText(file).then(() => undefined)}
      onCreate={!soundcase.project ? () => {
        stopRealtimeContext();
        return soundcase.createProject({ title: "Novo SoundCase" }).then(() => undefined);
      } : undefined}
    />
  );

  const library = (closeAfterSelect: boolean) => (
    <SoundCaseLibrary
      projects={soundcase.projects} project={soundcase.project}
      selectedVersionId={selectedVersionId}
      playback={playback} selectedVoice={selectedVoice}
      onCreate={() => { stopRealtimeContext(); void soundcase.createProject({ title: "Novo SoundCase" }); }}
      onSelectProject={(id) => { stopRealtimeContext(); if (closeAfterSelect) setLibraryOpen(false); void soundcase.setActiveProjectId(id); }}
      onSelectVersion={(id) => { stopRealtimeContext(); if (closeAfterSelect) setLibraryOpen(false); void soundcase.selectVersion(id); }}
      onResumeVersion={(id) => { stopRealtimeContext(); void soundcase.resumeVersion(id); }}
      onDeleteVersion={(id) => { stopRealtimeContext(); void soundcase.deleteVersion(id); }}
      onDeleteProject={(id) => { stopRealtimeContext(); void soundcase.deleteProject(id); }}
    />
  );

  // O cartão com capa vive no acervo desde o início da geração; aqui fica só o player.
  const result = soundcase.selectedVersion ? (
    <SoundCasePlayer
      key={soundcase.selectedVersion.id}
      version={soundcase.selectedVersion}
      audioUrl={soundCaseApi.audioUrl(soundcase.selectedVersion.projectId, soundcase.selectedVersion.id)}
      realtime={realtime}
      onPlaybackChange={(playing) => setPlayingFinalVersionId(playing ? soundcase.selectedVersion?.id ?? null : null)}
    />
  ) : null;

  const conflictBar = soundcase.conflict ? (
    <div className={styles.conflictBar} role="alert">
      <span>Este texto mudou em outra aba. Seu conteúdo local foi preservado.</span>
      <button onClick={() => void soundcase.resolveConflict("local")}>Manter o meu</button>
      <button onClick={() => void soundcase.resolveConflict("server")}>Usar o salvo</button>
    </div>
  ) : null;

  if (isPanel) {
    return (
      <div className={styles.panelBody} data-variant="panel">
        <div className={styles.panelScroll}>
          <Collapsible open={directionOpen} onOpenChange={setDirectionOpen}>
            <CollapsibleTrigger className={styles.panelSectionTrigger} data-open={directionOpen}>
              <span>Direção de leitura</span>
              <ChevronDown />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <DirectionSidebar
                settings={settings} onChange={setSettings}
                onGenerate={(mode) => void generate(mode)}
                busy={generating} disabled={actionsDisabled} showActions={false}
              />
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={libraryOpen} onOpenChange={setLibraryOpen}>
            <CollapsibleTrigger className={styles.panelSectionTrigger} data-open={libraryOpen}>
              <span>Acervo</span>
              <ChevronDown />
            </CollapsibleTrigger>
            <CollapsibleContent>{library(false)}</CollapsibleContent>
          </Collapsible>

          {editor}
          <div className={styles.panelResult}>{result}</div>
        </div>

        <div className={styles.panelFooter}>
          <button type="button" className={styles.primaryAction} disabled={actionsDisabled || generating} onClick={() => void generate("realtime")}>
            <Volume2 /> {generating ? "Preparando…" : "Gerar e ouvir agora"}
          </button>
        </div>
        {conflictBar}
      </div>
    );
  }

  return (
    <div className={styles.pageBody} data-variant="page">
      <div className={styles.workspace}>
        <DirectionSidebar settings={settings} onChange={setSettings} onGenerate={(mode) => void generate(mode)} busy={generating} disabled={actionsDisabled} />
        {editor}
        <div className={styles.resultRail}>
          {result}
          {library(false)}
        </div>
      </div>
      <SoundCaseMobileDock onDirection={() => setDirectionOpen(true)} onLibrary={() => setLibraryOpen(true)} onGenerate={() => void generate("realtime")} disabled={actionsDisabled || generating} />
      <button type="button" className={styles.tabletLibraryTrigger} aria-label="Abrir acervo" onClick={() => setLibraryOpen(true)}><Library /></button>
      <Sheet open={directionOpen} onOpenChange={setDirectionOpen}>
        <SheetContent side="bottom" showCloseButton={false} className={styles.sheetPanel}>
          <SheetHeader className={styles.sheetHeader}>
            <div>
              <SheetTitle>Direção de leitura</SheetTitle>
              <SheetDescription>Ajuste voz, ritmo e formato; Luna continua como padrão.</SheetDescription>
            </div>
            <button type="button" className={styles.sheetClose} aria-label="Fechar direção de leitura" onClick={() => setDirectionOpen(false)}><X /></button>
          </SheetHeader>
          <DirectionSidebar settings={settings} onChange={setSettings} onGenerate={(mode) => { setDirectionOpen(false); void generate(mode); }} busy={generating} disabled={actionsDisabled} />
        </SheetContent>
      </Sheet>
      <Sheet open={libraryOpen} onOpenChange={setLibraryOpen}>
        <SheetContent side="right" showCloseButton={false} className={styles.sheetPanel}>
          <SheetHeader className={styles.sheetHeader}>
            <div>
              <SheetTitle>Acervo</SheetTitle>
              <SheetDescription>Projetos e gerações privadas.</SheetDescription>
            </div>
            <button type="button" className={styles.sheetClose} aria-label="Fechar acervo" onClick={() => setLibraryOpen(false)}><X /></button>
          </SheetHeader>
          {library(true)}
        </SheetContent>
      </Sheet>
      {conflictBar}
    </div>
  );
}
