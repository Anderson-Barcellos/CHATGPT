import AdmZip from "adm-zip";
import {
  chown,
  cp,
  mkdir,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  STUDIO_WORKSPACE_HIDDEN_DIRS,
  isHiddenWorkspaceFile,
  resolveWorkspacePath,
} from "@/lib/server/studioWorkspaceFs";
import {
  STUDIO_WORKSPACE_MAX_EXTRACTED_BYTES,
  STUDIO_WORKSPACE_MAX_ZIP_ENTRIES,
} from "@/lib/studio/workspaceServerProtocol";

const SYMLINK_MODE = 0o120000;
const MAX_SLUG_CHARS = 64;

type ZipResult = { ok: true } | { ok: false; reason: string };

export function sanitizeArchiveSlug(name: string): string | null {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, MAX_SLUG_CHARS);

  return slug.length > 0 ? slug : null;
}

export async function createWorkspaceArchive(root: string): Promise<Buffer> {
  const zip = new AdmZip();

  async function walk(current: string, relativeBase: string): Promise<void> {
    const children = await readdir(current, { withFileTypes: true });
    children.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    for (const child of children) {
      if (child.isSymbolicLink()) continue;
      if (child.isDirectory() && STUDIO_WORKSPACE_HIDDEN_DIRS.has(child.name)) {
        continue;
      }

      const relative = relativeBase
        ? `${relativeBase}/${child.name}`
        : child.name;
      const absolute = path.join(current, child.name);

      if (child.isDirectory()) {
        await walk(absolute, relative);
        continue;
      }
      if (!child.isFile()) continue;
      if (isHiddenWorkspaceFile(child.name)) continue;

      zip.addLocalFile(absolute, path.posix.dirname(relative) === "."
        ? ""
        : path.posix.dirname(relative));
    }
  }

  await walk(root, "");
  return zip.toBuffer();
}

interface ExtractOptions {
  maxExtractedBytes?: number;
}

export async function extractWorkspaceArchive(
  buffer: Buffer,
  targetDir: string,
  { maxExtractedBytes = STUDIO_WORKSPACE_MAX_EXTRACTED_BYTES }: ExtractOptions = {}
): Promise<ZipResult> {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    return { ok: false, reason: "zip_invalid" };
  }

  const entries = zip.getEntries();
  if (entries.length > STUDIO_WORKSPACE_MAX_ZIP_ENTRIES) {
    return { ok: false, reason: "zip_too_many_entries" };
  }

  // Valida tudo antes de escrever qualquer byte: falha deixa o alvo intacto.
  const planned: Array<{ entry: AdmZip.IZipEntry; absolutePath: string }> = [];
  for (const entry of entries) {
    const mode = (entry.header.attr >>> 16) & 0o170000;
    if (mode === SYMLINK_MODE) {
      return { ok: false, reason: "zip_symlink_entry" };
    }

    const entryName = entry.entryName.replace(/\/+$/, "");
    if (!entryName) continue;

    const resolved = await resolveWorkspacePath(targetDir, entryName);
    if (!resolved.ok) {
      return { ok: false, reason: "zip_invalid_entry_path" };
    }
    if (!entry.isDirectory) {
      planned.push({ entry, absolutePath: resolved.absolutePath });
    }
  }

  let extractedBytes = 0;
  for (const { entry, absolutePath } of planned) {
    const data = entry.getData();
    extractedBytes += data.byteLength;
    if (extractedBytes > maxExtractedBytes) {
      return { ok: false, reason: "zip_too_large" };
    }

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, data);
  }

  return { ok: true };
}

export async function replaceWorkspaceContent(
  root: string,
  stagingDir: string
): Promise<ZipResult> {
  try {
    const current = await readdir(root);
    for (const name of current) {
      await rm(path.join(root, name), { recursive: true, force: true });
    }

    const incoming = await readdir(stagingDir);
    for (const name of incoming) {
      await rename(path.join(stagingDir, name), path.join(root, name));
    }
  } catch {
    return { ok: false, reason: "workspace_swap_failed" };
  }

  return { ok: true };
}

async function inheritOwnershipRecursive(root: string): Promise<void> {
  try {
    const rootInfo = await stat(root);

    async function walk(current: string): Promise<void> {
      const children = await readdir(current, { withFileTypes: true });
      for (const child of children) {
        const absolute = path.join(current, child.name);
        await chown(absolute, rootInfo.uid, rootInfo.gid);
        if (child.isDirectory()) await walk(absolute);
      }
    }

    await walk(root);
  } catch {
    // Sem privilégio de chown (dev/teste): dono atual serve.
  }
}

export async function installWorkspaceFromBuffer(
  root: string,
  buffer: Buffer,
  options: ExtractOptions = {}
): Promise<ZipResult> {
  const staging = await createStagingDir(root);
  try {
    const extracted = await extractWorkspaceArchive(buffer, staging, options);
    if (!extracted.ok) return extracted;

    const replaced = await replaceWorkspaceContent(root, staging);
    if (!replaced.ok) return replaced;

    await inheritOwnershipRecursive(root);
    return { ok: true };
  } finally {
    await removeStagingDir(staging);
  }
}

export async function installWorkspaceFromTemplate(
  root: string,
  templateDir: string
): Promise<ZipResult> {
  const staging = await createStagingDir(root);
  try {
    await cp(templateDir, staging, { recursive: true });

    const replaced = await replaceWorkspaceContent(root, staging);
    if (!replaced.ok) return replaced;

    await inheritOwnershipRecursive(root);
    return { ok: true };
  } catch {
    return { ok: false, reason: "workspace_reset_failed" };
  } finally {
    await removeStagingDir(staging);
  }
}

export async function createStagingDir(root: string): Promise<string> {
  // Mesmo filesystem do workspace: renames do swap não cruzam devices.
  const base = path.dirname(root);
  const staging = path.join(
    base,
    `.staging-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  await mkdir(staging, { recursive: true });
  return staging;
}

export async function removeStagingDir(staging: string): Promise<void> {
  try {
    await stat(staging);
    await rm(staging, { recursive: true, force: true });
  } catch {
    // Já removido: nada a fazer.
  }
}
