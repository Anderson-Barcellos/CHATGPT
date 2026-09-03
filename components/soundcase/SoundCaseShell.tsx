"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Library } from "lucide-react";
import { toast } from "sonner";
import { DirectionSidebar } from "@/components/soundcase/DirectionSidebar";
import { ProductNav } from "@/components/navigation/ProductNav";
import { SoundCaseEditor } from "@/components/soundcase/SoundCaseEditor";
import { SoundCaseLibrary } from "@/components/soundcase/SoundCaseLibrary";
import { SoundCaseMobileDock } from "@/components/soundcase/SoundCaseMobileDock";
import { SoundCasePlayer } from "@/components/soundcase/SoundCasePlayer";
import { SoundCaseResult } from "@/components/soundcase/SoundCaseResult";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useSoundCase } from "@/hooks/useSoundCase";
import { buildSoundCaseRealtimeSegments, useSoundCaseRealtime } from "@/hooks/useSoundCaseRealtime";
import { soundCaseApi } from "@/lib/soundcase/api";
import { getSoundCaseProgress } from "@/lib/soundcase/progress";
import type { SoundCaseGenerationSettings } from "@/lib/soundcase/types";
import styles from "./SoundCase.module.css";

const DEFAULT_SETTINGS: SoundCaseGenerationSettings = {
  automatic: true, playbackMode: "realtime", format: "mp3",
  voiceOverride: null, speedOverride: null, instructionsOverride: null,
};

export function prepareSoundCaseRealtimeGeneration(stop: () => void, prime: () => void) {
  stop();
  prime();
}

export function SoundCaseShell() {
  const soundcase = useSoundCase();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [generating, setGenerating] = useState(false);
  const [directionOpen, setDirectionOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [pendingRealtimeVersionId, setPendingRealtimeVersionId] = useState<string | null>(null);
  const realtimeTextRef = useRef("");
  const startedRealtimeVersionRef = useRef<string | null>(null);
  const realtime = useSoundCaseRealtime();

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

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}><span />Gaucho SoundCase</div>
        <ProductNav active="soundcase" />
      </header>
      <div className={styles.workspace}>
        <DirectionSidebar settings={settings} onChange={setSettings} onGenerate={(mode) => void generate(mode)} busy={generating} disabled={!words || overLimit || Boolean(soundcase.conflict)} />
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
        <div className={styles.resultRail}>
          {soundcase.selectedVersion?.direction ? <SoundCaseResult version={soundcase.selectedVersion} coverUrl={soundCaseApi.coverUrl(soundcase.selectedVersion.projectId, soundcase.selectedVersion.id)} /> : null}
          {soundcase.selectedVersion ? <SoundCasePlayer version={soundcase.selectedVersion} audioUrl={soundCaseApi.audioUrl(soundcase.selectedVersion.projectId, soundcase.selectedVersion.id)} realtime={realtime} /> : null}
          <SoundCaseLibrary
            projects={soundcase.projects} project={soundcase.project}
            selectedVersionId={soundcase.selectedVersion?.id ?? null}
            onCreate={() => { stopRealtimeContext(); void soundcase.createProject({ title: "Novo SoundCase" }); }}
            onSelectProject={(id) => { stopRealtimeContext(); void soundcase.setActiveProjectId(id); }}
            onSelectVersion={(id) => { stopRealtimeContext(); void soundcase.selectVersion(id); }}
            onResumeVersion={(id) => { stopRealtimeContext(); void soundcase.resumeVersion(id); }}
            onDeleteVersion={(id) => { stopRealtimeContext(); void soundcase.deleteVersion(id); }}
            onDeleteProject={(id) => { stopRealtimeContext(); void soundcase.deleteProject(id); }}
          />
        </div>
      </div>
      <SoundCaseMobileDock onDirection={() => setDirectionOpen(true)} onLibrary={() => setLibraryOpen(true)} onGenerate={() => void generate("realtime")} disabled={!words || overLimit || generating || Boolean(soundcase.conflict)} />
      <button type="button" className={styles.tabletLibraryTrigger} aria-label="Abrir acervo" onClick={() => setLibraryOpen(true)}><Library /></button>
      <Sheet open={directionOpen} onOpenChange={setDirectionOpen}>
        <SheetContent side="bottom" className={styles.sheetPanel}>
          <SheetHeader><SheetTitle>Direção de leitura</SheetTitle><SheetDescription>Ajuste voz, ritmo e formato; Luna continua como padrão.</SheetDescription></SheetHeader>
          <DirectionSidebar settings={settings} onChange={setSettings} onGenerate={(mode) => { setDirectionOpen(false); void generate(mode); }} busy={generating} disabled={!words || overLimit || Boolean(soundcase.conflict)} />
        </SheetContent>
      </Sheet>
      <Sheet open={libraryOpen} onOpenChange={setLibraryOpen}>
        <SheetContent side="right" className={styles.sheetPanel}>
          <SheetHeader><SheetTitle>Acervo</SheetTitle><SheetDescription>Projetos e gerações privadas.</SheetDescription></SheetHeader>
          <SoundCaseLibrary
            projects={soundcase.projects} project={soundcase.project} selectedVersionId={soundcase.selectedVersion?.id ?? null}
            onCreate={() => { stopRealtimeContext(); void soundcase.createProject({ title: "Novo SoundCase" }); }}
            onSelectProject={(id) => { stopRealtimeContext(); setLibraryOpen(false); void soundcase.setActiveProjectId(id); }}
            onSelectVersion={(id) => { stopRealtimeContext(); setLibraryOpen(false); void soundcase.selectVersion(id); }}
            onResumeVersion={(id) => { stopRealtimeContext(); void soundcase.resumeVersion(id); }}
            onDeleteVersion={(id) => { stopRealtimeContext(); void soundcase.deleteVersion(id); }}
            onDeleteProject={(id) => { stopRealtimeContext(); void soundcase.deleteProject(id); }}
          />
        </SheetContent>
      </Sheet>
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
