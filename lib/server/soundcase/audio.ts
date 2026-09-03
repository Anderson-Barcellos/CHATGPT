import { createHash } from "node:crypto";
import { execFile as nodeExecFile } from "node:child_process";
import { promises as fs } from "node:fs";
import type { TtsAudioFormat } from "@/types";
import type {
  SoundCaseChunk,
  SoundCaseDirection,
  SoundCaseEffectiveSettings,
  SoundCaseManifest,
  SoundCaseSegment,
} from "@/lib/soundcase/types";
import { TTS_MODEL } from "@/lib/tts/speechText";
import {
  promoteSoundCaseFile,
  resolveSoundCasePath,
  writeBufferDurable,
  writeTextDurable,
} from "@/lib/server/soundcase/files";

export type SoundCaseExecFile = (
  file: string,
  args: string[],
  options?: { cwd?: string }
) => Promise<{ stdout: string; stderr: string }>;

export interface SoundCaseSpeechClient {
  audio: {
    speech: {
      create(input: {
        model: string;
        voice: string;
        input: string;
        speed: number;
        instructions: string;
        response_format: "flac";
      }): Promise<{ arrayBuffer(): Promise<ArrayBuffer> }>;
    };
  };
}

const FFMPEG_PATH = "/usr/bin/ffmpeg";
const FFPROBE_PATH = "/usr/bin/ffprobe";
const FORMAT_CONFIG: Record<
  TtsAudioFormat,
  { codec: string; muxer: string; contentType: string; encode: string[] }
> = {
  mp3: {
    codec: "mp3",
    muxer: "mp3",
    contentType: "audio/mpeg",
    encode: ["-c:a", "libmp3lame", "-b:a", "192k"],
  },
  flac: {
    codec: "flac",
    muxer: "flac",
    contentType: "audio/flac",
    encode: ["-c:a", "flac"],
  },
  wav: {
    codec: "pcm_s16le",
    muxer: "wav",
    contentType: "audio/wav",
    encode: ["-c:a", "pcm_s16le"],
  },
};

