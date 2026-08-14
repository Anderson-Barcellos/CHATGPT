import { NextRequest } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";
import { studioWorkspaceRunner } from "@/lib/server/studioWorkspaceRunner";
import { requireStudioWorkspaceAccess } from "@/lib/server/studioWorkspaceAuth";

const BODY_LIMIT_BYTES = 8 * 1024;

export async function POST(request: NextRequest) {
  const gate = await requireStudioWorkspaceAccess(request);
  if (!gate.ok) return gate.response;

  const body = await readJsonWithLimit<unknown>(request, {
    limitBytes: BODY_LIMIT_BYTES,
  });
  if (!body.ok) {
    return jsonError(body.status, "Request body error", {
      message: "Corpo do stdin inválido.",
      code: "studio_workspace_body_invalid",
    });
  }

  const data =
    body.value && typeof body.value === "object" && !Array.isArray(body.value)
      ? (body.value as { data?: unknown }).data
      : undefined;
  if (typeof data !== "string" || data.length === 0) {
    return jsonError(400, "Request body error", {
      message: "O stdin exige data em texto.",
      code: "studio_workspace_body_invalid",
    });
  }

  const sent = studioWorkspaceRunner.writeStdin(data);
  if (!sent) {
    return jsonError(409, "Run not active", {
      message: "Não há execução ativa para receber entrada.",
      code: "studio_workspace_run_not_active",
    });
  }

  return Response.json({ sent: true });
}
