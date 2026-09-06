"use client";

import { useEffect, useMemo, useState } from "react";
import { soundCaseApi } from "@/lib/soundcase/api";
import { isActiveSoundCaseStatus } from "@/lib/soundcase/progress";
import type { SoundCaseProject, SoundCaseProjectDetail, SoundCasePublicVersion, SoundCaseVersionSummary } from "@/lib/soundcase/types";

/** Load summaries only: browsing the library never loads source texts or starts audio. */
export function useSoundCaseLibrary(projects: SoundCaseProject[], project: SoundCaseProjectDetail | null, selected: SoundCasePublicVersion | null) {
  const [groups, setGroups] = useState<Record<string, SoundCaseVersionSummary[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const projectKey = JSON.stringify(projects.map(({ id, updatedAt }) => [id, updatedAt]));

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ids = (JSON.parse(projectKey) as string[][]).map(([id]) => id);
    const refresh = async () => {
      const results = await Promise.allSettled(ids.map((id) => soundCaseApi.listVersions(id)));
      if (cancelled) return;
      const failed = results.some((result) => result.status === "rejected");
      setGroups((previous) => Object.fromEntries(ids.map((id, index) => {
        const result = results[index];
        return [id, result.status === "fulfilled" ? result.value : previous[id] ?? []];
      })));
      setError(failed ? "Parte do acervo não carregou. Tente novamente." : null);
      if (failed || results.some((result) => result.status === "fulfilled" && result.value.some((version) => isActiveSoundCaseStatus(version.status)))) {
        timer = setTimeout(() => void refresh(), 4000);
      }
    };
    void refresh();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [projectKey, retry]);

  const versions = useMemo(() => projects.flatMap((item) => {
    const summaries = item.id === project?.id ? project.versions : groups[item.id] ?? [];
    return summaries.map((version) => selected?.id === version.id ? {
      ...version, status: selected.status, audio: selected.audio, cover: selected.cover,
      progress: selected.progress, summary: selected.summary,
    } : version);
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [projects, project, groups, selected]);

  return { versions, error, loading: projects.some((item) => item.id !== project?.id && !groups[item.id]), retry: () => setRetry((value) => value + 1) };
}
