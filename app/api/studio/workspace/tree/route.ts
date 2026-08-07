import { NextRequest } from "next/server";
import {
  STUDIO_WORKSPACE_ACTIVE_DIR,
  listWorkspaceTree,
} from "@/lib/server/studioWorkspaceFs";
import { requireStudioWorkspaceAccess } from "@/lib/server/studioWorkspaceAuth";

export async function GET(request: NextRequest) {
  const gate = await requireStudioWorkspaceAccess(request);
  if (!gate.ok) return gate.response;

  const entries = await listWorkspaceTree(STUDIO_WORKSPACE_ACTIVE_DIR);
  return Response.json({ entries });
}
