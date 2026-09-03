import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type OpenAI from "openai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SoundCaseGenerationSettings } from "@/lib/soundcase/types";
import { cancelSoundCaseVersion, createSoundCaseVersion, getSoundCaseVersion, resumeSoundCaseVersion } from "@/lib/server/soundcase/jobs";
import { createSoundCaseProject } from "@/lib/server/soundcase/store";
import { runNextSoundCaseJob } from "@/lib/server/soundcase/worker";
import type { SoundCaseExecFile } from "@/lib/server/soundcase/audio";

let root: string;
let previousRoot: string | undefined;
const settings: SoundCaseGenerationSettings = {
  automatic: false, playbackMode: "realtime", format: "mp3",
  voiceOverride: null, speedOverride: null, instructionsOverride: null,
};

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(tmpdir(), "soundcase-worker-"));
  previousRoot = process.env.SOUNDCASE_DATA_DIR;
  process.env.SOUNDCASE_DATA_DIR = root;
});

afterEach(async () => {
  if (previousRoot === undefined) delete process.env.SOUNDCASE_DATA_DIR;
  else process.env.SOUNDCASE_DATA_DIR = previousRoot;
  await fs.rm(root, { recursive: true, force: true });
});

function fakeExec(): SoundCaseExecFile {
  return vi.fn(async (file, args) => {
    if (file.endsWith("ffmpeg")) {
      await fs.writeFile(args.at(-1)!, Buffer.from("ID3audio"));
      return { stdout: "", stderr: "" };
    }
    const target = args.at(-1)!;
    const codec = target.includes("final.mp3") ? "mp3" : "flac";
    return { stdout: JSON.stringify({ streams: [{ codec_name: codec, duration: "2.5" }] }), stderr: "" };
  });
}

