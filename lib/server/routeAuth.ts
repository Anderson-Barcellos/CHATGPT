import { NextRequest } from "next/server";
import { jsonError } from "@/lib/api/errors";
import {
  isAuthConfigurationValid,
  isAuthEnabled,
  isAuthenticatedRequest,
} from "@/lib/server/auth";

export async function requireAppAuth(
  request: NextRequest
): Promise<Response | null> {
  if (!isAuthConfigurationValid()) {
    return jsonError(503, "Authentication unavailable", {
      message: "A configuração de autenticação está indisponível.",
      code: "auth_configuration_invalid",
    });
  }

  if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
    return jsonError(401, "Unauthorized", {
      message: "Faça login para continuar.",
      code: "unauthorized",
    });
  }

  return null;
}
