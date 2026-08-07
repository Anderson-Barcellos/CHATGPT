import { NextRequest } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { STUDIO_WORKSPACE_ACTIVE_DIR } from "@/lib/server/studioWorkspaceFs";
import { studioWorkspaceErrorResponse } from "@/lib/server/studioWorkspaceHttp";
import { installWorkspaceFromBuffer } from "@/lib/server/studioWorkspaceZip";
import { requireStudioWorkspaceAccess } from "@/lib/server/studioWorkspaceAuth";
import { STUDIO_WORKSPACE_MAX_UPLOAD_BYTES } from "@/lib/studio/workspaceServerProtocol";

export async function POST(request: NextRequest) {
  const gate = await requireStudioWorkspaceAccess(request);
  if (!gate.ok) return gate.response;

  let file: File | null = null;
  try {
    const formData = await request.formData();
    const candidate = formData.get("file");
    file = candidate instanceof File ? candidate : null;
  } catch {
    file = null;
  }

  if (!file) {
    return jsonError(400, "Missing zip upload", {
      message: "Envie um arquivo zip no campo file.",
      code: "studio_workspace_upload_missing",
    });
  }

  if (file.size > STUDIO_WORKSPACE_MAX_UPLOAD_BYTES) {
    return jsonError(413, "Upload too large", {
      message: "O zip enviado excede o limite de 50 MB.",
      code: "studio_workspace_too_large",
    });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await installWorkspaceFromBuffer(
    STUDIO_WORKSPACE_ACTIVE_DIR,
    buffer
  );
  if (!result.ok) return studioWorkspaceErrorResponse(result.reason);

  return Response.json({ imported: true });
}
