import { NextRequest } from "next/server";
import { studioTerminal } from "@/lib/server/studioTerminal";
import { requireStudioWorkspaceAccess } from "@/lib/server/studioWorkspaceAuth";

export async function POST(request: NextRequest) {
  const gate = await requireStudioWorkspaceAccess(request);
  if (!gate.ok) return gate.response;

  // Idempotente: encerrar sem sessão ativa não é erro — o estado final
  // desejado (nenhum terminal vivo) já vale.
  const closed = studioTerminal.close();
  return Response.json({ closed });
}
