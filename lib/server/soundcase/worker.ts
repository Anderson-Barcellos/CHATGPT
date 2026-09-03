import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import type OpenAI from "openai";
import type {
  SoundCaseClaimedJob,
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
import { resolveSoundCasePath } from "@/lib/server/soundcase/files";

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
  | { status: "canceled"; versionId: string };

class LeaseLostError extends Error {
  constructor() {
    super("soundcase_lease_lost");
  }
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

function safeError(error: unknown): SoundCasePublicError {
  const code = error instanceof Error && /^soundcase_[a-z0-9_]+$/u.test(error.message)
    ? error.message
    : "soundcase_generation_interrupted";
  return {
    code,
    message: "A geração foi interrompida com segurança e poderá ser retomada.",
    diagnosticId: crypto.randomUUID(),
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
    const bytes = await fs.readFile(filePath);
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
        let lastError: unknown;
        for (let attempt = 0; attempt < 4; attempt += 1) {
          await state.mutate((guard) => updateSoundCaseChunk({
            ...guard, chunkId: chunk.id, status: "synthesizing",
          }, { now: now() }));
          try {
            const artifact = await synthesizeSoundCaseChunk({
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
            });
            const persisted = await state.mutate((guard) => updateSoundCaseChunk({
              ...guard, chunkId: chunk.id, status: "completed", ...artifact,
            }, { now: now() }));
            version = persisted!.version;
            return;
          } catch (error) {
            if (error instanceof LeaseLostError) throw error;
            lastError = error;
            await state.mutate((guard) => updateSoundCaseChunk({
              ...guard, chunkId: chunk.id, status: "failed", errorCode: "soundcase_chunk_failed",
            }, { now: now() }));
            if (attempt < 3) await sleep(jitter(1_000 * 2 ** attempt));
          }
        }
        throw lastError ?? new Error("soundcase_chunk_failed");
      }));
      version = await getSoundCaseVersion(version.projectId, version.id);
    }

    await state.mutate((guard) => setSoundCaseVersionPhase(guard, "assembling", { now: now() }));
    version = await getSoundCaseVersion(version.projectId, version.id);
    await state.checkpoint();
    const audio = await assembleSoundCaseAudio({
      projectId: version.projectId,
      versionId: version.id,
      manifest: version.manifest,
      format: effective.format.value,
      title: direction.title,
      execFile: deps.execFile,
    });
    await state.checkpoint();
    await state.mutate((guard) => setSoundCaseAudioReady(guard, { status: "ready", ...audio }, { now: now() }));
    await state.checkpoint();
    const cover = await generateSoundCaseCover({
      projectId: version.projectId,
      versionId: version.id,
      title: direction.title,
      prompt: direction.coverPrompt,
      client: client as SoundCaseImageClient,
    });
    await state.checkpoint();
    await state.mutate((guard) => setSoundCaseCoverReady(guard, cover, { now: now() }));
    await state.mutate((guard) => finishSoundCaseJob(guard, { status: "completed" }, { now: now() }));
    return { status: "completed", versionId: version.id };
  } catch (error) {
    if (error instanceof LeaseLostError) {
      return { status: "canceled", versionId: claimed.versionId };
    }
    const publicError = safeError(error);
    try {
      await state.mutate((guard) => finishSoundCaseJob(guard, {
        status: "interrupted",
        error: publicError,
        nextRunAt: new Date(now().getTime() + 8_000).toISOString(),
      }, { now: now() }));
    } catch (finishError) {
      if (finishError instanceof LeaseLostError) {
        return { status: "canceled", versionId: claimed.versionId };
      }
      throw finishError;
    }
    return { status: "interrupted", versionId: claimed.versionId, error: publicError };
  }
}
