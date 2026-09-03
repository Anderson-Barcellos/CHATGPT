import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SoundCaseVersion } from "@/lib/soundcase/types";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const VERSION_ID = "22222222-2222-4222-8222-222222222222";
const mocks = vi.hoisted(() => ({
  requireAppAuth: vi.fn(), readJsonWithLimit: vi.fn(),
  getSoundCaseProject: vi.fn(), saveSoundCaseDraft: vi.fn(), importSoundCaseText: vi.fn(),
  createSoundCaseVersion: vi.fn(), getSoundCaseVersion: vi.fn(),
  cancelSoundCaseVersion: vi.fn(), resumeSoundCaseVersion: vi.fn(),
  deleteSoundCaseVersion: vi.fn(), deleteSoundCaseProjectWithJobs: vi.fn(),
}));
vi.mock("@/lib/server/routeAuth", () => ({ requireAppAuth: mocks.requireAppAuth }));
vi.mock("@/lib/server/readJsonWithLimit", () => ({ readJsonWithLimit: mocks.readJsonWithLimit }));
vi.mock("@/lib/server/soundcase/store", () => ({
  SOUNDCASE_MAX_IMPORT_BYTES: 1024 * 1024,
  getSoundCaseProject: mocks.getSoundCaseProject,
  saveSoundCaseDraft: mocks.saveSoundCaseDraft,
  importSoundCaseText: mocks.importSoundCaseText,
}));
vi.mock("@/lib/server/soundcase/jobs", () => ({
  createSoundCaseVersion: mocks.createSoundCaseVersion,
  getSoundCaseVersion: mocks.getSoundCaseVersion,
  cancelSoundCaseVersion: mocks.cancelSoundCaseVersion,
  resumeSoundCaseVersion: mocks.resumeSoundCaseVersion,
  deleteSoundCaseVersion: mocks.deleteSoundCaseVersion,
  deleteSoundCaseProjectWithJobs: mocks.deleteSoundCaseProjectWithJobs,
}));

import { DELETE as DELETE_PROJECT, PATCH, POST as FLUSH_DRAFT } from "@/app/api/soundcase/projects/[projectId]/route";
import { POST as IMPORT } from "@/app/api/soundcase/projects/[projectId]/import/route";
import { POST as CREATE_VERSION } from "@/app/api/soundcase/projects/[projectId]/versions/route";
import { GET as GET_VERSION } from "@/app/api/soundcase/projects/[projectId]/versions/[versionId]/route";
import { POST as CANCEL } from "@/app/api/soundcase/projects/[projectId]/versions/[versionId]/cancel/route";
import { POST as RESUME } from "@/app/api/soundcase/projects/[projectId]/versions/[versionId]/resume/route";
import { DELETE as DELETE_VERSION } from "@/app/api/soundcase/projects/[projectId]/versions/[versionId]/route";

const projectContext = { params: Promise.resolve({ projectId: PROJECT_ID }) };
const versionContext = { params: Promise.resolve({ projectId: PROJECT_ID, versionId: VERSION_ID }) };

function versionFixture(): SoundCaseVersion {
  return {
    id: VERSION_ID, projectId: PROJECT_ID, status: "queued", sourceHash: "source-secret-hash",
    settingsHash: "settings", idempotencyKey: "key", wordCount: 2,
    estimatedDurationSeconds: 1, segments: [{ id: "s", index: 0, start: 0, end: 12, text: "fonte privada", textHash: "h" }],
    requestedSettings: { automatic: true, playbackMode: "realtime", format: "mp3", voiceOverride: null, speedOverride: null, instructionsOverride: null },
    effectiveSettings: null, direction: null,
    manifest: { versionId: VERSION_ID, sourceHash: "h", format: "mp3", totalChunks: 1, completedChunks: 0, chunks: [], createdAt: "now", updatedAt: "now" },
    progress: { phase: "queued", ratio: 0, completedChunks: 0, totalChunks: 1, updatedAt: "now" },
    audio: { status: "pending", format: "mp3" }, cover: { status: "pending" }, summary: null, createdAt: "now",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAppAuth.mockResolvedValue(null);
});

