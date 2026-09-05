import { createHash } from "node:crypto";
import type OpenAI from "openai";
import type {
  SoundCaseClaimedJob,
  SoundCaseAudioReady,
  SoundCaseCoverReady,
  SoundCaseDirection,
  SoundCaseEffectiveSettings,
  SoundCaseLeaseGuard,
  SoundCasePublicError,
  SoundCaseVersion,
} from "@/lib/soundcase/types";
import { createOpenAIClient } from "@/lib/server/chatRequest";
import {
  DEFAULT_TTS_INSTRUCTIONS,
  buildFallbackSoundCaseDirection,
  directSoundCase,
} from "@/lib/server/soundcase/direction";
import {
  claimNextSoundCaseJob,
  finishSoundCaseJob,
  getSoundCaseVersion,
  readSoundCaseVersionSource,
  renewSoundCaseLease,
  setSoundCaseAudioReady,
  setSoundCaseCoverReady,
  setSoundCaseDirection,
  setSoundCaseVersionPhase,
  updateSoundCaseChunk,
} from "@/lib/server/soundcase/jobs";
import {
  assembleSoundCaseAudio,
  probeSoundCaseAudio,
  synthesizeSoundCaseChunk,
  type SoundCaseExecFile,
  type SoundCaseSpeechClient,
} from "@/lib/server/soundcase/audio";
import {
  generateSoundCaseCover,
  type SoundCaseImageClient,
} from "@/lib/server/soundcase/cover";
import {
  assertRegularSoundCaseFile,
  readBufferSafe,
  resolveSoundCasePath,
} from "@/lib/server/soundcase/files";

export interface SoundCaseWorkerDeps {
  workerId: string;
  openai?: OpenAI | null;
  execFile?: SoundCaseExecFile;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
  jitter?: (milliseconds: number) => number;
}

export type SoundCaseWorkerResult =
  | { status: "empty" }
  | { status: "completed"; versionId: string }
  | { status: "interrupted"; versionId: string; error: SoundCasePublicError }
  | { status: "failed"; versionId: string; error: SoundCasePublicError }
  | { status: "canceled"; versionId: string };

class LeaseLostError extends Error {
  constructor() {
    super("soundcase_lease_lost");
  }
}

class ChunkAttemptsExhaustedError extends Error {
  constructor() {
    super("soundcase_chunk_attempts_exhausted");
  }
}

class ChunkPermanentError extends Error {
  constructor(cause?: unknown) {
    super("soundcase_chunk_permanent_failure", { cause });
  }
}

function isRetryableChunkError(error: unknown): boolean {
  if (error && typeof error === "object" && "status" in error) {
    const status = Number((error as { status?: unknown }).status);
    if (status === 429 || status >= 500) return true;
    if (status >= 400) return false;
  }
  if (error instanceof Error && (
    error.message === "soundcase_chunk_flac_invalid" ||
    error.message === "soundcase_audio_probe_invalid" ||
    error.message === "soundcase_audio_probe_mismatch" ||
    error.name === "SoundCaseFileError"
  )) return false;
  return true;
}

async function withLeaseHeartbeat<T>(
  checkpoint: () => Promise<unknown>,
  operation: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  await checkpoint();
  const controller = new AbortController();
  let heartbeatError: unknown;
  let heartbeat = Promise.resolve();
  const timer = setInterval(() => {
    heartbeat = heartbeat.then(async () => {
      try {
        await checkpoint();
      } catch (error) {
        heartbeatError = error;
        controller.abort();
      }
    });
  }, 30_000);
  timer.unref?.();
  let result: T | undefined;
  let operationError: unknown;
  try {
    result = await operation(controller.signal);
  } catch (error) {
    operationError = error;
  } finally {
    clearInterval(timer);
  }
  await heartbeat;
  if (heartbeatError) throw heartbeatError;
  await checkpoint();
  if (operationError) throw operationError;
  return result as T;
}

