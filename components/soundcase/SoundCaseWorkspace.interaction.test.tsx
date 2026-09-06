// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SoundCaseWorkspace } from "./SoundCaseWorkspace";
import { soundCaseApi } from "@/lib/soundcase/api";
import type { SoundCaseProjectDetail, SoundCasePublicVersion, SoundCaseVersionSummary } from "@/lib/soundcase/types";

const realtime = vi.hoisted(() => ({ stop: vi.fn(), prime: vi.fn(), start: vi.fn(), isActive: false, versionId: null, status: "idle", firstAudioMs: null }));
vi.mock("@/components/soundcase/SoundCaseRealtimeProvider", () => ({ useSoundCaseRealtimeSession: () => realtime }));
vi.mock("@/lib/soundcase/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/soundcase/api")>();
  return { ...actual, soundCaseApi: { ...actual.soundCaseApi,
    listProjects: vi.fn(), listVersions: vi.fn(), getProject: vi.fn(), getVersion: vi.fn(),
    createProject: vi.fn(), saveDraft: vi.fn(), createVersion: vi.fn(),
  } };
});

const stamp = "2026-09-06T10:00:00.000Z";
const settings = { automatic: true, playbackMode: "silent" as const, format: "mp3" as const, voiceOverride: null, speedOverride: null, instructionsOverride: null };
function version(id: string, projectId: string): SoundCasePublicVersion {
  return { id, projectId, status: "ready", sourceHash: "s", settingsHash: "h", idempotencyKey: id,
    wordCount: 3, estimatedDurationSeconds: 60, requestedSettings: settings, effectiveSettings: null, direction: null,
    audio: { status: "ready", format: "mp3", durationSeconds: 60, contentType: "audio/mpeg", fileName: "final.mp3" },
    cover: { status: "pending" }, summary: "Uma leitura tranquila", createdAt: stamp,
    progress: { phase: "ready", ratio: 1, completedChunks: 1, totalChunks: 1, updatedAt: stamp } };
}
function summary(item: SoundCasePublicVersion): SoundCaseVersionSummary { return { ...item, title: `Narração ${item.id}`, requestedFormat: "mp3" }; }
function project(id: string, audio: SoundCasePublicVersion | null): SoundCaseProjectDetail {
  return { id, title: `Texto ${id}`, draftText: "Um texto salvo", draftRevision: 1, draftWordCount: 3, estimatedDurationSeconds: 60,
    activeVersionId: audio?.id ?? null, createdAt: stamp, updatedAt: stamp, versions: audio ? [summary(audio)] : [] };
}
let root: Root;
let container: HTMLDivElement;
let projects: SoundCaseProjectDetail[];
let versions: SoundCasePublicVersion[];

async function click(text: string) {
  const button = [...container.querySelectorAll("button")].find((item) => item.textContent?.trim() === text || item.getAttribute("aria-label") === text);
  expect(button, text).toBeTruthy();
  await act(async () => button!.click());
}
async function render() { await act(async () => { root.render(<SoundCaseWorkspace variant="panel" />); }); }

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  localStorage.clear();
  versions = [version("v1", "p1"), version("v2", "p2")];
  projects = [project("p1", versions[0]), project("p2", versions[1])];
  vi.mocked(soundCaseApi.listProjects).mockImplementation(async () => [...projects]);
  vi.mocked(soundCaseApi.listVersions).mockImplementation(async (id) => projects.find((item) => item.id === id)!.versions);
  vi.mocked(soundCaseApi.getProject).mockImplementation(async (id) => projects.find((item) => item.id === id)!);
  vi.mocked(soundCaseApi.getVersion).mockImplementation(async (_id, id) => versions.find((item) => item.id === id)!);
  vi.mocked(soundCaseApi.createProject).mockImplementation(async () => { const created = { ...project("new", null), draftText: "" }; projects.push(created); return created; });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals();
});

