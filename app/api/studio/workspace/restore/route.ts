import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";
import {
  STUDIO_WORKSPACE_ACTIVE_DIR,
  STUDIO_WORKSPACE_ARCHIVE_DIR,
} from "@/lib/server/studioWorkspaceFs";
import { studioWorkspaceErrorResponse } from "@/lib/server/studioWorkspaceHttp";
import {
  installWorkspaceFromBuffer,
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
      message: "Corpo da restauração inválido.",
      code: "studio_workspace_body_invalid",
    });
  }

  const slugValue =
    body.value && typeof body.value === "object" && !Array.isArray(body.value)
      ? (body.value as { slug?: unknown }).slug
      : undefined;
  const slug =
    typeof slugValue === "string" ? sanitizeArchiveSlug(slugValue) : null;
  if (!slug || slug !== slugValue) {
    return jsonError(400, "Invalid archive slug", {
      message: "Identificador de projeto salvo inválido.",
      code: "studio_workspace_invalid_slug",
    });
  }

  let buffer: Buffer;
  try {
    buffer = await readFile(
      path.join(STUDIO_WORKSPACE_ARCHIVE_DIR, `${slug}.zip`)
    );
  } catch {
    return jsonError(404, "Archive not found", {
      message: "Projeto salvo não encontrado.",
      code: "studio_workspace_archive_not_found",
    });
  }

  const result = await installWorkspaceFromBuffer(
    STUDIO_WORKSPACE_ACTIVE_DIR,
    buffer
  );
  if (!result.ok) return studioWorkspaceErrorResponse(result.reason);

  return Response.json({ restored: true });
}
