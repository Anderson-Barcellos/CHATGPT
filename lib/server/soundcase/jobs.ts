import { createHash } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { constants, promises as fs } from "node:fs";
import {
  SOUNDCASE_DEFAULT_AUDIO_FORMAT,
  type CreateSoundCaseVersionResult,
  type SoundCaseClaimedJob,
  type SoundCaseGenerationSettings,
  type SoundCaseJob,
  type SoundCaseLeaseGuard,
  type SoundCaseManifest,
  type SoundCasePublicError,
  type SoundCaseVersion,
  type SoundCaseVersionMetadata,
  type SoundCaseVersionSummary,
  type UpdateSoundCaseChunkInput,
} from "@/lib/soundcase/types";
import {
  assertSoundCaseDuration,
  countSoundCaseWords,
  normalizeSoundCaseText,
  segmentSoundCaseText,
} from "@/lib/soundcase/text";
import {
  assertRegularSoundCaseFile,
  ensureSoundCaseRoot,
  listSoundCaseVersionIds,
  readJsonSafe,
  removeVersionTree,
  resolveSoundCasePath,
  writeJsonDurable,
  writeTextDurable,
} from "@/lib/server/soundcase/files";
import {
  getSoundCaseProject,
  removeSoundCaseVersionProjection,
  upsertSoundCaseVersionProjection,
} from "@/lib/server/soundcase/store";

const LEASE_DURATION_MS = 90_000;
const queueLocks = new Map<string, Promise<void>>();
const QUEUE_LOCK_KEY = "soundcase-jobs";
const FLOCK_PATH = "/usr/bin/flock";
const FLOCK_WAIT_SECONDS = "10";
const FLOCK_ACQUIRED_MARKER = "soundcase-lock-acquired";

export class SoundCaseJobError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status = 409) {
    super(code);
    this.name = "SoundCaseJobError";
    this.code = code;
    this.status = status;
  }
}

function queueFileLockPath(): string {
  return resolveSoundCasePath("jobs.lock");
}

async function waitForFlock(
  child: ChildProcessWithoutNullStreams
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let output = "";
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      child.stdout.off("data", onData);
      child.off("error", onError);
      child.off("exit", onExit);
      if (error) reject(error);
      else resolve();
    };
    const onData = (data: Buffer) => {
      output += data.toString("utf8");
      if (output.includes(`${FLOCK_ACQUIRED_MARKER}\n`)) finish();
    };
    const onError = () => finish(new SoundCaseJobError("soundcase_queue_lock_failed", 503));
    const onExit = () => finish(new SoundCaseJobError("soundcase_queue_lock_timeout", 503));
    child.stdout.on("data", onData);
    child.once("error", onError);
    child.once("exit", onExit);
  });
}

async function releaseFlock(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null) return;
  await new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
    child.once("error", () => resolve());
    child.stdin.end();
  });
}

export async function acquireSoundCaseQueueLock(): Promise<() => Promise<void>> {
  await ensureSoundCaseRoot();
  const lockPath = queueFileLockPath();
  const handle = await fs.open(
    lockPath,
    constants.O_RDWR | constants.O_CREAT | constants.O_NOFOLLOW,
    0o600
  );
  await handle.close();
  await assertRegularSoundCaseFile(lockPath);

  const holderScript =
    `process.stdout.write(${JSON.stringify(`${FLOCK_ACQUIRED_MARKER}\n`)});` +
    "process.stdin.resume();";
  const child = spawn(
    FLOCK_PATH,
    [
      "--exclusive",
      "--wait",
      FLOCK_WAIT_SECONDS,
      lockPath,
      process.execPath,
      "-e",
      holderScript,
    ],
    { stdio: ["pipe", "pipe", "pipe"] }
  );
  try {
    await waitForFlock(child);
  } catch (error) {
    child.stdin.destroy();
    child.kill();
    throw error;
  }
  return () => releaseFlock(child);
}

