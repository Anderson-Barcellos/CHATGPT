import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify, errors as joseErrors } from "jose";
import { NextRequest } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { isAuthEnabled, isAuthenticatedRequest } from "@/lib/server/auth";

export const STUDIO_WORKSPACE_TOKEN_HEADER = "x-studio-workspace-token";
const STUDIO_WORKSPACE_TOKEN_TTL_SECONDS = 60 * 60;
const STUDIO_WORKSPACE_TOKEN_SCOPE = "studio-workspace";

// Salt por processo: restart do serviço invalida todos os tokens emitidos,
// e o secret nunca coincide com o JWT_SECRET do auth do app.
const processSalt = randomUUID();

type StudioWorkspaceGateResult =
  | { ok: true }
  | { ok: false; response: Response };

function getConfiguredPassword(): string | null {
  const password = process.env.STUDIO_WORKSPACE_PASSWORD?.trim();
  return password ? password : null;
}

export function isStudioWorkspaceEnabled(): boolean {
  return getConfiguredPassword() !== null;
}

function getWorkspaceSecret(): Uint8Array {
  const password = getConfiguredPassword();
  if (!password) {
    throw new Error(
      "STUDIO_WORKSPACE_PASSWORD must be configured for the studio workspace."
    );
  }

  return new TextEncoder().encode(`${password}:${processSalt}`);
}

export function verifyStudioWorkspacePassword(candidate: string): boolean {
  const password = getConfiguredPassword();
  if (!password || !candidate) return false;

  const expected = createHash("sha256").update(password).digest();
  const received = createHash("sha256").update(candidate).digest();
  return timingSafeEqual(expected, received);
}

export async function signStudioWorkspaceToken(): Promise<string> {
  return new SignJWT({ scope: STUDIO_WORKSPACE_TOKEN_SCOPE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${STUDIO_WORKSPACE_TOKEN_TTL_SECONDS}s`)
    .sign(getWorkspaceSecret());
}

export async function verifyStudioWorkspaceToken(
  token: string
): Promise<boolean> {
  if (!token || !isStudioWorkspaceEnabled()) return false;

  try {
    const { payload } = await jwtVerify(token, getWorkspaceSecret());
    return payload.scope === STUDIO_WORKSPACE_TOKEN_SCOPE;
  } catch (error) {
    if (!(error instanceof joseErrors.JOSEError)) {
      console.error("[studio-workspace] verifyStudioWorkspaceToken erro inesperado:", error);
    }
    return false;
  }
}

export async function requireStudioWorkspaceAccess(
  request: NextRequest
): Promise<StudioWorkspaceGateResult> {
  if (!isStudioWorkspaceEnabled()) {
    return {
      ok: false,
      response: jsonError(503, "Studio workspace disabled", {
        message: "O workspace Python não está habilitado neste servidor.",
        code: "studio_workspace_disabled",
      }),
    };
  }

  if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
    return {
      ok: false,
      response: jsonError(401, "Unauthorized", {
        message: "Faça login para continuar.",
        code: "unauthorized",
      }),
    };
  }

  const token = request.headers.get(STUDIO_WORKSPACE_TOKEN_HEADER) ?? "";
  if (!(await verifyStudioWorkspaceToken(token))) {
    return {
      ok: false,
      response: jsonError(401, "Studio workspace locked", {
        message: "Desbloqueie o workspace com a senha própria dele.",
        code: "studio_workspace_locked",
      }),
    };
  }

  return { ok: true };
}
