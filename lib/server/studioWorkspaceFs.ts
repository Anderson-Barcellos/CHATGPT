import {
  chown,
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  STUDIO_WORKSPACE_MAX_EDITABLE_FILE_BYTES,
  STUDIO_WORKSPACE_MAX_RELATIVE_PATH_CHARS,
  STUDIO_WORKSPACE_MAX_ZIP_ENTRIES,
  type StudioWorkspaceTreeEntry,
} from "@/lib/studio/workspaceServerProtocol";

export const STUDIO_WORKSPACE_ACTIVE_DIR = "/root/studio-projects/active";
export const STUDIO_WORKSPACE_ARCHIVE_DIR = "/root/studio-projects/archive";

// Pastas geradas por runtime que não interessam à edição nem ao zip.
export const STUDIO_WORKSPACE_HIDDEN_DIRS = new Set([
  "__pycache__",
  ".venv",
  ".git",
]);

const SEGMENT_PATTERN = /^[A-Za-z0-9._][A-Za-z0-9 ._()-]*$/;

type FsResult<T> = ({ ok: true } & T) | { ok: false; reason: string };

export async function resolveWorkspacePath(
  root: string,
  relativePath: string
): Promise<FsResult<{ absolutePath: string }>> {
  if (
    !relativePath ||
    relativePath.length > STUDIO_WORKSPACE_MAX_RELATIVE_PATH_CHARS ||
    path.isAbsolute(relativePath)
  ) {
    return { ok: false, reason: "invalid_path" };
  }

  const segments = relativePath.split("/");
  for (const segment of segments) {
    if (
      segment === "." ||
      segment === ".." ||
      !SEGMENT_PATTERN.test(segment)
    ) {
      return { ok: false, reason: "invalid_path" };
    }
  }

  const absolutePath = path.join(root, ...segments);

  // Canonicaliza o ancestral existente mais próximo: um symlink no meio do
  // caminho não pode apontar para fora do workspace.
  let probe = path.dirname(absolutePath);
  while (true) {
    try {
      const canonicalProbe = await realpath(probe);
      const canonicalRoot = await realpath(root);
      if (
        canonicalProbe !== canonicalRoot &&
        !canonicalProbe.startsWith(`${canonicalRoot}${path.sep}`)
      ) {
        return { ok: false, reason: "invalid_path" };
      }
      break;
    } catch {
      const parent = path.dirname(probe);
      if (parent === probe) return { ok: false, reason: "invalid_path" };
      probe = parent;
    }
  }

  return { ok: true, absolutePath };
}

async function inheritRootOwnership(
  root: string,
  createdPaths: string[]
): Promise<void> {
  try {
    const rootInfo = await stat(root);
    for (const created of createdPaths) {
      await chown(created, rootInfo.uid, rootInfo.gid);
    }
  } catch {
    // Sem privilégio de chown (ambiente de dev/teste): dono atual serve.
  }
}

function isBinaryContent(buffer: Buffer): boolean {
  return buffer.includes(0);
}

export async function readWorkspaceFile(
  root: string,
  relativePath: string
): Promise<FsResult<{ content: string }>> {
  const resolved = await resolveWorkspacePath(root, relativePath);
  if (!resolved.ok) return resolved;

  let info;
  try {
    info = await stat(resolved.absolutePath);
  } catch {
    return { ok: false, reason: "not_found" };
  }
  if (!info.isFile()) return { ok: false, reason: "not_found" };
  if (info.size > STUDIO_WORKSPACE_MAX_EDITABLE_FILE_BYTES) {
    return { ok: false, reason: "too_large" };
  }

  const buffer = await readFile(resolved.absolutePath);
  if (isBinaryContent(buffer)) return { ok: false, reason: "binary" };

  return { ok: true, content: buffer.toString("utf8") };
}