async function withQueueLock<T>(fn: () => Promise<T>): Promise<T> {
  const previous = queueLocks.get(QUEUE_LOCK_KEY) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => current);
  queueLocks.set(QUEUE_LOCK_KEY, tail);
  await previous;
  let releaseFileLock: (() => Promise<void>) | null = null;
  try {
    releaseFileLock = await acquireSoundCaseQueueLock();
    return await fn();
  } finally {
    try {
      await releaseFileLock?.();
    } finally {
      release();
      if (queueLocks.get(QUEUE_LOCK_KEY) === tail) queueLocks.delete(QUEUE_LOCK_KEY);
    }
  }
}

function jobsPath(): string {
  return resolveSoundCasePath("jobs.json");
}

function versionPath(projectId: string, versionId: string): string {
  return resolveSoundCasePath(
    "projects",
    projectId,
    "versions",
    versionId,
    "version.json"
  );
}

function manifestPath(projectId: string, versionId: string): string {
  return resolveSoundCasePath(
    "projects",
    projectId,
    "versions",
    versionId,
    "manifest.json"
  );
}

function sourcePath(projectId: string, versionId: string): string {
  return resolveSoundCasePath(
    "projects",
    projectId,
    "versions",
    versionId,
    "source.txt"
  );
}

function hash(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function settingsHash(settings: SoundCaseGenerationSettings): string {
  return hash(
    JSON.stringify({
      automatic: settings.automatic,
      playbackMode: settings.playbackMode,
      format: settings.format,
      voiceOverride: settings.voiceOverride,
      speedOverride: settings.speedOverride,
      instructionsOverride: settings.instructionsOverride,
    })
  );
}

function isJob(value: unknown): value is SoundCaseJob {
  if (!value || typeof value !== "object") return false;
  const job = value as Partial<SoundCaseJob>;
  return (
    typeof job.id === "string" &&
    typeof job.projectId === "string" &&
    typeof job.versionId === "string" &&
    (job.status === "queued" ||
      job.status === "running" ||
      job.status === "completed" ||
      job.status === "interrupted" ||
      job.status === "canceled" ||
      job.status === "failed") &&
    typeof job.revision === "number" &&
    typeof job.attempt === "number" &&
    typeof job.nextRunAt === "string" &&
    typeof job.createdAt === "string" &&
    typeof job.updatedAt === "string"
  );
}

async function readJobs(): Promise<SoundCaseJob[]> {
  const value = await readJsonSafe<unknown>(jobsPath());
  if (value === null) return [];
  if (!Array.isArray(value) || value.some((job) => !isJob(job))) {
    throw new SoundCaseJobError("soundcase_jobs_invalid", 500);
  }
  return value;
}

async function writeJobs(jobs: SoundCaseJob[]): Promise<void> {
  await writeJsonDurable(jobsPath(), jobs);
}

function metadataOf(version: SoundCaseVersion): SoundCaseVersionMetadata {
  const { manifest: _manifest, ...metadata } = version;
  return metadata;
}

function summaryOf(version: SoundCaseVersion): SoundCaseVersionSummary {
  return {
    id: version.id,
    projectId: version.projectId,
    idempotencyKey: version.idempotencyKey,
    status: version.status,
    title: version.direction?.title ?? "SoundCase",
    summary: version.summary,
    wordCount: version.wordCount,
    estimatedDurationSeconds: version.estimatedDurationSeconds,
    requestedFormat: version.requestedSettings.format,
    audio: version.audio,
    cover: version.cover,
    progress: version.progress,
    createdAt: version.createdAt,
    ...(version.completedAt ? { completedAt: version.completedAt } : {}),
  };
}

async function writeVersion(version: SoundCaseVersion): Promise<void> {
  await writeJsonDurable(manifestPath(version.projectId, version.id), version.manifest);
  await writeJsonDurable(versionPath(version.projectId, version.id), metadataOf(version));
  await upsertSoundCaseVersionProjection(version.projectId, summaryOf(version));
}

export async function getSoundCaseVersion(
  projectId: string,
  versionId: string
): Promise<SoundCaseVersion> {
  const [metadata, manifest] = await Promise.all([
    readJsonSafe<SoundCaseVersionMetadata>(versionPath(projectId, versionId)),
    readJsonSafe<SoundCaseManifest>(manifestPath(projectId, versionId)),
  ]);
  if (!metadata || !manifest || metadata.id !== versionId || manifest.versionId !== versionId) {
    throw new SoundCaseJobError("soundcase_version_not_found", 404);
  }
  return { ...metadata, manifest };
}

async function claimed(job: SoundCaseJob): Promise<SoundCaseClaimedJob> {
  const version = await getSoundCaseVersion(job.projectId, job.versionId);
  return { ...job, version, manifest: version.manifest };
}

function isActiveJob(job: SoundCaseJob): boolean {
  return job.status === "queued" || job.status === "running" || job.status === "interrupted";
}

export async function createSoundCaseVersion(
  projectId: string,
  settings: SoundCaseGenerationSettings,
  options: { source?: string; now?: Date } = {}
): Promise<CreateSoundCaseVersionResult> {
  return withQueueLock(async () => {
    const project = await getSoundCaseProject(projectId);
    const source = normalizeSoundCaseText(options.source ?? project.draftText);
    const speed = settings.speedOverride ?? 1;
    const estimatedDurationSeconds = assertSoundCaseDuration(source, speed);
    const segments = segmentSoundCaseText(source);
    const sourceHash = hash(source);
    const requestedSettingsHash = settingsHash(settings);
    const idempotencyKey = hash(sourceHash + requestedSettingsHash);
    const jobs = await readJobs();

    for (const job of jobs.filter(isActiveJob)) {
      const version = await getSoundCaseVersion(job.projectId, job.versionId).catch(() => null);
      if (version?.idempotencyKey === idempotencyKey && version.projectId === projectId) {
        return { version, created: false };
      }
    }

    const jobVersionIds = new Set(
      jobs.filter((job) => job.projectId === projectId).map((job) => job.versionId)
    );
    const canonicalVersionIds = await listSoundCaseVersionIds(projectId);
    const candidateVersionIds = new Set([
      ...project.versions.map((version) => version.id),
      ...canonicalVersionIds,
    ]);
    let orphan: SoundCaseVersion | null = null;
    for (const versionId of candidateVersionIds) {
      if (jobVersionIds.has(versionId)) continue;
      const version = await getSoundCaseVersion(projectId, versionId).catch(() => null);
      if (
        version?.idempotencyKey === idempotencyKey &&
        (version.status === "queued" ||
          version.status === "directing" ||
          version.status === "synthesizing" ||
          version.status === "assembling" ||
          version.status === "audio_ready" ||
          version.status === "interrupted")
      ) {
        orphan = version;
        break;
      }
    }
    if (orphan) {
      const now = (options.now ?? new Date()).toISOString();
      await upsertSoundCaseVersionProjection(projectId, summaryOf(orphan));
      await writeJobs([
        ...jobs,
        {
          id: crypto.randomUUID(),
          projectId,
          versionId: orphan.id,
          status: "queued",
          revision: 0,
          attempt: 0,
          nextRunAt: now,
          createdAt: now,
          updatedAt: now,
        },
      ]);
      return { version: orphan, created: false };
    }

    const now = (options.now ?? new Date()).toISOString();
    const versionId = crypto.randomUUID();
    const manifest: SoundCaseManifest = {
      versionId,
      sourceHash,
      format: settings.format || SOUNDCASE_DEFAULT_AUDIO_FORMAT,
      totalChunks: segments.length,
      completedChunks: 0,
      chunks: segments.map((segment) => ({
        id: segment.id,
        index: segment.index,
        segmentId: segment.id,
        start: segment.start,
        end: segment.end,
        textHash: segment.textHash,
        status: "pending",
        attempts: 0,
      })),
      createdAt: now,
      updatedAt: now,
    };
    const version: SoundCaseVersion = {
      id: versionId,
      projectId,
      status: "queued",
      sourceHash,
      settingsHash: requestedSettingsHash,
      idempotencyKey,
      wordCount: countSoundCaseWords(source),
      estimatedDurationSeconds,
      segments,
      requestedSettings: settings,
      effectiveSettings: null,
      direction: null,
      manifest,
      progress: {
        phase: "queued",
        ratio: 0,
        completedChunks: 0,
        totalChunks: segments.length,
        updatedAt: now,
      },
      audio: { status: "pending", format: settings.format },
      cover: { status: "pending" },
      summary: null,
      createdAt: now,
    };
    const job: SoundCaseJob = {
      id: crypto.randomUUID(),
      projectId,
      versionId,
      status: "queued",
      revision: 0,
      attempt: 0,
      nextRunAt: now,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await writeTextDurable(sourcePath(projectId, versionId), source);
      await writeVersion(version);
      await writeJobs([...jobs, job]);
      return { version, created: true };
    } catch (error) {
      await removeSoundCaseVersionProjection(
        projectId,
        versionId,
        project.activeVersionId
      ).catch(() => undefined);
      await removeVersionTree(projectId, versionId).catch(() => undefined);
      throw error;
    }
  });
}

function guardMatches(
  job: SoundCaseJob,
  guard: SoundCaseLeaseGuard,
  now: Date
): boolean {
  return (
    job.id === guard.jobId &&
    job.status === "running" &&
    job.leaseOwner === guard.workerId &&
    job.revision === guard.expectedRevision &&
    typeof job.leaseExpiresAt === "string" &&
    job.leaseExpiresAt > now.toISOString()
  );
}

export async function claimNextSoundCaseJob(
  options: { workerId: string; now?: Date }
): Promise<SoundCaseClaimedJob | null> {
  return withQueueLock(async () => {
    const now = options.now ?? new Date();
    const iso = now.toISOString();
    const jobs = await readJobs();
    if (
      jobs.some(
        (job) =>
          job.status === "running" &&
          Boolean(job.leaseExpiresAt && job.leaseExpiresAt > iso)
      )
    ) {
      return null;
    }
    const eligible = jobs
      .filter((job) => {
        if (job.nextRunAt > iso) return false;
        if (job.status === "queued" || job.status === "interrupted") return true;
        return job.status === "running" && Boolean(job.leaseExpiresAt && job.leaseExpiresAt <= iso);
      })
      .sort((left, right) =>
        left.nextRunAt.localeCompare(right.nextRunAt) ||
        left.createdAt.localeCompare(right.createdAt)
      )[0];
    if (!eligible) return null;

    const hydrated = await claimed(eligible);
    const index = jobs.findIndex((job) => job.id === eligible.id);
    const reclaimed = eligible.status === "running";
    const updated: SoundCaseJob = {
      ...eligible,
      status: "running",
      revision: eligible.revision + 1,
      attempt: eligible.attempt + (reclaimed ? 1 : 0),
      leaseOwner: options.workerId,
      leaseExpiresAt: new Date(now.getTime() + LEASE_DURATION_MS).toISOString(),
      updatedAt: iso,
    };
    jobs[index] = updated;
    await writeJobs(jobs);
    return { ...updated, version: hydrated.version, manifest: hydrated.manifest };
  });
}

export async function renewSoundCaseLease(
  guard: SoundCaseLeaseGuard,
  options: { now?: Date } = {}
): Promise<SoundCaseJob | null> {
  return withQueueLock(async () => {
    const jobs = await readJobs();
    const index = jobs.findIndex((job) => job.id === guard.jobId);
    const job = jobs[index];
    const now = options.now ?? new Date();
    if (!job || !guardMatches(job, guard, now)) {
      return null;
    }
    const updated: SoundCaseJob = {
      ...job,
      revision: job.revision + 1,
      leaseExpiresAt: new Date(now.getTime() + LEASE_DURATION_MS).toISOString(),
      updatedAt: now.toISOString(),
    };
    jobs[index] = updated;
    await writeJobs(jobs);
    return updated;
  });
}

export async function updateSoundCaseChunk(
  input: UpdateSoundCaseChunkInput,
  options: { now?: Date } = {}
): Promise<SoundCaseClaimedJob | null> {
  return withQueueLock(async () => {
    const jobs = await readJobs();
    const index = jobs.findIndex((job) => job.id === input.jobId);
    const job = jobs[index];
    const operationNow = options.now ?? new Date();
    if (!job || !guardMatches(job, input, operationNow)) return null;
    const version = await getSoundCaseVersion(job.projectId, job.versionId);
    const chunkIndex = version.manifest.chunks.findIndex((chunk) => chunk.id === input.chunkId);
    if (chunkIndex < 0) throw new SoundCaseJobError("soundcase_chunk_not_found", 404);
    if (
      input.status === "completed" &&
      !(await completedChunkIsValid(
        job.projectId,
        job.versionId,
        input.fileName,
        input.byteLength,
        input.contentHash
      ))
    ) {
      throw new SoundCaseJobError("soundcase_chunk_integrity_invalid", 422);
    }
    const chunks = [...version.manifest.chunks];
    chunks[chunkIndex] = {
      ...chunks[chunkIndex],
      status: input.status,
      attempts: chunks[chunkIndex].attempts + 1,
      ...(input.fileName ? { fileName: input.fileName } : {}),
      ...(input.durationSeconds !== undefined ? { durationSeconds: input.durationSeconds } : {}),
      ...(input.byteLength !== undefined ? { byteLength: input.byteLength } : {}),
      ...(input.contentHash ? { contentHash: input.contentHash } : {}),
      ...(input.errorCode ? { errorCode: input.errorCode } : {}),
    };
    const completedChunks = chunks.filter((chunk) => chunk.status === "completed").length;
    const now = operationNow.toISOString();
    const nextVersion: SoundCaseVersion = {
      ...version,
      status: "synthesizing",
      manifest: { ...version.manifest, chunks, completedChunks, updatedAt: now },
      progress: {
        phase: "synthesizing",
        ratio: version.manifest.totalChunks
          ? completedChunks / version.manifest.totalChunks
          : 0,
        completedChunks,
        totalChunks: version.manifest.totalChunks,
        updatedAt: now,
      },
    };
    await writeVersion(nextVersion);
    const updatedJob = { ...job, revision: job.revision + 1, updatedAt: now };
    jobs[index] = updatedJob;
    await writeJobs(jobs);
    return { ...updatedJob, version: nextVersion, manifest: nextVersion.manifest };
  });
}

export async function finishSoundCaseJob(
  guard: SoundCaseLeaseGuard,
  result: { status: "completed" | "interrupted" | "failed"; error?: SoundCasePublicError },
  options: { now?: Date } = {}
): Promise<SoundCaseJob | null> {
  return withQueueLock(async () => {
    const jobs = await readJobs();
    const index = jobs.findIndex((job) => job.id === guard.jobId);
    const job = jobs[index];
    const operationNow = options.now ?? new Date();
    if (!job || !guardMatches(job, guard, operationNow)) return null;
    const version = await getSoundCaseVersion(job.projectId, job.versionId);
    const now = operationNow.toISOString();
    const versionStatus = result.status === "completed" ? "ready" : result.status;
    const nextVersion: SoundCaseVersion = {
      ...version,
      status: versionStatus,
      progress: { ...version.progress, phase: versionStatus, updatedAt: now },
      ...(result.error ? { error: result.error } : {}),
      ...(result.status === "completed" ? { completedAt: now } : {}),
    };
    await writeVersion(nextVersion);
    const { leaseOwner: _owner, leaseExpiresAt: _expires, ...withoutLease } = job;
    const updated: SoundCaseJob = {
      ...withoutLease,
      status: result.status,
      revision: job.revision + 1,
      updatedAt: now,
      ...(result.error ? { lastErrorCode: result.error.code } : {}),
    };
    jobs[index] = updated;
    await writeJobs(jobs);
    return updated;
  });
}

export async function cancelSoundCaseVersion(
  projectId: string,
  versionId: string
): Promise<SoundCaseVersion> {
  return withQueueLock(async () => {
    const jobs = await readJobs();
    const index = jobs.findIndex((job) => job.projectId === projectId && job.versionId === versionId);
    if (index < 0) throw new SoundCaseJobError("soundcase_job_not_found", 404);
    const now = new Date().toISOString();
    const job = jobs[index];
    const { leaseOwner: _owner, leaseExpiresAt: _expires, ...withoutLease } = job;
    jobs[index] = {
      ...withoutLease,
      status: "canceled",
      revision: job.revision + 1,
      updatedAt: now,
    };
    await writeJobs(jobs);
    const version = await getSoundCaseVersion(projectId, versionId);
    const canceled: SoundCaseVersion = {
      ...version,
      status: "canceled",
      progress: { ...version.progress, phase: "canceled", updatedAt: now },
    };
    await writeVersion(canceled);
    return canceled;
  });
}

async function completedChunkIsValid(
  projectId: string,
  versionId: string,
  fileName: string | undefined,
  byteLength: number | undefined,
  contentHash: string | undefined
): Promise<boolean> {
  if (byteLength === undefined || contentHash === undefined) return false;
  const match = fileName?.match(/^chunks\/(\d{4,})\.flac$/u);
  if (!match) return false;
  const filePath = resolveSoundCasePath(
    "projects",
    projectId,
    "versions",
    versionId,
    "chunks",
    `${match[1]}.flac`
  );
  try {
    await assertRegularSoundCaseFile(filePath);
    const info = await fs.stat(filePath);
    if (info.size !== byteLength) return false;
    return hash(await fs.readFile(filePath)) === contentHash;
  } catch {
    return false;
  }
}

export async function resumeSoundCaseVersion(
  projectId: string,
  versionId: string
): Promise<SoundCaseVersion> {
  return withQueueLock(async () => {
    const jobs = await readJobs();
    const jobIndex = jobs.findIndex((job) => job.projectId === projectId && job.versionId === versionId);
    if (jobIndex < 0) throw new SoundCaseJobError("soundcase_job_not_found", 404);
    const version = await getSoundCaseVersion(projectId, versionId);
    const job = jobs[jobIndex];
    const partialResume =
      version.status === "queued" &&
      (job.status === "interrupted" || job.status === "failed");
    if (
      !partialResume &&
      version.status !== "interrupted" &&
      version.status !== "failed"
    ) {
      throw new SoundCaseJobError("soundcase_version_not_resumable");
    }

    const chunks = partialResume
      ? version.manifest.chunks
      : await Promise.all(
          version.manifest.chunks.map(async (chunk) => {
            if (chunk.status !== "completed") {
              return { ...chunk, status: "pending" as const };
            }
            if (
              await completedChunkIsValid(
                projectId,
                versionId,
                chunk.fileName,
                chunk.byteLength,
                chunk.contentHash
              )
            ) {
              return chunk;
            }
            const {
              fileName: _file,
              durationSeconds: _duration,
              byteLength: _bytes,
              contentHash: _hash,
              errorCode: _error,
              ...base
            } = chunk;
            return { ...base, status: "pending" as const };
          })
        );
    const completedChunks = chunks.filter((chunk) => chunk.status === "completed").length;
    const now = new Date().toISOString();
    const resumed: SoundCaseVersion = {
      ...version,
      status: "queued",
      manifest: { ...version.manifest, chunks, completedChunks, updatedAt: now },
      progress: {
        phase: "queued",
        ratio: version.manifest.totalChunks ? completedChunks / version.manifest.totalChunks : 0,
        completedChunks,
        totalChunks: version.manifest.totalChunks,
        updatedAt: now,
      },
    };
    delete resumed.error;
    delete resumed.completedAt;
    await writeVersion(resumed);

    const { leaseOwner: _owner, leaseExpiresAt: _expires, lastErrorCode: _error, ...withoutLease } = job;
    jobs[jobIndex] = {
      ...withoutLease,
      status: "queued",
      revision: job.revision + 1,
      nextRunAt: now,
      updatedAt: now,
    };
    await writeJobs(jobs);
    return resumed;
  });
}
