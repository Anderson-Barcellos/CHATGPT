import path from "node:path";
import { NextRequest } from "next/server";
import { STUDIO_WORKSPACE_ACTIVE_DIR } from "@/lib/server/studioWorkspaceFs";
import { studioWorkspaceErrorResponse } from "@/lib/server/studioWorkspaceHttp";
import { installWorkspaceFromTemplate } from "@/lib/server/studioWorkspaceZip";
import { requireStudioWorkspaceAccess } from "@/lib/server/studioWorkspaceAuth";

const TEMPLATE_DIR = path.join(process.cwd(), "templates", "studio-python");

export async function POST(request: NextRequest) {
  const gate = await requireStudioWorkspaceAccess(request);
  if (!gate.ok) return gate.response;

  const result = await installWorkspaceFromTemplate(
    STUDIO_WORKSPACE_ACTIVE_DIR,
    TEMPLATE_DIR
  );
  if (!result.ok) return studioWorkspaceErrorResponse(result.reason);

  return Response.json({ reset: true });
}
