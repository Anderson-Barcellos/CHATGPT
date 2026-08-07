import { NextRequest } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { isAuthEnabled, isAuthenticatedRequest } from "@/lib/server/auth";
import {
  STUDIO_WORKSPACE_TOKEN_HEADER,
  isStudioWorkspaceEnabled,
  verifyStudioWorkspaceToken,
} from "@/lib/server/studioWorkspaceAuth";

export async function GET(request: NextRequest) {
  if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
    return jsonError(401, "Unauthorized", {
      message: "Faça login para continuar.",
      code: "unauthorized",
    });
  }

  const enabled = isStudioWorkspaceEnabled();
  const token = request.headers.get(STUDIO_WORKSPACE_TOKEN_HEADER) ?? "";
  const unlocked = enabled && (await verifyStudioWorkspaceToken(token));

  return Response.json({ enabled, unlocked });
}
