import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SoundCaseManifest } from "@/lib/soundcase/types";
import { assembleSoundCaseAudio, probeSoundCaseAudio, type SoundCaseExecFile } from "@/lib/server/soundcase/audio";
import { resolveSoundCasePath, writeBufferDurable } from "@/lib/server/soundcase/files";

let root: string;
let previousRoot: string | undefined;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(tmpdir(), "soundcase-audio-"));
  previousRoot = process.env.SOUNDCASE_DATA_DIR;
  process.env.SOUNDCASE_DATA_DIR = root;
});

afterEach(async () => {
  if (previousRoot === undefined) delete process.env.SOUNDCASE_DATA_DIR;
  else process.env.SOUNDCASE_DATA_DIR = previousRoot;
  await fs.rm(root, { recursive: true, force: true });
});

function manifest(): SoundCaseManifest {
  const now = new Date(0).toISOString();
  return {
    versionId: "version-a", sourceHash: "hash", format: "mp3",
    totalChunks: 3, completedChunks: 3, createdAt: now, updatedAt: now,
    chunks: [2, 0, 1].map((index) => ({
      id: `chunk-${index}`, index, segmentId: `segment-${index}`,
      start: index, end: index + 1, textHash: `hash-${index}`,
      status: "completed", attempts: 1,
      fileName: `chunks/${String(index).padStart(4, "0")}.flac`,
      durationSeconds: 1, byteLength: 8, contentHash: "hash",
    })),
  };
}

describe("SoundCase audio pipeline", () => {
  it("assembles chunks in manifest order and validates before promotion", async () => {
    for (let index = 0; index < 3; index += 1) {
      await writeBufferDurable(resolveSoundCasePath(
        "projects", "project-a", "versions", "version-a", "chunks",
        `${String(index).padStart(4, "0")}.flac`
      ), Buffer.from("fLaCdata"));
    }
    const calls: Array<{ file: string; args: string[]; cwd?: string }> = [];
    const execFile: SoundCaseExecFile = vi.fn(async (file, args, options) => {
      calls.push({ file, args, cwd: options?.cwd });
      if (file.endsWith("ffmpeg")) await fs.writeFile(args.at(-1)!, Buffer.from("ID3audio"));
      return file.endsWith("ffprobe")
        ? { stdout: JSON.stringify({ streams: [{ codec_name: "mp3", duration: "3.2" }] }), stderr: "" }
        : { stdout: "", stderr: "" };
    });

    const audio = await assembleSoundCaseAudio({
      projectId: "project-a", versionId: "version-a", manifest: manifest(),
      format: "mp3", title: "Título\nnão quebra", execFile,
    });

    await expect(fs.readFile(resolveSoundCasePath(
      "projects", "project-a", "versions", "version-a", "chunks", "concat.txt"
    ), "utf8")).resolves.toBe("file '0000.flac'\nfile '0001.flac'\nfile '0002.flac'\n");
    expect(audio).toMatchObject({ format: "mp3", durationSeconds: 3.2, fileName: "final.mp3" });
    expect(calls[0].args).toContain("libmp3lame");
    expect(calls[0].args).toContain("192k");
  });

  it("rejects a wrong codec or non-positive duration", async () => {
    const execFile: SoundCaseExecFile = async () => ({
      stdout: JSON.stringify({ streams: [{ codec_name: "flac", duration: "0" }] }), stderr: "",
    });
    await expect(probeSoundCaseAudio("/tmp/not-used", "mp3", execFile))
      .rejects.toThrow("soundcase_audio_probe_mismatch");
  });

  it.each([
    ["flac", "flac", "flac"],
    ["wav", "pcm_s16le", "pcm_s16le"],
  ] as const)("uses the required %s encoder and validates its codec", async (format, encoder, codec) => {
    const single = manifest();
    single.format = format;
    single.totalChunks = 1;
    single.completedChunks = 1;
    single.chunks = [single.chunks.find((chunk) => chunk.index === 0)!];
    await writeBufferDurable(resolveSoundCasePath(
      "projects", "project-a", "versions", "version-a", "chunks", "0000.flac"
    ), Buffer.from("fLaCdata"));
    const execFile: SoundCaseExecFile = vi.fn(async (file, args) => {
      if (file.endsWith("ffmpeg")) await fs.writeFile(args.at(-1)!, Buffer.from("audio"));
      return file.endsWith("ffprobe")
        ? { stdout: JSON.stringify({ streams: [{ codec_name: codec, duration: "1" }] }), stderr: "" }
        : { stdout: "", stderr: "" };
    });

    await assembleSoundCaseAudio({
      projectId: "project-a", versionId: "version-a", manifest: single,
      format, title: "Teste", execFile,
    });

    expect(vi.mocked(execFile).mock.calls[0][1]).toContain(encoder);
  });
});
