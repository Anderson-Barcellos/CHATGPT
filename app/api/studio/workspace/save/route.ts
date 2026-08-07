import { writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";
import {
  STUDIO_WORKSPACE_ACTIVE_DIR,
  STUDIO_WORKSPACE_ARCHIVE_DIR,
} from "@/lib/server/studioWorkspaceFs";
import {
  createWorkspaceArchive,
  sanitizeArchiveSlug,
} from "@/lib/server/studioWorkspaceZip";
import { requireStudioWorkspaceAccess } from "@/lib/server/studioWorkspaceAuth";

const BODY_LIMIT_BYTES = 4 * 1024;

export async function POST(request: NextRequest) {
  const gate = await requireStudioWorkspaceAccess(request);
  if (!gate.ok) return gate.response;

  const body = await readJsonWithLimit<unknown>(request, {
    limitBytes: BODY_LIMIT_BYTES,
  });
  if (!body.ok) {
    return jsonError(body.status, "Request body error", {
      message: "Corpo do salvamento inválido.",
      code: "studio_workspace_body_invalid",
    });
  }

  const name =
    body.value && typeof body.value === "object" && !Array.isArray(body.value)
      ? (body.value as { name?: unknown }).name
      : undefined;
  const slug = typeof name === "string" ? sanitizeArchiveSlug(name) : null;
  if (!slug) {
    return jsonError(400, "Invalid archive name", {
      message: "Nome de projeto inválido para salvar.",
      code: "studio_workspace_invalid_slug",
    });
  }

  const buffer = await createWorkspaceArchive(STUDIO_WORKSPACE_ACTIVE_DIR);
  await writeFile(path.join(STUDIO_WORKSPACE_ARCHIVE_DIR, `${slug}.zip`), buffer);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
