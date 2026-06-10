import { NextRequest } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { isAuthEnabled, isAuthenticatedRequest } from "@/lib/server/auth";

export async function requireAppAuth(
  request: NextRequest
): Promise<Response | null> {
  if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
    return jsonError(401, "Unauthorized", {
      message: "Faça login para continuar.",
      code: "unauthorized",
    });
  }

  return null;
}
