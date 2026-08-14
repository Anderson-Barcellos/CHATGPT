import { NextRequest } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";
import { studioNotebookKernel } from "@/lib/server/studioNotebookKernel";
import { requireStudioWorkspaceAccess } from "@/lib/server/studioWorkspaceAuth";

const BODY_LIMIT_BYTES = 256 * 1024;

export async function POST(request: NextRequest) {
  const gate = await requireStudioWorkspaceAccess(request);
  if (!gate.ok) return gate.response;

  const body = await readJsonWithLimit<unknown>(request, {
    limitBytes: BODY_LIMIT_BYTES,
  });
  if (!body.ok) {
    return jsonError(body.status, "Request body error", {
      message: "Corpo da execução do notebook inválido.",
      code: "studio_workspace_body_invalid",
    });
  }

  const payload =
    body.value && typeof body.value === "object" && !Array.isArray(body.value)
      ? (body.value as { cellId?: unknown; code?: unknown })
      : {};
  const cellId = payload.cellId;
  const code = payload.code;
  if (
    typeof cellId !== "string" ||
    cellId.length === 0 ||
    typeof code !== "string"
  ) {
    return jsonError(400, "Request body error", {
      message: "A execução exige cellId e code em texto.",
      code: "studio_workspace_body_invalid",
    });
  }

  const sent = studioNotebookKernel.execute({ cellId, code });
  if (!sent) {
    return jsonError(409, "Notebook kernel not active", {
      message: "Não há kernel de notebook ativo.",
      code: "studio_notebook_not_active",
    });
  }

  return Response.json({ sent: true });
}
