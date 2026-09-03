import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SoundCaseVersion } from "@/lib/soundcase/types";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const VERSION_ID = "22222222-2222-4222-8222-222222222222";
const mocks = vi.hoisted(() => ({ requireAppAuth: vi.fn(), getSoundCaseVersion: vi.fn() }));
vi.mock("@/lib/server/routeAuth", () => ({ requireAppAuth: mocks.requireAppAuth }));
vi.mock("@/lib/server/soundcase/jobs", () => ({ getSoundCaseVersion: mocks.getSoundCaseVersion }));

import { GET as GET_AUDIO } from "@/app/api/soundcase/projects/[projectId]/versions/[versionId]/audio/route";
import { GET as GET_COVER } from "@/app/api/soundcase/projects/[projectId]/versions/[versionId]/cover/route";

const context = { params: Promise.resolve({ projectId: PROJECT_ID, versionId: VERSION_ID }) };
let root: string;
let previousRoot: string | undefined;

function version(): SoundCaseVersion {
  return {
    id: VERSION_ID, projectId: PROJECT_ID,
    audio: { status: "ready", format: "mp3", durationSeconds: 1, contentType: "audio/mpeg", fileName: "final.mp3" },
    cover: { status: "ready", contentType: "image/png", fileName: "cover.png" },
  } as SoundCaseVersion;
}

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.requireAppAuth.mockResolvedValue(null);
  mocks.getSoundCaseVersion.mockResolvedValue(version());
  root = await fs.mkdtemp(path.join(tmpdir(), "soundcase-assets-"));
  previousRoot = process.env.SOUNDCASE_DATA_DIR;
  process.env.SOUNDCASE_DATA_DIR = root;
  const directory = path.join(root, "projects", PROJECT_ID, "versions", VERSION_ID);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "final.mp3"), Buffer.from(Array.from({ length: 100 }, (_, index) => index)));
  await fs.writeFile(path.join(directory, "cover.png"), Buffer.from([137,80,78,71,13,10,26,10,1]));
});

afterEach(async () => {
  if (previousRoot === undefined) delete process.env.SOUNDCASE_DATA_DIR;
  else process.env.SOUNDCASE_DATA_DIR = previousRoot;
  await fs.rm(root, { recursive: true, force: true });
});

describe("SoundCase private assets", () => {
  it("returns an inclusive byte range from the authenticated audio", async () => {
    const response = await GET_AUDIO(new NextRequest("http://local/audio", {
      headers: { range: "bytes=10-19" },
    }), context);
    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 10-19/100");
    expect(response.headers.get("Content-Length")).toBe("10");
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([10,11,12,13,14,15,16,17,18,19]);
  });

  it("returns 416 for invalid or multiple ranges", async () => {
    const response = await GET_AUDIO(new NextRequest("http://local/audio", {
      headers: { range: "bytes=100-120" },
    }), context);
    expect(response.status).toBe(416);
    expect(response.headers.get("Content-Range")).toBe("bytes */100");
    const multiple = await GET_AUDIO(new NextRequest("http://local/audio", {
      headers: { range: "bytes=0-2,5-8" },
    }), context);
    expect(multiple.status).toBe(416);
  });

  it("accepts an open-ended range and clamps its inclusive end", async () => {
    const response = await GET_AUDIO(new NextRequest("http://local/audio", {
      headers: { range: "bytes=95-" },
    }), context);
    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 95-99/100");
    expect(response.headers.get("Content-Length")).toBe("5");
  });

  it("uses an allowlist instead of trusting a metadata filename", async () => {
    mocks.getSoundCaseVersion.mockResolvedValue({
      ...version(), audio: { ...version().audio, fileName: "source.txt" },
    });
    const response = await GET_AUDIO(new NextRequest("http://local/audio"), context);
    expect(response.status).toBe(404);
  });

  it("rejects runtime-invalid metadata and cross-project redirection", async () => {
    mocks.getSoundCaseVersion.mockResolvedValue({
      ...version(), projectId: "33333333-3333-4333-8333-333333333333",
      audio: { ...version().audio, format: "opus", fileName: "final.opus" },
    });
    const response = await GET_AUDIO(new NextRequest("http://local/audio"), context);
    expect(response.status).toBe(404);
  });

  it("rejects a symlinked ancestor instead of following it", async () => {
    const versionDirectory = path.join(root, "projects", PROJECT_ID, "versions", VERSION_ID);
    const outside = path.join(root, "outside");
    await fs.rename(versionDirectory, outside);
    await fs.symlink(outside, versionDirectory);
    const response = await GET_AUDIO(new NextRequest("http://local/audio"), context);
    expect(response.status).toBe(404);
  });

  it("streams the inode opened before a later path replacement", async () => {
    const request = new NextRequest("http://local/audio");
    const response = await GET_AUDIO(request, context);
    const filePath = path.join(root, "projects", PROJECT_ID, "versions", VERSION_ID, "final.mp3");
    await fs.rename(filePath, `${filePath}.old`);
    await fs.writeFile(filePath, Buffer.alloc(100, 255));
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(bytes[0]).toBe(0);
    expect(bytes[99]).toBe(99);
  });

  it("authenticates before resolving metadata or opening a file", async () => {
    mocks.requireAppAuth.mockResolvedValue(new Response(null, { status: 401 }));
    const response = await GET_AUDIO(new NextRequest("http://local/audio"), context);
    expect(response.status).toBe(401);
    expect(mocks.getSoundCaseVersion).not.toHaveBeenCalled();
  });

  it("serves the validated cover inline and can force download", async () => {
    const response = await GET_COVER(new NextRequest("http://local/cover?download=1"), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Content-Disposition")).toContain("attachment");
  });
});
