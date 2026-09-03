"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ClientApiError } from "@/lib/api/errors";
import { soundCaseApi, readableSoundCaseError } from "@/lib/soundcase/api";
import { getSoundCasePollInterval } from "@/lib/soundcase/progress";
import type {
  SoundCaseGenerationSettings,
  SoundCaseProject,
  SoundCaseProjectDetail,
  SoundCasePublicVersion,
} from "@/lib/soundcase/types";

export interface SoundCaseDraftConflict {
  localText: string;
  serverProject: SoundCaseProjectDetail;
}

export function buildSoundCaseDraftConflict(
  localText: string,
  serverProject: SoundCaseProjectDetail
): SoundCaseDraftConflict {
  return { localText, serverProject };
}

export function useSoundCase() {
  const [projects, setProjects] = useState<SoundCaseProject[]>([]);
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);
  const [project, setProject] = useState<SoundCaseProjectDetail | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<SoundCasePublicVersion | null>(null);
  const [draftText, setDraftTextState] = useState("");
  const [conflict, setConflict] = useState<SoundCaseDraftConflict | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const persistedTextRef = useRef("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectRef = useRef<SoundCaseProjectDetail | null>(null);
  const draftRef = useRef("");
  const conflictRef = useRef<SoundCaseDraftConflict | null>(null);
  const saveChainRef = useRef<Promise<SoundCaseProjectDetail | null>>(Promise.resolve(null));
  const savesInFlightRef = useRef(0);

  useEffect(() => { projectRef.current = project; }, [project]);
  useEffect(() => { draftRef.current = draftText; }, [draftText]);
  useEffect(() => { conflictRef.current = conflict; }, [conflict]);

  const applyProject = useCallback((next: SoundCaseProjectDetail, preserveDirty = false) => {
    const dirty = draftRef.current !== persistedTextRef.current;
    setProject(next);
    projectRef.current = next;
    if (!preserveDirty || !dirty) {
      setDraftTextState(next.draftText);
      draftRef.current = next.draftText;
    }
    persistedTextRef.current = next.draftText;
  }, []);

  const refreshProjects = useCallback(async () => {
    const next = await soundCaseApi.listProjects();
    setProjects(next);
    return next;
  }, []);

  const loadProject = useCallback(async (projectId: string, preserveDirty = false) => {
    const next = await soundCaseApi.getProject(projectId);
    applyProject(next, preserveDirty);
    setActiveProjectIdState(projectId);
    const activeVersionId = next.activeVersionId;
    if (activeVersionId) {
      setSelectedVersion(await soundCaseApi.getVersion(projectId, activeVersionId));
    } else {
      setSelectedVersion(null);
    }
    return next;
  }, [applyProject]);

  useEffect(() => {
    let cancelled = false;
    void refreshProjects().then(async (items) => {
      if (cancelled) return;
      const first = [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      if (first) await loadProject(first.id);
    }).catch((cause) => {
      if (!cancelled) setError(readableSoundCaseError(cause, "Não foi possível carregar o SoundCase."));
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [loadProject, refreshProjects]);

  const persistDraft = useCallback(async (text: string, revision?: number) => {
    const task = saveChainRef.current.then(async () => {
      const current = projectRef.current;
      if (!current || conflictRef.current) return null;
      savesInFlightRef.current += 1;
      setSaving(true);
      try {
        const saved = await soundCaseApi.saveDraft(current.id, {
          text,
          revision: revision ?? current.draftRevision,
        });
        applyProject(saved, true);
        setProjects((items) => items.map((item) => item.id === saved.id ? saved : item));
        setError(null);
        return saved;
      } catch (cause) {
        if (cause instanceof ClientApiError && cause.status === 409) {
          const serverProject = await soundCaseApi.getProject(current.id);
          const nextConflict = buildSoundCaseDraftConflict(text, serverProject);
          setConflict(nextConflict);
          conflictRef.current = nextConflict;
          applyProject(serverProject, true);
          return null;
        }
        setError(readableSoundCaseError(cause, "Não foi possível salvar o texto."));
        throw cause;
      } finally {
        savesInFlightRef.current -= 1;
        if (savesInFlightRef.current === 0) setSaving(false);
      }
    });
    saveChainRef.current = task.catch(() => null);
    return task;
  }, [applyProject]);

  const flushDraft = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await saveChainRef.current;
    if (draftRef.current === persistedTextRef.current) return projectRef.current;
    return persistDraft(draftRef.current);
  }, [persistDraft]);

  useEffect(() => {
    if (!project || conflict || draftText === persistedTextRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void persistDraft(draftRef.current).catch(() => undefined);
    }, 700);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    };
  }, [conflict, draftText, persistDraft, project]);

  useEffect(() => {
    const interval = getSoundCasePollInterval(selectedVersion);
    if (!interval || !selectedVersion) return;
    const timer = setInterval(() => {
      void soundCaseApi.getVersion(selectedVersion.projectId, selectedVersion.id)
        .then((next) => {
          setSelectedVersion(next);
          if (!getSoundCasePollInterval(next)) {
            void loadProject(next.projectId, true);
            void refreshProjects();
          }
        })
        .catch((cause) => setError(readableSoundCaseError(cause, "Não foi possível atualizar o progresso.")));
    }, interval);
    return () => clearInterval(timer);
  }, [loadProject, refreshProjects, selectedVersion]);

  useEffect(() => {
    const reconcile = () => {
      if (document.visibilityState === "hidden" || !navigator.onLine) return;
      const current = projectRef.current;
      if (current) void loadProject(current.id, true);
      void refreshProjects();
    };
    document.addEventListener("visibilitychange", reconcile);
    window.addEventListener("online", reconcile);
    return () => {
      document.removeEventListener("visibilitychange", reconcile);
      window.removeEventListener("online", reconcile);
    };
  }, [loadProject, refreshProjects]);

  const setActiveProjectId = useCallback(async (projectId: string) => {
    await flushDraft();
    setConflict(null);
    conflictRef.current = null;
    await loadProject(projectId);
  }, [flushDraft, loadProject]);

  const setDraftText = useCallback((text: string) => {
    setDraftTextState(text);
    draftRef.current = text;
  }, []);

  const createProject = useCallback(async (input: { title?: string; text?: string } = {}) => {
    await flushDraft();
    const created = await soundCaseApi.createProject(input);
    applyProject(created);
    setActiveProjectIdState(created.id);
    setSelectedVersion(null);
    setConflict(null);
    await refreshProjects();
    return created;
  }, [applyProject, flushDraft, refreshProjects]);

  const importText = useCallback(async (file: File) => {
    const current = projectRef.current;
    if (!current) throw new Error("soundcase_project_required");
    if (conflictRef.current) throw new Error("soundcase_draft_conflict");
    const imported = await soundCaseApi.importText(current.id, file);
    applyProject(imported);
    await refreshProjects();
    return imported;
  }, [applyProject, refreshProjects]);

  const generate = useCallback(async (settings: SoundCaseGenerationSettings) => {
    if (conflictRef.current) throw new Error("soundcase_draft_conflict");
    const saved = await flushDraft();
    if (!saved || !draftRef.current.trim()) throw new Error("soundcase_text_required");
    const result = await soundCaseApi.createVersion(saved.id, settings);
    setSelectedVersion(result.version);
    await loadProject(saved.id, true);
    return result.version;
  }, [flushDraft, loadProject]);

  const selectVersion = useCallback(async (versionId: string) => {
    const current = projectRef.current;
    if (!current) return;
    setSelectedVersion(await soundCaseApi.getVersion(current.id, versionId));
  }, []);

  const cancelVersion = useCallback(async () => {
    if (!selectedVersion) return;
    await soundCaseApi.cancelVersion(selectedVersion.projectId, selectedVersion.id);
    setSelectedVersion(await soundCaseApi.getVersion(selectedVersion.projectId, selectedVersion.id));
  }, [selectedVersion]);

  const resumeVersion = useCallback(async (versionId = selectedVersion?.id) => {
    const current = projectRef.current;
    if (!current || !versionId) return;
    await soundCaseApi.resumeVersion(current.id, versionId);
    setSelectedVersion(await soundCaseApi.getVersion(current.id, versionId));
  }, [selectedVersion]);

  const deleteVersion = useCallback(async (versionId: string) => {
    const current = projectRef.current;
    if (!current) return;
    await soundCaseApi.deleteVersion(current.id, versionId);
    if (selectedVersion?.id === versionId) setSelectedVersion(null);
    await loadProject(current.id, true);
  }, [loadProject, selectedVersion]);

  const deleteProject = useCallback(async (projectId: string) => {
    await soundCaseApi.deleteProject(projectId);
    const remaining = await refreshProjects();
    if (projectRef.current?.id !== projectId) return;
    const next = [...remaining].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    if (next) await loadProject(next.id);
    else {
      setActiveProjectIdState(null);
      setProject(null);
      projectRef.current = null;
      setDraftTextState("");
      draftRef.current = "";
      persistedTextRef.current = "";
      setSelectedVersion(null);
    }
  }, [loadProject, refreshProjects]);

  const resolveConflict = useCallback(async (choice: "server" | "local") => {
    const currentConflict = conflictRef.current;
    if (!currentConflict) return;
    setConflict(null);
    conflictRef.current = null;
    if (choice === "server") {
      applyProject(currentConflict.serverProject);
      return;
    }
    setDraftText(currentConflict.localText);
    await persistDraft(currentConflict.localText, currentConflict.serverProject.draftRevision);
  }, [applyProject, persistDraft, setDraftText]);

  return {
    projects, activeProjectId, project, selectedVersion, draftText,
    unsavedText: conflict?.localText ?? null,
    conflict, loading, saving, error,
    isDirty: draftText !== persistedTextRef.current,
    setDraftText, setActiveProjectId, createProject, importText, generate,
    selectVersion, cancelVersion, resumeVersion, deleteVersion, deleteProject,
    resolveConflict, flushDraft, refreshProjects,
  };
}
