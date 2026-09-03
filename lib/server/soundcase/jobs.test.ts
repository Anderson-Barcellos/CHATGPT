import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SoundCaseGenerationSettings } from "@/lib/soundcase/types";
import { createSoundCaseProject, getSoundCaseProject } from "@/lib/server/soundcase/store";
import {
  cancelSoundCaseVersion,
  claimNextSoundCaseJob,
  createSoundCaseVersion,
  deleteSoundCaseProjectWithJobs,
  deleteSoundCaseVersion,
  acquireSoundCaseQueueLock,
  finishSoundCaseJob,
  getSoundCaseVersion,
  renewSoundCaseLease,
  resumeSoundCaseVersion,
  updateSoundCaseChunk,
} from "@/lib/server/soundcase/jobs";
import { resolveSoundCasePath, writeTextDurable } from "@/lib/server/soundcase/files";

const settings: SoundCaseGenerationSettings = {
  automatic: true,
  playbackMode: "realtime",
  format: "mp3",
  voiceOverride: null,
  speedOverride: null,
  instructionsOverride: null,
};

let root: string;
let previousRoot: string | undefined;

async function writeChunk(
  projectId: string,
  versionId: string,
  index: number,
  content: string
): Promise<{ fileName: string; byteLength: number; contentHash: string }> {
  const name = String(index).padStart(4, "0");
  await writeTextDurable(
    resolveSoundCasePath(
      "projects",
      projectId,
      "versions",
      versionId,
      "chunks",
      `${name}.flac`
    ),
    content
  );
  return {
    fileName: `chunks/${name}.flac`,
    byteLength: Buffer.byteLength(content),
    contentHash: createHash("sha256").update(content).digest("hex"),
  };
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(tmpdir(), "soundcase-jobs-"));
  previousRoot = process.env.SOUNDCASE_DATA_DIR;
  process.env.SOUNDCASE_DATA_DIR = root;
});

afterEach(async () => {
  if (previousRoot === undefined) delete process.env.SOUNDCASE_DATA_DIR;
  else process.env.SOUNDCASE_DATA_DIR = previousRoot;
  await fs.rm(root, { recursive: true, force: true });
});