function resolveEffectiveSettings(
  version: SoundCaseVersion,
  direction: SoundCaseDirection
): SoundCaseEffectiveSettings {
  const requested = version.requestedSettings;
  return {
    format: { value: requested.format, source: requested.format === "mp3" ? "automatic" : "override" },
    voice: requested.voiceOverride
      ? { value: requested.voiceOverride, source: "override" }
      : { value: direction.voice, source: direction.source === "automatic" ? "automatic" : "fallback" },
    speed: requested.speedOverride !== null
      ? { value: requested.speedOverride, source: "override" }
      : { value: direction.speed, source: direction.source === "automatic" ? "automatic" : "fallback" },
    instructions: requested.instructionsOverride
      ? {
          value: `${requested.instructionsOverride.trim()}\n\n${DEFAULT_TTS_INSTRUCTIONS}`,
          source: "override",
        }
      : { value: direction.globalInstructions, source: direction.source === "automatic" ? "automatic" : "fallback" },
  };
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    const status = "status" in error ? ` status=${String((error as { status?: unknown }).status)}` : "";
    return `${error.name}: ${error.message}${status}`;
  }
  return String(error);
}

function safeError(error: unknown): SoundCasePublicError {
  const code = error instanceof Error && /^soundcase_[a-z0-9_]+$/u.test(error.message)
    ? error.message
    : "soundcase_generation_interrupted";
  const diagnosticId = crypto.randomUUID();
  // O cliente só vê code + diagnosticId; o erro real fica no journal do serviço.
  const cause = error instanceof Error && error.cause !== undefined ? error.cause : undefined;
  console.error("[soundcase] generation failed", {
    diagnosticId,
    code,
    error: describeError(error),
    cause: cause === undefined ? undefined : describeError(cause),
  });
  return {
    code,
    message: "A geração foi interrompida com segurança e poderá ser retomada.",
    diagnosticId,
  };
}

function createSerialGuard(claimed: SoundCaseClaimedJob, now: () => Date) {
  const guard: SoundCaseLeaseGuard = {
    jobId: claimed.id,
    workerId: claimed.leaseOwner!,
    expectedRevision: claimed.revision,
  };
  let chain = Promise.resolve();
  async function serial<T extends { revision: number } | null>(
    operation: (current: SoundCaseLeaseGuard) => Promise<T>
  ): Promise<T> {
    let result!: T;
    let failure: unknown;
    chain = chain.then(async () => {
      try {
        result = await operation({ ...guard });
        if (!result) throw new LeaseLostError();
        guard.expectedRevision = result.revision;
      } catch (error) {
        failure = error;
      }
    });
    await chain;
    if (failure) throw failure;
    return result;
  }
  return {
    guard,
    checkpoint: () => serial((current) => renewSoundCaseLease(current, { now: now() })),
    mutate: <T extends { revision: number } | null>(
      operation: (current: SoundCaseLeaseGuard) => Promise<T>
    ) => serial(operation),
  };
}

async function completedChunkValid(
  version: SoundCaseVersion,
  chunkIndex: number,
  execFile: SoundCaseExecFile | undefined
): Promise<boolean> {
  const chunk = version.manifest.chunks[chunkIndex];
  if (
    chunk.status !== "completed" ||
    chunk.fileName !== `chunks/${String(chunk.index).padStart(4, "0")}.flac` ||
    !chunk.byteLength ||
    !chunk.contentHash
  ) return false;
  const filePath = resolveSoundCasePath(
    "projects", version.projectId, "versions", version.id,
    "chunks", `${String(chunk.index).padStart(4, "0")}.flac`
  );
  try {
    const bytes = await readBufferSafe(filePath);
    if (!bytes) return false;
    if (
      bytes.length !== chunk.byteLength ||
      createHash("sha256").update(bytes).digest("hex") !== chunk.contentHash
    ) return false;
    await probeSoundCaseAudio(filePath, "flac", execFile);
    return true;
  } catch {
    return false;
  }
}

