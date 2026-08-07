import { NextRequest } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";
import {
  STUDIO_WORKSPACE_ACTIVE_DIR,
  renameWorkspaceEntry,
} from "@/lib/server/studioWorkspaceFs";
import { studioWorkspaceErrorResponse } from "@/lib/server/studioWorkspaceHttp";
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
      message: "Corpo da renomeação inválido.",
      code: "studio_workspace_body_invalid",
    });
  }

  const payload =
    body.value && typeof body.value === "object" && !Array.isArray(body.value)
      ? (body.value as { from?: unknown; to?: unknown })
      : {};
  if (typeof payload.from !== "string" || typeof payload.to !== "string") {
    return jsonError(400, "Request body error", {
      message: "Renomeação exige from e to.",
      code: "studio_workspace_body_invalid",
    });
  }

  const result = await renameWorkspaceEntry(
    STUDIO_WORKSPACE_ACTIVE_DIR,
    payload.from,
    payload.to
  );
  if (!result.ok) return studioWorkspaceErrorResponse(result.reason);

  return Response.json({ renamed: true });
}