describe("SoundCase version queue", () => {
  it("reuses an active version with the same snapshot", async () => {
    const project = await createSoundCaseProject({ title: "Ensaio", text: "Texto." });

    const first = await createSoundCaseVersion(project.id, settings);
    const second = await createSoundCaseVersion(project.id, settings);

    expect(second.version.id).toBe(first.version.id);
    expect(second.created).toBe(false);
    await expect(
      fs.readFile(
        path.join(root, "projects", project.id, "versions", first.version.id, "source.txt"),
        "utf8"
      )
    ).resolves.toBe("Texto.");
  });

  it("creates a new version after the equivalent job is terminal", async () => {
    const project = await createSoundCaseProject({ text: "Texto." });
    const first = await createSoundCaseVersion(project.id, settings);
    const claimed = await claimNextSoundCaseJob({
      workerId: "worker-a",
      now: new Date("2030-09-02T12:00:00.000Z"),
    });
    expect(claimed).not.toBeNull();
    await finishSoundCaseJob(
      {
        jobId: claimed!.id,
        workerId: "worker-a",
        expectedRevision: claimed!.revision,
      },
      { status: "completed" },
      { now: new Date("2030-09-02T12:00:10.000Z") }
    );

    const second = await createSoundCaseVersion(project.id, settings);
    expect(second.created).toBe(true);
    expect(second.version.id).not.toBe(first.version.id);
  });

  it("republishes an orphaned active version instead of duplicating it", async () => {
    const project = await createSoundCaseProject({ text: "Texto órfão." });
    const first = await createSoundCaseVersion(project.id, settings);
    await fs.rm(path.join(root, "jobs.json"));

    const repaired = await createSoundCaseVersion(project.id, settings);

    expect(repaired.created).toBe(false);
    expect(repaired.version.id).toBe(first.version.id);
    expect(await claimNextSoundCaseJob({ workerId: "repair-worker" })).not.toBeNull();
  });

  it("reclaims an expired lease and preserves completed chunks", async () => {
    const project = await createSoundCaseProject({ text: "frase. ".repeat(1_400) });
    await createSoundCaseVersion(project.id, settings);
    let claimed = await claimNextSoundCaseJob({
      workerId: "worker-a",
      now: new Date("2030-09-02T12:00:00.000Z"),
    });
    expect(claimed).not.toBeNull();

    for (const chunk of claimed!.manifest.chunks.slice(0, 2)) {
      const integrity = await writeChunk(
        project.id,
        claimed!.versionId,
        chunk.index,
        `valid-${chunk.index}`
      );
      claimed = await updateSoundCaseChunk({
        jobId: claimed!.id,
        workerId: "worker-a",
        expectedRevision: claimed!.revision,
        chunkId: chunk.id,
        status: "completed",
        ...integrity,
        durationSeconds: 10,
      });
    }

    const staleGuard = {
      jobId: claimed!.id,
      workerId: "worker-a",
      expectedRevision: claimed!.revision,
    };
    const reclaimed = await claimNextSoundCaseJob({
      workerId: "worker-b",
      now: new Date("2030-09-02T12:02:00.000Z"),
    });
    expect(reclaimed?.leaseOwner).toBe("worker-b");
    expect(
      reclaimed?.manifest.chunks.filter((chunk) => chunk.status === "completed")
    ).toHaveLength(2);
    await expect(
      updateSoundCaseChunk(
        {
          ...staleGuard,
          chunkId: claimed!.manifest.chunks[2].id,
          status: "completed",
          fileName: "chunks/0002.flac",
          durationSeconds: 10,
        },
        { now: new Date("2030-09-02T12:02:01.000Z") }
      )
    ).resolves.toBeNull();
  });

  it("allows only one unexpired heavy job at a time", async () => {
    const firstProject = await createSoundCaseProject({ text: "Primeiro." });
    const secondProject = await createSoundCaseProject({ text: "Segundo." });
    await createSoundCaseVersion(firstProject.id, settings);
    await createSoundCaseVersion(secondProject.id, settings);

    const first = await claimNextSoundCaseJob({
      workerId: "worker-a",
      now: new Date("2030-09-02T12:00:00.000Z"),
    });
    const blocked = await claimNextSoundCaseJob({
      workerId: "worker-b",
      now: new Date("2030-09-02T12:00:30.000Z"),
    });

    expect(first).not.toBeNull();
    expect(blocked).toBeNull();
  });

  it("excludes a second process with a kernel-backed queue lock", async () => {
    const lockPath = path.join(root, "jobs.lock");
    const lock = await acquireSoundCaseQueueLock();
    const blocked = spawn("/usr/bin/flock", ["--nonblock", lockPath, "/bin/true"]);
    const [blockedCode] = (await once(blocked, "exit")) as [number];
    expect(blockedCode).toBe(1);

    await lock.release();
    const admitted = spawn("/usr/bin/flock", ["--nonblock", lockPath, "/bin/true"]);
    const [admittedCode] = (await once(admitted, "exit")) as [number];
    expect(admittedCode).toBe(0);
  });

  it("triggers fail-stop when the kernel lock holder dies unexpectedly", async () => {
    const onUnexpectedExit = vi.fn();
    const lock = await acquireSoundCaseQueueLock({ onUnexpectedExit });

    process.kill(lock.holderPid, "SIGKILL");

    await vi.waitFor(() => expect(onUnexpectedExit).toHaveBeenCalledOnce());
    const contender = spawn("/usr/bin/flock", [
      "--nonblock",
      path.join(root, "jobs.lock"),
      "/bin/true",
    ]);
    const [code] = (await once(contender, "exit")) as [number];
    expect(code).toBe(0);
    await lock.release();
  });

  it("rejects a stale lease guard after renewal", async () => {
    const project = await createSoundCaseProject({ text: "Texto." });
    await createSoundCaseVersion(project.id, settings);
    const claimed = await claimNextSoundCaseJob({ workerId: "worker-a" });
    const renewed = await renewSoundCaseLease({
      jobId: claimed!.id,
      workerId: "worker-a",
      expectedRevision: claimed!.revision,
    });

    await expect(
      updateSoundCaseChunk({
        jobId: claimed!.id,
        workerId: "worker-a",
        expectedRevision: claimed!.revision,
        chunkId: claimed!.manifest.chunks[0].id,
        status: "completed",
        fileName: "chunks/0000.flac",
        durationSeconds: 1,
      })
    ).resolves.toBeNull();
    expect(renewed?.revision).toBe(claimed!.revision + 1);
  });

  it("rejects publication after lease expiry even before reclaim", async () => {
    const project = await createSoundCaseProject({ text: "Texto." });
    await createSoundCaseVersion(project.id, settings, {
      now: new Date("2020-01-01T00:00:00.000Z"),
    });
    const claimed = await claimNextSoundCaseJob({
      workerId: "expired-worker",
      now: new Date("2020-01-01T00:00:01.000Z"),
    });

    await expect(
      updateSoundCaseChunk({
        jobId: claimed!.id,
        workerId: "expired-worker",
        expectedRevision: claimed!.revision,
        chunkId: claimed!.manifest.chunks[0].id,
        status: "completed",
        fileName: "chunks/0000.flac",
        durationSeconds: 1,
      })
    ).resolves.toBeNull();
  });

  it("cancels before further worker mutations", async () => {
    const project = await createSoundCaseProject({ text: "Texto." });
    const created = await createSoundCaseVersion(project.id, settings);
    const claimed = await claimNextSoundCaseJob({ workerId: "worker-a" });

    const canceled = await cancelSoundCaseVersion(project.id, created.version.id);
    expect(canceled.status).toBe("canceled");
    await expect(
      renewSoundCaseLease({
        jobId: claimed!.id,
        workerId: "worker-a",
        expectedRevision: claimed!.revision,
      })
    ).resolves.toBeNull();
  });

  it("resumes only invalid completed chunks", async () => {
    const project = await createSoundCaseProject({ text: "frase. ".repeat(1_400) });
    const created = await createSoundCaseVersion(project.id, settings);
    let claimed = await claimNextSoundCaseJob({ workerId: "worker-a" });
    const chunks = claimed!.manifest.chunks.slice(0, 2);
    const firstIntegrity = await writeChunk(project.id, created.version.id, 0, "valid");
    claimed = await updateSoundCaseChunk({
      jobId: claimed!.id,
      workerId: "worker-a",
      expectedRevision: claimed!.revision,
      chunkId: chunks[0].id,
      status: "completed",
      ...firstIntegrity,
      durationSeconds: 10,
    });
    const secondIntegrity = await writeChunk(project.id, created.version.id, 1, "other");
    claimed = await updateSoundCaseChunk({
      jobId: claimed!.id,
      workerId: "worker-a",
      expectedRevision: claimed!.revision,
      chunkId: chunks[1].id,
      status: "completed",
      ...secondIntegrity,
      durationSeconds: 10,
    });
    const manifestFile = path.join(
      root, "projects", project.id, "versions", created.version.id, "manifest.json"
    );
    const persistedManifest = JSON.parse(await fs.readFile(manifestFile, "utf8"));
    persistedManifest.chunks[1].attempts = 4;
    await fs.writeFile(manifestFile, JSON.stringify(persistedManifest));
    await writeChunk(project.id, created.version.id, 1, "alter");
    await finishSoundCaseJob(
      {
        jobId: claimed!.id,
        workerId: "worker-a",
        expectedRevision: claimed!.revision,
      },
      { status: "interrupted" }
    );

    const resumed = await resumeSoundCaseVersion(project.id, created.version.id);
    expect(resumed.status).toBe("queued");
    expect(resumed.manifest.chunks[0].status).toBe("completed");
    expect(resumed.manifest.chunks[1].status).toBe("pending");
    expect(resumed.manifest.chunks[1].attempts).toBe(0);
    expect(resumed.manifest.completedChunks).toBe(1);
  });

  it("recovers when a crash persisted the resumed version before its job", async () => {
    const project = await createSoundCaseProject({ text: "Texto retomável." });
    const created = await createSoundCaseVersion(project.id, settings);
    const claimed = await claimNextSoundCaseJob({ workerId: "worker-a" });
    await finishSoundCaseJob(
      {
        jobId: claimed!.id,
        workerId: "worker-a",
        expectedRevision: claimed!.revision,
      },
      { status: "interrupted" }
    );
    const metadataPath = path.join(
      root,
      "projects",
      project.id,
      "versions",
      created.version.id,
      "version.json"
    );
    const metadata = JSON.parse(await fs.readFile(metadataPath, "utf8"));
    await fs.writeFile(metadataPath, JSON.stringify({ ...metadata, status: "queued" }));

    const resumed = await resumeSoundCaseVersion(project.id, created.version.id);

    expect(resumed.status).toBe("queued");
    await expect(claimNextSoundCaseJob({ workerId: "worker-b" })).resolves.not.toBeNull();
  });

  it("does not resurrect a canceled version from a stale projection", async () => {
    const project = await createSoundCaseProject({ text: "Texto." });
    const created = await createSoundCaseVersion(project.id, settings);
    await cancelSoundCaseVersion(project.id, created.version.id);
    const metadataPath = path.join(
      root,
      "projects",
      project.id,
      "versions",
      created.version.id,
      "version.json"
    );
    const metadata = JSON.parse(await fs.readFile(metadataPath, "utf8"));
    await fs.writeFile(metadataPath, JSON.stringify({ ...metadata, status: "queued" }));

    const next = await createSoundCaseVersion(project.id, settings);

    expect(next.created).toBe(true);
    expect(next.version.id).not.toBe(created.version.id);
  });

  it("deletes a version and its queued job under the queue lock", async () => {
    const project = await createSoundCaseProject({ text: "Versão removível." });
    const created = await createSoundCaseVersion(project.id, settings);

    await deleteSoundCaseVersion(project.id, created.version.id);

    await expect(getSoundCaseVersion(project.id, created.version.id)).rejects.toMatchObject({
      code: "soundcase_version_not_found",
    });
    expect((await getSoundCaseProject(project.id)).versions).toEqual([]);
    const jobs = JSON.parse(await fs.readFile(path.join(root, "jobs.json"), "utf8"));
    expect(jobs).toEqual([]);
  });

  it("fences project jobs before deleting its private tree", async () => {
    const project = await createSoundCaseProject({ text: "Projeto removível." });
    await createSoundCaseVersion(project.id, settings);

    await deleteSoundCaseProjectWithJobs(project.id);

    await expect(getSoundCaseProject(project.id)).rejects.toMatchObject({
      code: "soundcase_project_not_found",
    });
    const jobs = JSON.parse(await fs.readFile(path.join(root, "jobs.json"), "utf8"));
    expect(jobs).toEqual([]);
    await expect(fs.access(path.join(root, "projects", project.id))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("retries private-tree cleanup for an already tombstoned project", async () => {
    const project = await createSoundCaseProject({ text: "Cleanup retomável." });
    const indexPath = path.join(root, "projects.json");
    const projects = JSON.parse(await fs.readFile(indexPath, "utf8"));
    projects[0] = { ...projects[0], deletedAt: new Date().toISOString() };
    await fs.writeFile(indexPath, JSON.stringify(projects));

    await deleteSoundCaseProjectWithJobs(project.id);

    await expect(fs.access(path.join(root, "projects", project.id))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("repairs an orphan from version.json when the projection is absent", async () => {
    const project = await createSoundCaseProject({ text: "Órfão canônico." });
    const created = await createSoundCaseVersion(project.id, settings);
    await fs.rm(path.join(root, "jobs.json"));
    await fs.writeFile(
      path.join(root, "projects", project.id, "project.json"),
      JSON.stringify({ project, versions: [] })
    );

    const repaired = await createSoundCaseVersion(project.id, settings);

    expect(repaired.created).toBe(false);
    expect(repaired.version.id).toBe(created.version.id);
  });

  it("simulates ninety minutes without a provider", async () => {
    const project = await createSoundCaseProject({ title: "Longo" });
    const source = Array.from({ length: 13_500 }, () => "palavra").join(" ");
    const created = await createSoundCaseVersion(project.id, settings, { source });

    expect(created.version.estimatedDurationSeconds).toBeLessThanOrEqual(5_400);
    expect(created.version.manifest.totalChunks).toBeGreaterThan(1);
    expect((await getSoundCaseProject(project.id)).versions).toHaveLength(1);
    await expect(getSoundCaseVersion(project.id, created.version.id)).resolves.toMatchObject({
      sourceHash: created.version.sourceHash,
      manifest: { totalChunks: created.version.manifest.totalChunks },
    });
  });
});
