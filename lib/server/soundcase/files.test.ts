import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertRegularSoundCaseFile,
  getSoundCaseRoot,
  openSoundCaseFileSafe,
  readJsonSafe,
  removeVersionTree,
  resolveSoundCasePath,
  writeJsonDurable,
  writeTextDurable,
} from "@/lib/server/soundcase/files";

let root: string;
let outside: string;
let previousRoot: string | undefined;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(tmpdir(), "soundcase-files-"));
  outside = await fs.mkdtemp(path.join(tmpdir(), "soundcase-outside-"));
  previousRoot = process.env.SOUNDCASE_DATA_DIR;
  process.env.SOUNDCASE_DATA_DIR = root;
});

afterEach(async () => {
  if (previousRoot === undefined) delete process.env.SOUNDCASE_DATA_DIR;
  else process.env.SOUNDCASE_DATA_DIR = previousRoot;
  await fs.rm(root, { recursive: true, force: true });
  await fs.rm(outside, { recursive: true, force: true });
});

describe("SoundCase private files", () => {
  it("uses the injected root and resolves safe opaque segments", () => {
    expect(getSoundCaseRoot()).toBe(root);
    expect(resolveSoundCasePath("projects", "project-1", "draft.txt")).toBe(
      path.join(root, "projects", "project-1", "draft.txt")
    );
  });

  it.each(["../secret", "a/b", "a\\b", "", ".", "..", "line\nbreak"])(
    "rejects an unsafe path segment: %j",
    (segment) => {
      expect(() => resolveSoundCasePath("projects", segment)).toThrowError(
        expect.objectContaining({ code: "soundcase_path_invalid" })
      );
    }
  );

  it("rejects a final symlink and an ancestor symlink", async () => {
    const outsideFile = path.join(outside, "secret.txt");
    await fs.writeFile(outsideFile, "secret", "utf8");
    const finalLink = path.join(root, "escape");
    await fs.symlink(outsideFile, finalLink);

    await expect(assertRegularSoundCaseFile(finalLink)).rejects.toThrowError(
      expect.objectContaining({ code: "soundcase_symlink_rejected" })
    );

    const ancestorLink = path.join(root, "projects");
    await fs.symlink(outside, ancestorLink);
    await expect(
      writeTextDurable(path.join(ancestorLink, "escaped.txt"), "nope")
    ).rejects.toThrowError(
      expect.objectContaining({ code: "soundcase_symlink_rejected" })
    );
  });

  it("rejects a target swapped to a symlink after lstat", async () => {
    const target = resolveSoundCasePath("projects.json");
    const outsideFile = path.join(outside, "outside.json");
    await fs.writeFile(target, '{"inside":true}', "utf8");
    await fs.writeFile(outsideFile, '{"outside":true}', "utf8");
    const realLstat = fs.lstat.bind(fs);
    let swapped = false;
    const lstatSpy = vi.spyOn(fs, "lstat").mockImplementation(async (candidate) => {
      const info = await realLstat(candidate);
      if (!swapped && candidate.toString() === target) {
        swapped = true;
        await fs.rm(target);
        await fs.symlink(outsideFile, target);
      }
      return info;
    });

    await expect(readJsonSafe(target)).rejects.toThrowError(
      expect.objectContaining({ code: "soundcase_symlink_rejected" })
    );
    lstatSpy.mockRestore();
  });

  it("closes the descriptor when fstat fails", async () => {
    const target = resolveSoundCasePath("broken-stat.json");
    await fs.writeFile(target, "{}", "utf8");
    const close = vi.fn().mockResolvedValue(undefined);
    const statError = new Error("simulated fstat failure");
    const openSpy = vi.spyOn(fs, "open").mockResolvedValue({
      stat: vi.fn().mockRejectedValue(statError),
      close,
    } as never);

    await expect(openSoundCaseFileSafe(target)).rejects.toBe(statError);
    expect(close).toHaveBeenCalledOnce();
    openSpy.mockRestore();
  });

  it("rejects a root writable by group or others", async () => {
    await fs.chmod(root, 0o770);

    await expect(
      writeTextDurable(path.join(root, "projects.json"), "{}")
    ).rejects.toThrowError(
      expect.objectContaining({ code: "soundcase_root_untrusted" })
    );
  });

  it("promotes durable JSON without leaving a temporary file", async () => {
    const target = resolveSoundCasePath("projects.json");

    await writeJsonDurable(target, { revision: 2 });

    await expect(readJsonSafe(target)).resolves.toEqual({ revision: 2 });
    const entries = await fs.readdir(root);
    expect(entries).toEqual(["projects.json"]);
    expect((await fs.stat(target)).mode & 0o777).toBe(0o600);
  });

  it("overwrites a regular file atomically", async () => {
    const target = resolveSoundCasePath("draft.txt");
    await writeTextDurable(target, "primeiro");
    await writeTextDurable(target, "segundo");

    await expect(fs.readFile(target, "utf8")).resolves.toBe("segundo");
  });

  it("distinguishes a missing JSON file from invalid JSON", async () => {
    const missing = resolveSoundCasePath("missing.json");
    await expect(readJsonSafe(missing)).resolves.toBeNull();

    const invalid = resolveSoundCasePath("invalid.json");
    await writeTextDurable(invalid, "{");
    await expect(readJsonSafe(invalid)).rejects.toThrowError(
      expect.objectContaining({ code: "soundcase_json_invalid" })
    );
  });

  it("removes only a resolved version tree and rejects a symlink", async () => {
    const version = resolveSoundCasePath(
      "projects",
      "project-1",
      "versions",
      "version-1"
    );
    await fs.mkdir(version, { recursive: true });
    await fs.writeFile(path.join(version, "source.txt"), "source", "utf8");

    await removeVersionTree("project-1", "version-1");
    await expect(fs.access(version)).rejects.toMatchObject({ code: "ENOENT" });

    await fs.mkdir(path.dirname(version), { recursive: true });
    await fs.symlink(outside, version);
    await expect(removeVersionTree("project-1", "version-1")).rejects.toThrowError(
      expect.objectContaining({ code: "soundcase_symlink_rejected" })
    );
    await expect(fs.access(outside)).resolves.toBeUndefined();
  });
});
