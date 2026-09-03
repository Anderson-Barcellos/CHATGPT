import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SoundCaseGenerationSettings } from "@/lib/soundcase/types";
import { createSoundCaseProject, getSoundCaseProject } from "@/lib/server/soundcase/store";
import {
  cancelSoundCaseVersion,
  claimNextSoundCaseJob,
  createSoundCaseVersion,
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
      claimed = await updateSoundCaseChunk({
        jobId: claimed!.id,
        workerId: "worker-a",
        expectedRevision: claimed!.revision,
        chunkId: chunk.id,
        status: "completed",
        fileName: `chunks/${String(chunk.index).padStart(4, "0")}.flac`,
        durationSeconds: 10,
      });
    }

    const reclaimed = await claimNextSoundCaseJob({
      workerId: "worker-b",
      now: new Date("2030-09-02T12:02:00.000Z"),
    });
    expect(reclaimed?.leaseOwner).toBe("worker-b");
    expect(
      reclaimed?.manifest.chunks.filter((chunk) => chunk.status === "completed")
    ).toHaveLength(2);
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
    const validName = "chunks/0000.flac";
    await writeTextDurable(
      resolveSoundCasePath(
        "projects",
        project.id,
        "versions",
        created.version.id,
        "chunks",
        "0000.flac"
      ),
      "valid"
    );
    claimed = await updateSoundCaseChunk({
      jobId: claimed!.id,
      workerId: "worker-a",
      expectedRevision: claimed!.revision,
      chunkId: chunks[0].id,
      status: "completed",
      fileName: validName,
      durationSeconds: 10,
      byteLength: 5,
    });
    claimed = await updateSoundCaseChunk({
      jobId: claimed!.id,
      workerId: "worker-a",
      expectedRevision: claimed!.revision,
      chunkId: chunks[1].id,
      status: "completed",
      fileName: "chunks/0001.flac",
      durationSeconds: 10,
      byteLength: 9,
    });
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
    expect(resumed.manifest.completedChunks).toBe(1);
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
