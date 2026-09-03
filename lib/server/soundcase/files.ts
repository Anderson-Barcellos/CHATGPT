import { randomUUID } from "node:crypto";
import { constants, promises as fs } from "node:fs";
import path from "node:path";

export type SoundCaseFileErrorCode =
  | "soundcase_path_invalid"
  | "soundcase_symlink_rejected"
  | "soundcase_file_invalid"
  | "soundcase_json_invalid";

export class SoundCaseFileError extends Error {
  readonly code: SoundCaseFileErrorCode;

  constructor(code: SoundCaseFileErrorCode) {
    super(code);
    this.name = "SoundCaseFileError";
    this.code = code;
  }
}

export function getSoundCaseRoot(): string {
  const configured = process.env.SOUNDCASE_DATA_DIR?.trim();
  return path.resolve(
    configured || path.join(process.cwd(), "data", "soundcase")
  );
}

function isSafeSegment(segment: string): boolean {
  return (
    segment !== "." &&
    segment !== ".." &&
    /^[a-zA-Z0-9._-]+$/u.test(segment)
  );
}

export function resolveSoundCasePath(...segments: string[]): string {
  if (segments.some((segment) => !isSafeSegment(segment))) {
    throw new SoundCaseFileError("soundcase_path_invalid");
  }

  const root = getSoundCaseRoot();
  const resolved = path.resolve(root, ...segments);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new SoundCaseFileError("soundcase_path_invalid");
  }
  return resolved;
}

function assertInsideRoot(filePath: string): string {
  const root = getSoundCaseRoot();
  const resolved = path.resolve(filePath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new SoundCaseFileError("soundcase_path_invalid");
  }
  return resolved;
}

function isMissing(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

async function assertNoSymlinkAncestors(targetPath: string): Promise<void> {
  const root = getSoundCaseRoot();
  const target = assertInsideRoot(targetPath);
  const relative = path.relative(root, target);
  const parts = relative ? relative.split(path.sep) : [];
  let current = root;

  for (let index = -1; index < parts.length; index += 1) {
    if (index >= 0) current = path.join(current, parts[index]);
    try {
      const info = await fs.lstat(current);
      if (info.isSymbolicLink()) {
        throw new SoundCaseFileError("soundcase_symlink_rejected");
      }
      if (!info.isDirectory()) {
        throw new SoundCaseFileError("soundcase_path_invalid");
      }
    } catch (error) {
      if (isMissing(error)) return;
      throw error;
    }
  }
}

export async function assertRegularSoundCaseFile(
  filePath: string
): Promise<void> {
  const target = assertInsideRoot(filePath);
  await assertNoSymlinkAncestors(path.dirname(target));
  const info = await fs.lstat(target);
  if (info.isSymbolicLink()) {
    throw new SoundCaseFileError("soundcase_symlink_rejected");
  }
  if (!info.isFile()) {
    throw new SoundCaseFileError("soundcase_file_invalid");
  }
}

async function syncDirectory(directory: string): Promise<void> {
  const handle = await fs.open(
    directory,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
  );
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function writeTextDurable(
  filePath: string,
  content: string
): Promise<void> {
  const target = assertInsideRoot(filePath);
  const parent = path.dirname(target);
  await assertNoSymlinkAncestors(parent);
  await fs.mkdir(parent, { recursive: true, mode: 0o700 });
  await assertNoSymlinkAncestors(parent);

  try {
    const existing = await fs.lstat(target);
    if (existing.isSymbolicLink()) {
      throw new SoundCaseFileError("soundcase_symlink_rejected");
    }
    if (!existing.isFile()) {
      throw new SoundCaseFileError("soundcase_file_invalid");
    }
  } catch (error) {
    if (!isMissing(error)) throw error;
  }

  const temporary = path.join(
    parent,
    `.${path.basename(target)}.${process.pid}.${randomUUID()}.tmp`
  );
  let handle: Awaited<ReturnType<typeof fs.open>> | null = null;
  try {
    handle = await fs.open(
      temporary,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600
    );
    await handle.writeFile(content, { encoding: "utf8" });
    await handle.sync();
    await handle.close();
    handle = null;

    await assertNoSymlinkAncestors(parent);
    await fs.rename(temporary, target);
    await syncDirectory(parent);
  } finally {
    if (handle) await handle.close();
    await fs.rm(temporary, { force: true });
  }
}

export async function writeJsonDurable<T>(
  filePath: string,
  value: T
): Promise<void> {
  await writeTextDurable(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function readJsonSafe<T>(filePath: string): Promise<T | null> {
  const target = assertInsideRoot(filePath);
  try {
    await assertRegularSoundCaseFile(target);
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }

  const raw = await fs.readFile(target, "utf8");
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new SoundCaseFileError("soundcase_json_invalid");
  }
}

export async function removeVersionTree(
  projectId: string,
  versionId: string
): Promise<void> {
  const target = resolveSoundCasePath(
    "projects",
    projectId,
    "versions",
    versionId
  );
  await assertNoSymlinkAncestors(path.dirname(target));

  let info;
  try {
    info = await fs.lstat(target);
  } catch (error) {
    if (isMissing(error)) return;
    throw error;
  }
  if (info.isSymbolicLink()) {
    throw new SoundCaseFileError("soundcase_symlink_rejected");
  }
  if (!info.isDirectory()) {
    throw new SoundCaseFileError("soundcase_file_invalid");
  }

  await fs.rm(target, { recursive: true, force: true });
  await syncDirectory(path.dirname(target));
}
