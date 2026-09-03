import { randomUUID } from "node:crypto";
import { constants, promises as fs } from "node:fs";
import path from "node:path";

export type SoundCaseFileErrorCode =
  | "soundcase_path_invalid"
  | "soundcase_symlink_rejected"
  | "soundcase_file_invalid"
  | "soundcase_json_invalid"
  | "soundcase_root_untrusted";

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

function isSymlinkLoop(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ELOOP"
  );
}

async function ensureTrustedRoot(create: boolean): Promise<void> {
  const root = getSoundCaseRoot();
  if (create) await fs.mkdir(root, { recursive: true, mode: 0o700 });

  const info = await fs.lstat(root);
  const effectiveUid = process.geteuid?.();
  if (
    info.isSymbolicLink() ||
    !info.isDirectory() ||
    (effectiveUid !== undefined && info.uid !== effectiveUid) ||
    (info.mode & 0o022) !== 0
  ) {
    throw new SoundCaseFileError("soundcase_root_untrusted");
  }
}

export async function ensureSoundCaseRoot(): Promise<void> {
  await ensureTrustedRoot(true);
}

export async function listSoundCaseVersionIds(
  projectId: string
): Promise<string[]> {
  const versionsPath = resolveSoundCasePath("projects", projectId, "versions");
  try {
    await assertNoSymlinkAncestors(versionsPath);
    const entries = await fs.readdir(versionsPath, { withFileTypes: true });
    const versionIds: string[] = [];
    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        throw new SoundCaseFileError("soundcase_symlink_rejected");
      }
      if (entry.isDirectory() && isSafeSegment(entry.name)) {
        versionIds.push(entry.name);
      }
    }
    return versionIds.sort();
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
}

async function assertNoSymlinkAncestors(targetPath: string): Promise<void> {
  const root = getSoundCaseRoot();
  const target = assertInsideRoot(targetPath);
  await ensureTrustedRoot(false);
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

export async function openSoundCaseFileSafe(filePath: string) {
  const target = assertInsideRoot(filePath);
  await assertNoSymlinkAncestors(path.dirname(target));
  let handle: Awaited<ReturnType<typeof fs.open>>;
  try {
    handle = await fs.open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if (isSymlinkLoop(error)) {
      throw new SoundCaseFileError("soundcase_symlink_rejected");
    }
    throw error;
  }
  const info = await handle.stat();
  if (!info.isFile()) {
    await handle.close();
    throw new SoundCaseFileError("soundcase_file_invalid");
  }
  return { handle, info };
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
  await writeContentDurable(filePath, content);
}

export async function writeBufferDurable(
  filePath: string,
  content: Uint8Array
): Promise<void> {
  await writeContentDurable(filePath, content);
}

async function writeContentDurable(
  filePath: string,
  content: string | Uint8Array
): Promise<void> {
  const target = assertInsideRoot(filePath);
  const parent = path.dirname(target);
  await ensureTrustedRoot(true);
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
  let operationError: unknown;
  try {
    handle = await fs.open(
      temporary,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600
    );
    if (typeof content === "string") {
      await handle.writeFile(content, { encoding: "utf8" });
    } else {
      await handle.writeFile(content);
    }
    await handle.sync();
    await handle.close();
    handle = null;

    await assertNoSymlinkAncestors(parent);
    await fs.rename(temporary, target);
    await syncDirectory(parent);
  } catch (error) {
    operationError = error;
    throw error;
  } finally {
    let cleanupError: unknown;
    if (handle) {
      try {
        await handle.close();
      } catch (error) {
        if (!operationError) cleanupError = error;
      }
    }
    try {
      await fs.rm(temporary, { force: true });
    } catch (error) {
      if (!operationError && !cleanupError) cleanupError = error;
    }
    if (cleanupError) throw cleanupError;
  }
}

export async function promoteSoundCaseFile(
  temporaryPath: string,
  finalPath: string
): Promise<void> {
  const temporary = assertInsideRoot(temporaryPath);
  const target = assertInsideRoot(finalPath);
  const parent = path.dirname(target);
  if (
    path.dirname(temporary) !== parent ||
    !path.basename(temporary).endsWith(".part")
  ) {
    throw new SoundCaseFileError("soundcase_path_invalid");
  }
  await assertNoSymlinkAncestors(parent);
  await assertRegularSoundCaseFile(temporary);
  const temporaryHandle = await fs.open(
    temporary,
    constants.O_RDONLY | constants.O_NOFOLLOW
  );
  try {
    await temporaryHandle.sync();
  } finally {
    await temporaryHandle.close();
  }
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
  await fs.rename(temporary, target);
  await syncDirectory(parent);
}

export async function removeSoundCaseMediaParts(
  projectId: string,
  versionId: string,
  stem: string,
  options: { chunks?: boolean } = {}
): Promise<void> {
  if (!/^(?:final\.(?:mp3|flac|wav)|\d{4,}\.flac)$/u.test(stem)) {
    throw new SoundCaseFileError("soundcase_path_invalid");
  }
  const directory = options.chunks
    ? resolveSoundCasePath("projects", projectId, "versions", versionId, "chunks")
    : resolveSoundCasePath("projects", projectId, "versions", versionId);
  await assertNoSymlinkAncestors(directory);
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isMissing(error)) return;
    throw error;
  }
  const prefix = `${stem}.`;
  let removed = false;
  for (const entry of entries) {
    if (!entry.name.startsWith(prefix) || !entry.name.endsWith(".part")) continue;
    if (entry.isSymbolicLink() || !entry.isFile()) {
      throw new SoundCaseFileError("soundcase_file_invalid");
    }
    await fs.rm(path.join(directory, entry.name));
    removed = true;
  }
  if (removed) await syncDirectory(directory);
}

export async function writeJsonDurable<T>(
  filePath: string,
  value: T
): Promise<void> {
  await writeTextDurable(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function readTextSafe(filePath: string): Promise<string | null> {
  const content = await readBufferSafe(filePath);
  return content === null ? null : content.toString("utf8");
}

export async function readBufferSafe(filePath: string): Promise<Buffer | null> {
  const target = assertInsideRoot(filePath);
  try {
    await assertRegularSoundCaseFile(target);
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }

  let handle: Awaited<ReturnType<typeof fs.open>>;
  try {
    ({ handle } = await openSoundCaseFileSafe(target));
  } catch (error) {
    if (isMissing(error)) return null;
    if (isSymlinkLoop(error)) {
      throw new SoundCaseFileError("soundcase_symlink_rejected");
    }
    throw error;
  }

  try {
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

export async function readJsonSafe<T>(filePath: string): Promise<T | null> {
  const raw = await readTextSafe(filePath);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new SoundCaseFileError("soundcase_json_invalid");
  }
}

async function removeResolvedTree(target: string): Promise<void> {
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

export async function removeProjectTree(projectId: string): Promise<void> {
  await removeResolvedTree(resolveSoundCasePath("projects", projectId));
}

export async function removeVersionTree(
  projectId: string,
  versionId: string
): Promise<void> {
  await removeResolvedTree(
    resolveSoundCasePath("projects", projectId, "versions", versionId)
  );
}