describe("SoundCase resumable worker", () => {
  it("retries TTS, publishes audio first and degrades cover to SVG", async () => {
    const project = await createSoundCaseProject({ text: "Uma leitura curta e agradável." });
    const created = await createSoundCaseVersion(project.id, settings);
    const speech = vi.fn()
      .mockRejectedValueOnce(new Error("provider"))
      .mockRejectedValueOnce(new Error("provider"))
      .mockResolvedValue(new Response(Buffer.from("fLaCdata")));
    let coverObservedAudioReady = false;
    const client = {
      audio: { speech: { create: speech } },
      responses: { create: vi.fn(async () => {
        coverObservedAudioReady = (await getSoundCaseVersion(project.id, created.version.id)).status === "audio_ready";
        throw new Error("cover");
      }) },
    } as unknown as OpenAI;
    const sleeps: number[] = [];

    const result = await runNextSoundCaseJob({
      workerId: "worker-test", openai: client, execFile: fakeExec(),
      sleep: async (milliseconds) => { sleeps.push(milliseconds); },
      jitter: (milliseconds) => milliseconds,
    });
    const version = await getSoundCaseVersion(project.id, created.version.id);

    expect(result).toEqual({ status: "completed", versionId: created.version.id });
    expect(speech).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([1_000, 2_000]);
    expect(version.audio).toMatchObject({ status: "ready", format: "mp3" });
    expect(version.cover).toMatchObject({ status: "fallback", fileName: "cover.svg" });
    expect(version.status).toBe("ready");
    expect(coverObservedAudioReady).toBe(true);
    expect(version.manifest.chunks[0].attempts).toBe(3);
    await expect(fs.readFile(path.join(root, "projects", project.id, "versions", created.version.id, "cover.svg"), "utf8"))
      .resolves.toContain("SOUNDCASE");
  });

  it("does not synthesize an already confirmed chunk on reentry", async () => {
    const project = await createSoundCaseProject({ text: "Texto reaproveitado." });
    const created = await createSoundCaseVersion(project.id, settings);
    const speech = vi.fn().mockResolvedValue(new Response(Buffer.from("fLaCdata")));
    const client = {
      audio: { speech: { create: speech } },
      responses: { create: vi.fn().mockRejectedValue(new Error("cover")) },
    } as unknown as OpenAI;
    await runNextSoundCaseJob({ workerId: "worker-a", openai: client, execFile: fakeExec() });

    const empty = await runNextSoundCaseJob({ workerId: "worker-b", openai: client, execFile: fakeExec() });
    expect(empty).toEqual({ status: "empty" });
    expect(speech).toHaveBeenCalledTimes(1);
    expect((await getSoundCaseVersion(project.id, created.version.id)).manifest.completedChunks).toBe(1);
  });

  it("resumes after process reentry without paying for a completed chunk again", async () => {
    const project = await createSoundCaseProject({ text: "Primeiro trecho.\n\nSegundo trecho." });
    const created = await createSoundCaseVersion(project.id, settings);
    const firstSpeech = vi.fn().mockImplementation(
      async () => new Response(Buffer.from("fLaCdata"))
    );
    const firstClient = {
      audio: { speech: { create: firstSpeech } },
      responses: { create: vi.fn() },
    } as unknown as OpenAI;
    const firstNow = new Date("2030-01-01T00:00:00.000Z");
    const failingExec: SoundCaseExecFile = vi.fn(async (file) => {
      if (file.endsWith("ffmpeg")) throw new Error("assembly_crash");
      return { stdout: JSON.stringify({ streams: [{ codec_name: "flac", duration: "2.5" }] }), stderr: "" };
    });
    const interrupted = await runNextSoundCaseJob({
      workerId: "worker-old", openai: firstClient, execFile: failingExec,
      now: () => firstNow, sleep: async () => undefined,
    });
    expect(interrupted.status).toBe("interrupted");
    expect(firstSpeech).toHaveBeenCalledTimes(2);

    const secondSpeech = vi.fn().mockResolvedValue(new Response(Buffer.from("fLaCdata")));
    const secondClient = {
      audio: { speech: { create: secondSpeech } },
      responses: { create: vi.fn().mockRejectedValue(new Error("cover")) },
    } as unknown as OpenAI;
    await resumeSoundCaseVersion(project.id, created.version.id);
    const completed = await runNextSoundCaseJob({
      workerId: "worker-new", openai: secondClient, execFile: fakeExec(),
      now: () => new Date("2030-01-01T00:00:10.000Z"),
    });

    expect(completed.status).toBe("completed");
    expect(secondSpeech).not.toHaveBeenCalled();
    const finalVersion = await getSoundCaseVersion(project.id, created.version.id);
    expect(finalVersion.manifest.completedChunks).toBe(2);
    expect(finalVersion.error).toBeUndefined();
    const jobs = JSON.parse(await fs.readFile(path.join(root, "jobs.json"), "utf8"));
    expect(jobs[0].lastErrorCode).toBeUndefined();
  });

  it("keeps the four-attempt budget durable across automatic worker runs", async () => {
    const project = await createSoundCaseProject({ text: "Provider indisponível." });
    const created = await createSoundCaseVersion(project.id, settings);
    const speech = vi.fn().mockRejectedValue(new Error("provider"));
    const client = {
      audio: { speech: { create: speech } }, responses: { create: vi.fn() },
    } as unknown as OpenAI;
    const failed = await runNextSoundCaseJob({
      workerId: "worker-fail", openai: client, execFile: fakeExec(),
      sleep: async () => undefined,
    });

    expect(failed.status).toBe("failed");
    expect(speech).toHaveBeenCalledTimes(4);
    await expect(runNextSoundCaseJob({
      workerId: "worker-next", openai: client, execFile: fakeExec(),
    })).resolves.toEqual({ status: "empty" });
    expect(speech).toHaveBeenCalledTimes(4);
    expect((await getSoundCaseVersion(project.id, created.version.id)).manifest.chunks[0].attempts).toBe(4);
  });

  it("does not spend retries on a permanent invalid FLAC response", async () => {
    const project = await createSoundCaseProject({ text: "Resposta inválida." });
    await createSoundCaseVersion(project.id, settings);
    const speech = vi.fn().mockResolvedValue(new Response(Buffer.from("not-flac")));
    const client = {
      audio: { speech: { create: speech } }, responses: { create: vi.fn() },
    } as unknown as OpenAI;

    const result = await runNextSoundCaseJob({
      workerId: "worker-invalid", openai: client, execFile: fakeExec(),
      sleep: async () => undefined,
    });

    expect(result.status).toBe("failed");
    expect(speech).toHaveBeenCalledTimes(1);
  });

  it("stops publication and does not open a third slot after cancellation", async () => {
    const project = await createSoundCaseProject({ text: "Um.\n\nDois.\n\nTrês." });
    const created = await createSoundCaseVersion(project.id, settings);
    const resolvers: Array<(value: Response) => void> = [];
    const speech = vi.fn(() => new Promise<Response>((resolve) => resolvers.push(resolve)));
    const client = {
      audio: { speech: { create: speech } },
      responses: { create: vi.fn() },
    } as unknown as OpenAI;
    const running = runNextSoundCaseJob({ workerId: "worker-cancel", openai: client, execFile: fakeExec() });
    while (speech.mock.calls.length < 2) await new Promise((resolve) => setTimeout(resolve, 0));

    await cancelSoundCaseVersion(project.id, created.version.id);
    for (const resolve of resolvers) resolve(new Response(Buffer.from("fLaCdata")));
    const result = await running;

    expect(result.status).toBe("canceled");
    expect(speech).toHaveBeenCalledTimes(2);
    expect((await getSoundCaseVersion(project.id, created.version.id)).status).toBe("canceled");
    await expect(fs.readdir(path.join(root, "projects", project.id, "versions", created.version.id, "chunks")))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  it("reuses confirmed final audio when cover storage interrupted the prior process", async () => {
    const project = await createSoundCaseProject({ text: "Áudio deve sobreviver." });
    const created = await createSoundCaseVersion(project.id, settings);
    const versionDirectory = path.join(root, "projects", project.id, "versions", created.version.id);
    await fs.symlink(path.join(root, "outside.svg"), path.join(versionDirectory, "cover.svg"));
    const speech = vi.fn().mockImplementation(async () => new Response(Buffer.from("fLaCdata")));
    const client = {
      audio: { speech: { create: speech } },
      responses: { create: vi.fn().mockRejectedValue(new Error("cover")) },
    } as unknown as OpenAI;
    const execFile = fakeExec();
    const first = await runNextSoundCaseJob({
      workerId: "worker-cover-crash", openai: client, execFile,
      now: () => new Date("2030-02-01T00:00:00.000Z"),
    });
    expect(first.status).toBe("interrupted");
    expect((await getSoundCaseVersion(project.id, created.version.id)).audio.status).toBe("ready");
    await fs.rm(path.join(versionDirectory, "cover.svg"));
    await resumeSoundCaseVersion(project.id, created.version.id);

    const second = await runNextSoundCaseJob({
      workerId: "worker-cover-resume", openai: client, execFile,
      now: () => new Date("2030-02-01T00:00:10.000Z"),
    });

    expect(second.status).toBe("completed");
    expect(speech).toHaveBeenCalledTimes(1);
    const ffmpegCalls = vi.mocked(execFile).mock.calls.filter(([file]) => file.endsWith("ffmpeg"));
    expect(ffmpegCalls).toHaveLength(1);
  });
});
