import { NextRequest } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { isAuthEnabled, isAuthenticatedRequest } from "@/lib/server/auth";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";
import {
  isStudioWorkspaceEnabled,
  signStudioWorkspaceToken,
  verifyStudioWorkspacePassword,
} from "@/lib/server/studioWorkspaceAuth";

const BODY_LIMIT_BYTES = 4 * 1024;

export async function POST(request: NextRequest) {
  if (!isStudioWorkspaceEnabled()) {
    return jsonError(503, "Studio workspace disabled", {
      message: "O workspace Python não está habilitado neste servidor.",
      code: "studio_workspace_disabled",
    });
  }

  if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
    return jsonError(401, "Unauthorized", {
      message: "Faça login para continuar.",
      code: "unauthorized",
    });
  }

  const body = await readJsonWithLimit<unknown>(request, {
    limitBytes: BODY_LIMIT_BYTES,
  });
  if (!body.ok) {
    return jsonError(body.status, "Request body error", {
      message: "Corpo do desbloqueio inválido.",
      code: "studio_workspace_body_invalid",
    });
  }

  const password =
    body.value && typeof body.value === "object" && !Array.isArray(body.value)
      ? (body.value as { password?: unknown }).password
      : undefined;

  if (typeof password !== "string" || !verifyStudioWorkspacePassword(password)) {
    return jsonError(401, "Studio workspace password invalid", {
      message: "Senha do workspace incorreta.",
      code: "studio_workspace_password_invalid",
    });
  }

  return Response.json({ token: await signStudioWorkspaceToken() });
}
