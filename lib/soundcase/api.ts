import { ClientApiError, parseApiErrorResponse } from "@/lib/api/errors";
import type {
  SoundCaseActionResponse,
  SoundCaseGenerationSettings,
  SoundCaseProject,
  SoundCaseProjectDetail,
  SoundCasePublicVersion,
  SoundCaseVersionSummary,
} from "@/lib/soundcase/types";
import { apiUrl } from "@/lib/utils";

async function safeJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return (text ? JSON.parse(text) : {}) as T;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), init);
  if (!response.ok) throw await parseApiErrorResponse(response);
  return safeJson<T>(response);
}

function projectPath(projectId: string): string {
  return `/api/soundcase/projects/${encodeURIComponent(projectId)}`;
}

function versionPath(projectId: string, versionId: string): string {
  return `${projectPath(projectId)}/versions/${encodeURIComponent(versionId)}`;
}

export function flushSoundCaseDraftOnExitBestEffort(
  projectId: string,
  input: { text: string; revision: number; title?: string }
): void {
  const url = apiUrl(projectPath(projectId));
  const body = JSON.stringify(input);
  try {
    const payload = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon(url, payload)) return;
  } catch {
    // A keepalive request below is the best available fallback on older browsers.
  }
  try {
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // The synchronous local recovery copy remains authoritative until CAS confirms.
  }
}

export function readableSoundCaseError(error: unknown, fallback: string): string {
  if (error instanceof ClientApiError || error instanceof Error) return error.message;
  return fallback;
}

export const soundCaseApi = {
  async listProjects(): Promise<SoundCaseProject[]> {
    const data = await request<{ projects?: SoundCaseProject[] }>(
      "/api/soundcase/projects",
      { cache: "no-store" }
    );
    return Array.isArray(data.projects) ? data.projects : [];
  },

  async createProject(input: { title?: string; text?: string } = {}): Promise<SoundCaseProjectDetail> {
    const data = await request<{ project: SoundCaseProjectDetail }>("/api/soundcase/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return data.project;
  },

  async getProject(projectId: string): Promise<SoundCaseProjectDetail> {
    const data = await request<{ project: SoundCaseProjectDetail }>(projectPath(projectId), {
      cache: "no-store",
    });
    return data.project;
  },

  async saveDraft(
    projectId: string,
    input: { text: string; revision: number; title?: string }
  ): Promise<SoundCaseProjectDetail> {
    const data = await request<{ project: SoundCaseProjectDetail }>(projectPath(projectId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return data.project;
  },

  async importText(projectId: string, file: File): Promise<SoundCaseProjectDetail> {
    const form = new FormData();
    form.set("file", file);
    const data = await request<{ project: SoundCaseProjectDetail }>(
      `${projectPath(projectId)}/import`,
      { method: "POST", body: form }
    );
    return data.project;
  },

  async deleteProject(projectId: string): Promise<void> {
    await request(projectPath(projectId), { method: "DELETE" });
  },

  async listVersions(projectId: string): Promise<SoundCaseVersionSummary[]> {
    const data = await request<{ versions?: SoundCaseVersionSummary[] }>(
      `${projectPath(projectId)}/versions`,
      { cache: "no-store" }
    );
    return Array.isArray(data.versions) ? data.versions : [];
  },

  async createVersion(
    projectId: string,
    settings: SoundCaseGenerationSettings
  ): Promise<{ created: boolean; version: SoundCasePublicVersion }> {
    return request(`${projectPath(projectId)}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    });
  },

  async getVersion(projectId: string, versionId: string): Promise<SoundCasePublicVersion> {
    const data = await request<{ version: SoundCasePublicVersion }>(
      versionPath(projectId, versionId),
      { cache: "no-store" }
    );
    return data.version;
  },

  async deleteVersion(projectId: string, versionId: string): Promise<void> {
    await request(versionPath(projectId, versionId), { method: "DELETE" });
  },

  cancelVersion(projectId: string, versionId: string): Promise<SoundCaseActionResponse> {
    return request(`${versionPath(projectId, versionId)}/cancel`, { method: "POST" });
  },

  resumeVersion(projectId: string, versionId: string): Promise<SoundCaseActionResponse> {
    return request(`${versionPath(projectId, versionId)}/resume`, { method: "POST" });
  },

  audioUrl(projectId: string, versionId: string): string {
    return apiUrl(`${versionPath(projectId, versionId)}/audio`);
  },

  coverUrl(projectId: string, versionId: string): string {
    return apiUrl(`${versionPath(projectId, versionId)}/cover`);
  },
};