function defaultExecFile(
  file: string,
  args: string[],
  options: { cwd?: string } = {}
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    nodeExecFile(file, args, options, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve({ stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

export async function probeSoundCaseAudio(
  filePath: string,
  expectedFormat: TtsAudioFormat,
  execFile: SoundCaseExecFile = defaultExecFile
): Promise<number> {
  const { stdout } = await execFile(FFPROBE_PATH, [
    "-v", "error", "-select_streams", "a:0",
    "-show_entries", "stream=codec_name,duration:format=duration",
    "-of", "json", filePath,
  ]);
  let parsed: {
    streams?: Array<{ codec_name?: unknown; duration?: unknown }>;
    format?: { duration?: unknown };
  };
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error("soundcase_audio_probe_invalid");
  }
  const stream = parsed.streams?.[0];
  const duration = Number(stream?.duration ?? parsed.format?.duration);
  if (
    stream?.codec_name !== FORMAT_CONFIG[expectedFormat].codec ||
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    throw new Error("soundcase_audio_probe_mismatch");
  }
  return duration;
}

export async function synthesizeSoundCaseChunk(input: {
  projectId: string;
  versionId: string;
  chunk: SoundCaseChunk;
  segment: SoundCaseSegment;
  direction: SoundCaseDirection;
  effectiveSettings: SoundCaseEffectiveSettings;
  client: SoundCaseSpeechClient;
  execFile?: SoundCaseExecFile;
  beforeProvider?: () => Promise<void>;
  afterProvider?: () => Promise<void>;
}): Promise<{
  fileName: string;
  durationSeconds: number;
  byteLength: number;
  contentHash: string;
}> {
  await input.beforeProvider?.();
  const segmentDirection = input.direction.segmentDirections.find(
    (item) => item.segmentId === input.segment.id
  )?.instructions;
  let bytes: Buffer;
  try {
    const response = await input.client.audio.speech.create({
      model: TTS_MODEL,
      voice: input.effectiveSettings.voice.value,
      input: input.segment.text,
      speed: input.effectiveSettings.speed.value,
      instructions: [
        input.effectiveSettings.instructions.value,
        segmentDirection,
      ].filter(Boolean).join("\n\n"),
      response_format: "flac",
    });
    bytes = Buffer.from(await response.arrayBuffer());
  } catch (error) {
    await input.afterProvider?.();
    throw error;
  }
  await input.afterProvider?.();
  if (bytes.length < 4 || bytes.subarray(0, 4).toString("ascii") !== "fLaC") {
    throw new Error("soundcase_chunk_flac_invalid");
  }

  const chunkName = `${String(input.chunk.index).padStart(4, "0")}.flac`;
  const finalPath = resolveSoundCasePath(
    "projects", input.projectId, "versions", input.versionId, "chunks", chunkName
  );
  const partPath = `${finalPath}.part`;
  await writeBufferDurable(partPath, bytes);
  try {
    const durationSeconds = await probeSoundCaseAudio(
      partPath,
      "flac",
      input.execFile ?? defaultExecFile
    );
    await promoteSoundCaseFile(partPath, finalPath);
    return {
      fileName: `chunks/${chunkName}`,
      durationSeconds,
      byteLength: bytes.length,
      contentHash: createHash("sha256").update(bytes).digest("hex"),
    };
  } catch (error) {
    await fs.rm(partPath, { force: true });
    throw error;
  }
}

function safeMetadata(value: string): string {
  return value.replace(/[\0\r\n]/gu, " ").trim().slice(0, 160);
}

export async function assembleSoundCaseAudio(input: {
  projectId: string;
  versionId: string;
  manifest: SoundCaseManifest;
  format: TtsAudioFormat;
  title: string;
  execFile?: SoundCaseExecFile;
  beforeWork?: () => Promise<void>;
  afterWork?: () => Promise<void>;
}): Promise<{
  format: TtsAudioFormat;
  durationSeconds: number;
  contentType: string;
  fileName: string;
}> {
  const execFile = input.execFile ?? defaultExecFile;
  const chunks = [...input.manifest.chunks].sort((a, b) => a.index - b.index);
  if (
    chunks.length !== input.manifest.totalChunks ||
    chunks.some((chunk, index) => chunk.index !== index || chunk.status !== "completed")
  ) {
    throw new Error("soundcase_manifest_incomplete");
  }
  const chunksDirectory = resolveSoundCasePath(
    "projects", input.projectId, "versions", input.versionId, "chunks"
  );
  const concatPath = resolveSoundCasePath(
    "projects", input.projectId, "versions", input.versionId, "chunks", "concat.txt"
  );
  const concat = chunks
    .map((chunk) => `file '${String(chunk.index).padStart(4, "0")}.flac'`)
    .join("\n") + "\n";
  await writeTextDurable(concatPath, concat);
  const fileName = `final.${input.format}`;
  const finalPath = resolveSoundCasePath(
    "projects", input.projectId, "versions", input.versionId, fileName
  );
  const partPath = `${finalPath}.part`;
  const config = FORMAT_CONFIG[input.format];
  await input.beforeWork?.();
  let durationSeconds = 0;
  let workError: unknown;
  try {
    await execFile(FFMPEG_PATH, [
      "-y", "-nostdin", "-f", "concat", "-safe", "1", "-i", "concat.txt",
      "-map", "0:a:0", "-vn", ...config.encode,
      "-metadata", `title=${safeMetadata(input.title)}`,
      "-f", config.muxer, partPath,
    ], { cwd: chunksDirectory });
    durationSeconds = await probeSoundCaseAudio(partPath, input.format, execFile);
  } catch (error) {
    workError = error;
  }
  try {
    await input.afterWork?.();
  } catch (error) {
    await fs.rm(partPath, { force: true });
    throw error;
  }
  if (workError) {
    await fs.rm(partPath, { force: true });
    throw workError;
  }
  await promoteSoundCaseFile(partPath, finalPath);
  return { format: input.format, durationSeconds, contentType: config.contentType, fileName };
}