export async function writeWorkspaceFile(
  root: string,
  relativePath: string,
  content: string
): Promise<FsResult<{ absolutePath: string }>> {
  const resolved = await resolveWorkspacePath(root, relativePath);
  if (!resolved.ok) return resolved;

  const encoded = Buffer.from(content, "utf8");
  if (encoded.byteLength > STUDIO_WORKSPACE_MAX_EDITABLE_FILE_BYTES) {
    return { ok: false, reason: "too_large" };
  }

  const directory = path.dirname(resolved.absolutePath);
  const createdDirs: string[] = [];
  let probe = directory;
  while (probe !== root && !probe.endsWith(path.sep)) {
    try {
      await stat(probe);
      break;
    } catch {
      createdDirs.unshift(probe);
      probe = path.dirname(probe);
    }
  }

  try {
    await mkdir(directory, { recursive: true });
    await writeFile(resolved.absolutePath, encoded);
  } catch {
    return { ok: false, reason: "write_failed" };
  }

  await inheritRootOwnership(root, [...createdDirs, resolved.absolutePath]);
  return { ok: true, absolutePath: resolved.absolutePath };
}

export async function deleteWorkspaceEntry(
  root: string,
  relativePath: string
): Promise<FsResult<object>> {
  const resolved = await resolveWorkspacePath(root, relativePath);
  if (!resolved.ok) return resolved;

  try {
    await stat(resolved.absolutePath);
  } catch {
    return { ok: false, reason: "not_found" };
  }

  await rm(resolved.absolutePath, { recursive: true });
  return { ok: true };
}

export async function renameWorkspaceEntry(
  root: string,
  fromPath: string,
  toPath: string
): Promise<FsResult<object>> {
  const from = await resolveWorkspacePath(root, fromPath);
  if (!from.ok) return from;
  const to = await resolveWorkspacePath(root, toPath);
  if (!to.ok) return to;

  try {
    await stat(from.absolutePath);
  } catch {
    return { ok: false, reason: "not_found" };
  }

  try {
    await stat(to.absolutePath);
    return { ok: false, reason: "already_exists" };
  } catch {
    // Destino livre: seguir.
  }

  try {
    await mkdir(path.dirname(to.absolutePath), { recursive: true });
    await rename(from.absolutePath, to.absolutePath);
  } catch {
    return { ok: false, reason: "write_failed" };
  }

  await inheritRootOwnership(root, [to.absolutePath]);
  return { ok: true };
}

export async function listWorkspaceTree(
  root: string
): Promise<StudioWorkspaceTreeEntry[]> {
  const entries: StudioWorkspaceTreeEntry[] = [];

  async function walk(current: string, relativeBase: string): Promise<void> {
    if (entries.length >= STUDIO_WORKSPACE_MAX_ZIP_ENTRIES) return;

    const children = await readdir(current, { withFileTypes: true });
    children.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    for (const child of children) {
      if (entries.length >= STUDIO_WORKSPACE_MAX_ZIP_ENTRIES) return;
      if (child.isDirectory() && STUDIO_WORKSPACE_HIDDEN_DIRS.has(child.name)) {
        continue;
      }
      if (child.isSymbolicLink()) continue;

      const relative = relativeBase
        ? `${relativeBase}/${child.name}`
        : child.name;
      const absolute = path.join(current, child.name);

      if (child.isDirectory()) {
        entries.push({
          path: relative,
          name: child.name,
          kind: "directory",
          size: 0,
          editable: false,
        });
        await walk(absolute, relative);
        continue;
      }

      if (!child.isFile()) continue;

      const info = await stat(absolute);
      let editable = info.size <= STUDIO_WORKSPACE_MAX_EDITABLE_FILE_BYTES;
      if (editable) {
        const sample = await readFile(absolute);
        editable = !isBinaryContent(sample);
      }

      entries.push({
        path: relative,
        name: child.name,
        kind: "file",
        size: info.size,
        editable,
      });
    }
  }

  await walk(root, "");
  return entries;
}