describe("SoundCase project/version routes", () => {
  it("maps draft CAS conflicts without exposing internals", async () => {
    mocks.readJsonWithLimit.mockResolvedValue({ ok: true, value: { text: "novo", revision: 2 } });
    mocks.saveSoundCaseDraft.mockRejectedValue({ status: 409, code: "soundcase_revision_conflict" });
    const response = await PATCH(new NextRequest("http://local", { method: "PATCH" }), projectContext);
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "soundcase_revision_conflict" });
  });

  it("authenticates PATCH before its bounded JSON reader", async () => {
    mocks.requireAppAuth.mockResolvedValue(new Response(null, { status: 401 }));
    const response = await PATCH(new NextRequest("http://local", { method: "PATCH" }), projectContext);
    expect(response.status).toBe(401);
    expect(mocks.readJsonWithLimit).not.toHaveBeenCalled();
  });

  it("accepts page-exit draft flushes over POST with the same CAS contract", async () => {
    mocks.readJsonWithLimit.mockResolvedValue({ ok: true, value: { text: "última edição", revision: 3 } });
    mocks.saveSoundCaseDraft.mockResolvedValue({ id: PROJECT_ID, draftText: "última edição" });

    const response = await FLUSH_DRAFT(new NextRequest("http://local", { method: "POST" }), projectContext);

    expect(response.status).toBe(200);
    expect(mocks.saveSoundCaseDraft).toHaveBeenCalledWith(PROJECT_ID, {
      text: "última edição", revision: 3,
    });
  });

  it("does not parse multipart before authentication", async () => {
    mocks.requireAppAuth.mockResolvedValue(new Response(null, { status: 401 }));
    const formData = vi.fn(() => { throw new Error("must not read"); });
    const request = { formData } as unknown as NextRequest;
    const response = await IMPORT(request, projectContext);
    expect(response.status).toBe(401);
    expect(formData).not.toHaveBeenCalled();
  });

  it("returns 200 and a source-free public DTO for an idempotent version", async () => {
    mocks.readJsonWithLimit.mockResolvedValue({ ok: true, value: { settings: {
      automatic: true, playbackMode: "realtime", format: "mp3",
      voiceOverride: null, speedOverride: null, instructionsOverride: null,
    } } });
    mocks.createSoundCaseVersion.mockResolvedValue({ created: false, version: versionFixture() });
    const response = await CREATE_VERSION(new NextRequest("http://local", { method: "POST" }), projectContext);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.created).toBe(false);
    expect(body.version.segments).toBeUndefined();
    expect(body.version.manifest).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("fonte privada");
  });

  it("rejects invalid or oversized settings before creating a job", async () => {
    mocks.readJsonWithLimit.mockResolvedValueOnce({ ok: true, value: { settings: {
      automatic: "yes", playbackMode: "realtime", format: "mp3",
      voiceOverride: null, speedOverride: null, instructionsOverride: null,
    } } });
    const invalid = await CREATE_VERSION(new NextRequest("http://local", { method: "POST" }), projectContext);
    expect(invalid.status).toBe(400);
    mocks.readJsonWithLimit.mockResolvedValueOnce({ ok: false, reason: "too_large", status: 413 });
    const large = await CREATE_VERSION(new NextRequest("http://local", { method: "POST" }), projectContext);
    expect(large.status).toBe(413);
    expect(mocks.createSoundCaseVersion).not.toHaveBeenCalled();
  });

  it("rejects invalid ids before touching the version store", async () => {
    const response = await GET_VERSION(
      new NextRequest("http://local"),
      { params: Promise.resolve({ projectId: "../bad", versionId: VERSION_ID }) }
    );
    expect(response.status).toBe(400);
    expect(mocks.getSoundCaseVersion).not.toHaveBeenCalled();
  });

  it("returns the public status from cancel", async () => {
    mocks.cancelSoundCaseVersion.mockResolvedValue({ status: "canceled" });
    const response = await CANCEL(new NextRequest("http://local", { method: "POST" }), versionContext);
    await expect(response.json()).resolves.toEqual({ projectId: PROJECT_ID, versionId: VERSION_ID, status: "canceled" });
  });

  it("imports a bounded UTF-8 file only after auth", async () => {
    const file = new File(["# Texto"], "capitulo.md", { type: "text/markdown" });
    const request = { formData: vi.fn().mockResolvedValue(new FormData()) } as unknown as NextRequest;
    const form = new FormData();
    form.set("file", file);
    vi.mocked(request.formData).mockResolvedValue(form);
    mocks.importSoundCaseText.mockResolvedValue({ id: PROJECT_ID, draftText: "# Texto" });

    const response = await IMPORT(request, projectContext);

    expect(response.status).toBe(200);
    expect(mocks.importSoundCaseText).toHaveBeenCalledWith(PROJECT_ID, expect.objectContaining({
      name: "capitulo.md", mime: "text/markdown",
    }));
  });

  it("rejects an oversized upload before reading its bytes", async () => {
    const file = new File([new Uint8Array(1024 * 1024 + 1)], "grande.txt", { type: "text/plain" });
    const arrayBuffer = vi.spyOn(file, "arrayBuffer");
    const form = new FormData();
    form.set("file", file);
    const response = await IMPORT(
      { formData: vi.fn().mockResolvedValue(form) } as unknown as NextRequest,
      projectContext
    );
    expect(response.status).toBe(413);
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it("coordinates project deletion through the queue domain", async () => {
    const response = await DELETE_PROJECT(
      new NextRequest("http://local", { method: "DELETE" }), projectContext
    );
    expect(response.status).toBe(200);
    expect(mocks.deleteSoundCaseProjectWithJobs).toHaveBeenCalledWith(PROJECT_ID);
  });

  it("exposes resume and coordinated version deletion", async () => {
    mocks.resumeSoundCaseVersion.mockResolvedValue({ status: "queued" });
    const resumed = await RESUME(new NextRequest("http://local", { method: "POST" }), versionContext);
    expect(resumed.status).toBe(200);
    const deleted = await DELETE_VERSION(new NextRequest("http://local", { method: "DELETE" }), versionContext);
    expect(deleted.status).toBe(200);
    expect(mocks.deleteSoundCaseVersion).toHaveBeenCalledWith(PROJECT_ID, VERSION_ID);
  });
});
