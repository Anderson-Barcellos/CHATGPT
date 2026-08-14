import { NextRequest } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { studioNotebookKernel } from "@/lib/server/studioNotebookKernel";
import { requireStudioWorkspaceAccess } from "@/lib/server/studioWorkspaceAuth";

export async function POST(request: NextRequest) {
  const gate = await requireStudioWorkspaceAccess(request);
  if (!gate.ok) return gate.response;

  const sent = studioNotebookKernel.interrupt();
  if (!sent) {
    return jsonError(409, "Notebook kernel not active", {
      message: "Não há kernel de notebook ativo.",
      code: "studio_notebook_not_active",
    });
  }

  return Response.json({ interrupted: true });
}
