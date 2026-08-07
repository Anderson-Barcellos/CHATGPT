import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { STUDIO_WORKSPACE_ARCHIVE_DIR } from "@/lib/server/studioWorkspaceFs";
import { requireStudioWorkspaceAccess } from "@/lib/server/studioWorkspaceAuth";
import type { StudioArchiveEntry } from "@/lib/studio/workspaceServerProtocol";

export async function GET(request: NextRequest) {
  const gate = await requireStudioWorkspaceAccess(request);
  if (!gate.ok) return gate.response;

  let names: string[] = [];
  try {
    names = await readdir(STUDIO_WORKSPACE_ARCHIVE_DIR);
  } catch {
    names = [];
  }

  const archives: StudioArchiveEntry[] = [];
  for (const name of names) {
    if (!name.endsWith(".zip")) continue;
    const info = await stat(path.join(STUDIO_WORKSPACE_ARCHIVE_DIR, name));
    if (!info.isFile()) continue;
    archives.push({
      slug: name.slice(0, -4),
      savedAt: info.mtime.toISOString(),
      sizeBytes: info.size,
    });
  }

  archives.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  return Response.json({ archives });
}