describe("SoundCase library interaction", () => {
  it("keeps the chosen older version when reconnecting refreshes the project", async () => {
    const older = version("older", "p1");
    versions.push(older);
    projects[0].versions.push(summary(older));
    await render();
    await click("Ouvir Narração older");
    const audio = container.querySelector("audio");
    await act(async () => { window.dispatchEvent(new Event("online")); });
    expect(container.querySelector("audio")).toBe(audio);
    expect(audio?.src).toContain("/versions/older/audio");
  });

  it("shows cards from every project, keeps collapsed audio alive, and stops it on another card", async () => {
    await render();
    expect(container.querySelectorAll('[data-slot="soundcase-version-card"]')).toHaveLength(2);
    expect(container.querySelector("textarea")).toBeNull();
    await click("Ouvir Narração v1");
    await click("Reproduzir arquivo final");
    const audio = container.querySelector("audio")!;
    expect(audio.play).toHaveBeenCalledOnce();
    await click("Recolher Narração v1");
    expect(container.querySelector("audio")).toBe(audio);
    expect(audio.closest("[hidden]")).not.toBeNull();
    expect(audio.pause).not.toHaveBeenCalled();
    await click("Ouvir Narração v1");
    expect(container.querySelector("audio")).toBe(audio);
    expect(audio.closest("[hidden]")).toBeNull();
    const seek = container.querySelector('input[aria-label="Posição do áudio"]') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(seek, "25");
      seek.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(audio.currentTime).toBe(25);
    await click("Ouvir Narração v2");
    expect(audio.pause).toHaveBeenCalledOnce();
    expect(container.querySelector("audio")?.src).toContain("/p2/versions/v2/audio");
    expect(container.querySelectorAll('button[aria-expanded="true"][aria-controls^="player-"]')).toHaveLength(1);
    expect(container.querySelector('a[download]')?.getAttribute("href")).toContain("/p2/versions/v2/audio");
  });

  it("opens a blank editor on demand and preserves a failed generation's text", async () => {
    await render();
    await click("Nova narração");
    const textarea = container.querySelector('textarea[aria-label="Texto para narração"]') as HTMLTextAreaElement;
    expect(textarea.value).toBe("");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(textarea, "Texto para preservar");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    vi.mocked(soundCaseApi.saveDraft).mockImplementation(async (id, input) => {
      const saved = { ...projects.find((item) => item.id === id)!, draftText: input.text, draftRevision: 2 };
      projects = projects.map((item) => item.id === id ? saved : item); return saved;
    });
    vi.mocked(soundCaseApi.createVersion).mockRejectedValueOnce(new Error("Falha temporária"));
    await click("Gerar somente arquivo");
    expect(textarea.value).toBe("Texto para preservar");
    expect(textarea.closest("[hidden]")).toBeNull();
    await click("Voltar ao acervo");
    expect(container.querySelector('textarea[aria-label="Texto para narração"]')).toBeNull();
    expect(projects.find((item) => item.id === "new")?.draftText).toBe("Texto para preservar");
  });

  it("collapses the editor only after generation succeeds and opens the new card", async () => {
    await render();
    await click("Texto p1Consultar texto / criar outra versão");
    vi.mocked(soundCaseApi.createVersion).mockImplementation(async (id) => {
      const created = { ...version("v3", id), status: "queued" as const, audio: { status: "pending" as const, format: "mp3" as const } };
      versions.push(created);
      projects = projects.map((item) => item.id === id ? { ...item, activeVersionId: created.id, versions: [...item.versions, summary(created)] } : item);
      return { created: true, version: created };
    });
    await click("Gerar somente arquivo");
    expect(container.querySelector('textarea[aria-label="Texto para narração"]')).toBeNull();
    expect(container.querySelector('button[aria-label="Recolher Narração v3"]')).not.toBeNull();
    expect(container.querySelector("audio")?.getAttribute("src")).toBeNull();
    expect(realtime.start).not.toHaveBeenCalled();
  });
});
