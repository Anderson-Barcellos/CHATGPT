import { NextRequest } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";
import {
  STUDIO_WORKSPACE_ACTIVE_DIR,
  deleteWorkspaceEntry,
  readWorkspaceFile,
  writeWorkspaceFile,
} from "@/lib/server/studioWorkspaceFs";
import { studioWorkspaceErrorResponse } from "@/lib/server/studioWorkspaceHttp";
import { requireStudioWorkspaceAccess } from "@/lib/server/studioWorkspaceAuth";

const BODY_LIMIT_BYTES = 2 * 1024 * 1024;

function requestedPath(request: NextRequest): string {
  return request.nextUrl.searchParams.get("path") ?? "";
}

export async function GET(request: NextRequest) {
  const gate = await requireStudioWorkspaceAccess(request);
  if (!gate.ok) return gate.response;

  const result = await readWorkspaceFile(
    STUDIO_WORKSPACE_ACTIVE_DIR,
    requestedPath(request)
  );
  if (!result.ok) return studioWorkspaceErrorResponse(result.reason);

  return Response.json({ content: result.content });
}

export async function PUT(request: NextRequest) {
  const gate = await requireStudioWorkspaceAccess(request);
  if (!gate.ok) return gate.response;

  const body = await readJsonWithLimit<unknown>(request, {
    limitBytes: BODY_LIMIT_BYTES,
  });
  if (!body.ok) {
    return jsonError(body.status, "Request body error", {
      message: "Corpo da gravação inválido.",
      code: "studio_workspace_body_invalid",
    });
  }

  const payload =
    body.value && typeof body.value === "object" && !Array.isArray(body.value)
      ? (body.value as { path?: unknown; content?: unknown })
      : {};
  if (typeof payload.path !== "string" || typeof payload.content !== "string") {
    return jsonError(400, "Request body error", {
      message: "Gravação exige path e content de texto.",
      code: "studio_workspace_body_invalid",
    });
  }

  const result = await writeWorkspaceFile(
    STUDIO_WORKSPACE_ACTIVE_DIR,
    payload.path,
    payload.content
  );
  if (!result.ok) return studioWorkspaceErrorResponse(result.reason);

  return Response.json({ saved: true });
}

export async function DELETE(request: NextRequest) {
  const gate = await requireStudioWorkspaceAccess(request);
  if (!gate.ok) return gate.response;

  const result = await deleteWorkspaceEntry(
    STUDIO_WORKSPACE_ACTIVE_DIR,
    requestedPath(request)
  );
  if (!result.ok) return studioWorkspaceErrorResponse(result.reason);

  return Response.json({ deleted: true });
}