async function existingAudio(
  version: SoundCaseVersion,
  execFile: SoundCaseExecFile | undefined
): Promise<SoundCaseAudioReady | null> {
  const format = version.effectiveSettings?.format.value ?? version.requestedSettings.format;
  const fileName = `final.${format}`;
  const filePath = resolveSoundCasePath(
    "projects", version.projectId, "versions", version.id, fileName
  );
  try {
    await assertRegularSoundCaseFile(filePath);
    const durationSeconds = await probeSoundCaseAudio(filePath, format, execFile);
    const contentType = format === "mp3" ? "audio/mpeg" : format === "flac" ? "audio/flac" : "audio/wav";
    return { status: "ready", format, durationSeconds, contentType, fileName };
  } catch {
    return null;
  }
}

async function existingCover(version: SoundCaseVersion): Promise<SoundCaseCoverReady | null> {
  for (const candidate of [
    { status: "ready" as const, fileName: "cover.png", contentType: "image/png" as const },
    { status: "fallback" as const, fileName: "cover.svg", contentType: "image/svg+xml" as const },
  ]) {
    const filePath = resolveSoundCasePath(
      "projects", version.projectId, "versions", version.id, candidate.fileName
    );
    try {
      const bytes = await readBufferSafe(filePath);
      if (!bytes) continue;
      const valid = candidate.fileName.endsWith(".png")
        ? bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
        : bytes.subarray(0, 256).toString("utf8").includes("<svg");
      if (valid) return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

export async function runNextSoundCaseJob(
  deps: SoundCaseWorkerDeps
): Promise<SoundCaseWorkerResult> {
  const now = deps.now ?? (() => new Date());
  const sleep = deps.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const jitter = deps.jitter ?? ((milliseconds) => milliseconds);
  const client = deps.openai === undefined ? createOpenAIClient() : deps.openai;
  const claimed = await claimNextSoundCaseJob({ workerId: deps.workerId, now: now() });
  if (!claimed) return { status: "empty" };
  const state = createSerialGuard(claimed, now);

  try {
    let version = claimed.version;
    const sourceText = await readSoundCaseVersionSource(version.projectId, version.id);
    let direction = version.direction;
    let effective = version.effectiveSettings;
    if (!direction || !effective) {
      await state.mutate((guard) => setSoundCaseVersionPhase(guard, "directing", { now: now() }));
      await state.checkpoint();
      direction = version.requestedSettings.automatic
        ? await directSoundCase({ sourceText, segments: version.segments }, client)
        : buildFallbackSoundCaseDirection({ sourceText, segments: version.segments });
      await state.checkpoint();
      effective = resolveEffectiveSettings(version, direction);
      const persisted = await state.mutate((guard) =>
        setSoundCaseDirection(guard, { direction: direction!, effectiveSettings: effective! }, { now: now() })
      );
      version = persisted!.version;
    }

    const pendingIndexes: number[] = [];
    for (let index = 0; index < version.manifest.chunks.length; index += 1) {
      if (!(await completedChunkValid(version, index, deps.execFile))) pendingIndexes.push(index);
    }

    for (let offset = 0; offset < pendingIndexes.length; offset += 2) {
      const batch = pendingIndexes.slice(offset, offset + 2);
      await Promise.all(batch.map(async (chunkIndex) => {
        const chunk = version.manifest.chunks[chunkIndex];
        const segment = version.segments.find((item) => item.id === chunk.segmentId);
        if (!segment) throw new Error("soundcase_segment_missing");
        for (let attempt = chunk.attempts; attempt < 4; attempt += 1) {
          await state.mutate((guard) => updateSoundCaseChunk({
            ...guard, chunkId: chunk.id, status: "synthesizing",
          }, { now: now() }));
          try {
            const artifact = await withLeaseHeartbeat(state.checkpoint, (signal) =>
              synthesizeSoundCaseChunk({
                projectId: version.projectId,
                versionId: version.id,
                chunk,
                segment,
                direction: direction!,
                effectiveSettings: effective!,
                client: client as SoundCaseSpeechClient,
                execFile: deps.execFile,
                beforeProvider: async () => { await state.checkpoint(); },
                afterProvider: async () => { await state.checkpoint(); },
                signal,
              })
            );
            const persisted = await state.mutate((guard) => updateSoundCaseChunk({
              ...guard, chunkId: chunk.id, status: "completed", ...artifact,
            }, { now: now() }));
            version = persisted!.version;
            return;
          } catch (error) {
            if (error instanceof LeaseLostError) throw error;
            await state.mutate((guard) => updateSoundCaseChunk({
              ...guard, chunkId: chunk.id, status: "failed", errorCode: "soundcase_chunk_failed",
            }, { now: now() }));
            if (!isRetryableChunkError(error)) throw new ChunkPermanentError(error);
            if (attempt < 3) await sleep(jitter(1_000 * 2 ** attempt));
          }
        }
        throw new ChunkAttemptsExhaustedError();
      }));
      version = await getSoundCaseVersion(version.projectId, version.id);
    }

    version = await getSoundCaseVersion(version.projectId, version.id);
    let audio = await existingAudio(version, deps.execFile);
    const audioWasConfirmed = version.audio.status === "ready" && audio !== null;
    if (!audio) {
      await state.mutate((guard) => setSoundCaseVersionPhase(guard, "assembling", { now: now() }));
      const assembled = await withLeaseHeartbeat(state.checkpoint, (signal) => assembleSoundCaseAudio({
        projectId: version.projectId,
        versionId: version.id,
        manifest: version.manifest,
        format: effective.format.value,
        title: direction.title,
        execFile: deps.execFile,
        beforeWork: async () => { await state.checkpoint(); },
        afterWork: async () => { await state.checkpoint(); },
        signal,
      }));
      audio = { status: "ready", ...assembled };
    }
    if (!audioWasConfirmed) {
      const persisted = await state.mutate((guard) => setSoundCaseAudioReady(guard, audio!, { now: now() }));
      version = persisted!.version;
    }
    let cover = await existingCover(version);
    const coverWasConfirmed = version.cover.status !== "pending" && cover !== null;
    if (!cover) {
      cover = await withLeaseHeartbeat(state.checkpoint, (signal) => generateSoundCaseCover({
        projectId: version.projectId,
        versionId: version.id,
        title: direction.title,
        prompt: direction.coverPrompt,
        client: client as SoundCaseImageClient,
        beforeProvider: async () => { await state.checkpoint(); },
        afterProvider: async () => { await state.checkpoint(); },
        signal,
      }));
    }
    if (!coverWasConfirmed) {
      const persisted = await state.mutate((guard) => setSoundCaseCoverReady(guard, cover, { now: now() }));
      version = persisted!.version;
    }
    await state.mutate((guard) => finishSoundCaseJob(guard, { status: "completed" }, { now: now() }));
    return { status: "completed", versionId: version.id };
  } catch (error) {
    if (error instanceof LeaseLostError) {
      return { status: "canceled", versionId: claimed.versionId };
    }
    const publicError = safeError(error);
    const terminalStatus = error instanceof ChunkAttemptsExhaustedError || error instanceof ChunkPermanentError
      ? "failed" as const
      : "interrupted" as const;
    try {
      await state.mutate((guard) => finishSoundCaseJob(guard, {
        status: terminalStatus,
        error: publicError,
        nextRunAt: new Date(now().getTime() + 8_000).toISOString(),
      }, { now: now() }));
    } catch (finishError) {
      if (finishError instanceof LeaseLostError) {
        return { status: "canceled", versionId: claimed.versionId };
      }
      throw finishError;
    }
    return { status: terminalStatus, versionId: claimed.versionId, error: publicError };
  }
}
