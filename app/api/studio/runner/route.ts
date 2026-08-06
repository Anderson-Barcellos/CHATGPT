import { NextRequest } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { isAuthenticatedRequest, isAuthEnabled } from "@/lib/server/auth";
import { createStudioRunnerScriptResponse } from "@/lib/server/studioRunner";

export async function GET(request: NextRequest) {
  if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
    return jsonError(401, "Unauthorized", {
      message: "Faça login para continuar.",
      code: "unauthorized",
    });
  }

  return createStudioRunnerScriptResponse();
}
