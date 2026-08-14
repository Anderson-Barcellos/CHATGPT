import { NextRequest } from "next/server";
import { studioNotebookKernel } from "@/lib/server/studioNotebookKernel";
import { requireStudioWorkspaceAccess } from "@/lib/server/studioWorkspaceAuth";

export async function POST(request: NextRequest) {
  const gate = await requireStudioWorkspaceAccess(request);
  if (!gate.ok) return gate.response;

  // Idempotente: encerrar sem kernel ativo não é erro (o restart da UI
  // chama shutdown e reabre o stream em seguida).
  const closed = studioNotebookKernel.shutdown();
  return Response.json({ closed });
}
