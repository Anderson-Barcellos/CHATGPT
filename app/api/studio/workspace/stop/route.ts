import { NextRequest } from "next/server";
import { studioWorkspaceRunner } from "@/lib/server/studioWorkspaceRunner";
import { requireStudioWorkspaceAccess } from "@/lib/server/studioWorkspaceAuth";

export async function POST(request: NextRequest) {
  const gate = await requireStudioWorkspaceAccess(request);
  if (!gate.ok) return gate.response;

  const stopped = await studioWorkspaceRunner.stop();
  return Response.json({ stopped });
}
