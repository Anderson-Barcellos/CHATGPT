import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SoundCaseManifest } from "@/lib/soundcase/types";
import { assembleSoundCaseAudio, probeSoundCaseAudio, synthesizeSoundCaseChunk, type SoundCaseExecFile } from "@/lib/server/soundcase/audio";
import { resolveSoundCasePath, writeBufferDurable } from "@/lib/server/soundcase/files";
import { segmentSoundCaseText } from "@/lib/soundcase/text";
import { buildFallbackSoundCaseDirection } from "@/lib/server/soundcase/direction";

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
  it("sends exact text and promotes a probed FLAC only after lease hooks", async () => {
    const [segment] = segmentSoundCaseText("Texto exato, sem reescrita.");
    const direction = buildFallbackSoundCaseDirection({ sourceText: segment.text, segments: [segment] });
    const events: string[] = [];
    const create = vi.fn(async () => {
      events.push("provider");
      return new Response(Buffer.from("fLaCdata"));
    });
    const execFile: SoundCaseExecFile = vi.fn(async () => ({
      stdout: JSON.stringify({ streams: [{ codec_name: "flac", duration: "1.5" }] }), stderr: "",
    }));
    const artifact = await synthesizeSoundCaseChunk({
      projectId: "project-a", versionId: "version-a",
      chunk: {
        id: segment.id, index: 0, segmentId: segment.id, start: segment.start,
        end: segment.end, textHash: segment.textHash, status: "synthesizing", attempts: 1,
      },
      segment, direction,
      effectiveSettings: {
        format: { value: "mp3", source: "automatic" },
        voice: { value: "marin", source: "fallback" },
        speed: { value: 1, source: "fallback" },
        instructions: { value: direction.globalInstructions, source: "fallback" },
      },
      client: { audio: { speech: { create } } }, execFile,
      beforeProvider: async () => { events.push("before"); },
      afterProvider: async () => { events.push("after"); },
    });

    expect(events).toEqual(["before", "provider", "after"]);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      model: "gpt-4o-mini-tts", input: segment.text, voice: "marin",
      speed: 1, response_format: "flac",
    }), expect.objectContaining({ signal: undefined }));
    expect(artifact).toMatchObject({ fileName: "chunks/0000.flac", durationSeconds: 1.5, byteLength: 8 });
    await expect(fs.readFile(resolveSoundCasePath(
      "projects", "project-a", "versions", "version-a", "chunks", "0000.flac"
    ))).resolves.toEqual(Buffer.from("fLaCdata"));
  });

  it("assembles chunks in manifest order and validates before promotion", async () => {
    for (let index = 0; index < 3; index += 1) {
      await writeBufferDurable(resolveSoundCasePath(
        "projects", "project-a", "versions", "version-a", "chunks",
        `${String(index).padStart(4, "0")}.flac`
      ), Buffer.from("fLaCdata"));
    }
    const calls: Array<{ file: string; args: string[]; cwd?: string }> = [];
    await fs.writeFile(resolveSoundCasePath(
      "projects", "project-a", "versions", "version-a", "final.mp3.abandoned.part"
    ), Buffer.alloc(32));
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
    expect(calls[0].args).toEqual(expect.arrayContaining([
      "-hide_banner", "-loglevel", "error", "-nostats", "-n",
    ]));
    await expect(fs.access(resolveSoundCasePath(
      "projects", "project-a", "versions", "version-a", "final.mp3.abandoned.part"
    ))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("falls back to packet timing when the FLAC container reports no duration", async () => {
    const calls: string[][] = [];
    const execFile: SoundCaseExecFile = vi.fn(async (_file, args) => {
      calls.push(args);
      if (args.includes("packet=pts_time,duration_time")) {
        return { stdout: "0.000000,0.170667\n0.170667,0.170667\n2.208000,0.010667\n", stderr: "" };
      }
      return {
        stdout: JSON.stringify({ streams: [{ codec_name: "flac", duration: "N/A" }], format: { duration: "N/A" } }),
        stderr: "",
      };
    });

    const duration = await probeSoundCaseAudio("/tmp/not-used", "flac", execFile);

    expect(duration).toBeCloseTo(2.218667, 5);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("packet=pts_time,duration_time");
  });

  it("rejects when neither the container nor the packets carry a duration", async () => {
    const execFile: SoundCaseExecFile = async (_file, args) => (
      args.includes("packet=pts_time,duration_time")
        ? { stdout: "", stderr: "" }
        : { stdout: JSON.stringify({ streams: [{ codec_name: "flac" }] }), stderr: "" }
    );
    await expect(probeSoundCaseAudio("/tmp/not-used", "flac", execFile))
      .rejects.toThrow("soundcase_audio_probe_mismatch");
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
