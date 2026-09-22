import { SignJWT, jwtVerify, errors as joseErrors } from "jose";
import { NextRequest, NextResponse } from "next/server";

export const AUTH_COOKIE_NAME = "auth-token";
const AUTH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

type AuthTokenPayload = {
  authenticated: true;
};

type RuntimeAuthState = "enabled" | "disabled" | "invalid";

/**
 * Valida o contrato de autenticação que precisa estar resolvido antes do boot.
 * As mensagens deliberadamente citam apenas nomes de variáveis, nunca valores.
 */
export function validateRuntimeAuthConfig(): void {
  const errors: string[] = [];
  const enabled = process.env.AUTH_ENABLED;
  const production = process.env.NODE_ENV === "production";

  if (production && enabled !== "true") {
    errors.push("AUTH_ENABLED must be true in production");
  } else if (!production && enabled !== "true" && enabled !== "false") {
    errors.push("AUTH_ENABLED must be explicitly true or false outside production");
  }

  if (enabled === "true") {
    for (const variable of ["AUTH_USERNAME", "AUTH_PASSWORD", "JWT_SECRET"] as const) {
      if (!process.env[variable]?.trim()) {
        errors.push(`${variable} must be configured when AUTH_ENABLED=true`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid authentication configuration: ${errors.join("; ")}.`);
  }
}

function runtimeAuthState(): RuntimeAuthState {
  try {
    validateRuntimeAuthConfig();
    return process.env.AUTH_ENABLED === "true" ? "enabled" : "disabled";
  } catch {
    return "invalid";
  }
}

export function isAuthConfigurationValid(): boolean {
  return runtimeAuthState() !== "invalid";
}

function getJwtSecret(): Uint8Array {
  validateRuntimeAuthConfig();
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error("Invalid authentication configuration: JWT_SECRET must be configured.");
  }
  return new TextEncoder().encode(secret);
}

export function isAuthEnabled(): boolean {
  // Configuração inválida exige autenticação para jamais abrir uma rota por bypass.
  return runtimeAuthState() !== "disabled";
}

export function getAuthUsername(): string {
  validateRuntimeAuthConfig();
  const username = process.env.AUTH_USERNAME?.trim();
  if (!username) {
    throw new Error("Invalid authentication configuration: AUTH_USERNAME must be configured.");
  }
  return username;
}

export function getAuthPassword(): string {
  validateRuntimeAuthConfig();
  const password = process.env.AUTH_PASSWORD?.trim();
  if (!password) {
    throw new Error("Invalid authentication configuration: AUTH_PASSWORD must be configured.");
  }
  return password;
}

export async function signAuthToken(): Promise<string> {
  return new SignJWT({ authenticated: true } satisfies AuthTokenPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${AUTH_TOKEN_TTL_SECONDS}s`)
    .sign(getJwtSecret());
}

export async function verifyAuthToken(token: string): Promise<boolean> {
  if (!isAuthConfigurationValid()) return false;

  try {
    await jwtVerify(token, getJwtSecret());
    return true;
  } catch (err) {
    if (!(err instanceof joseErrors.JOSEError)) {
      console.error("[auth] verifyAuthToken erro inesperado:", err);
    }
    return false;
  }
}

export async function isAuthenticatedRequest(request: NextRequest): Promise<boolean> {
  if (!isAuthConfigurationValid()) return false;
  if (!isAuthEnabled()) return true;

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return false;

  return verifyAuthToken(token);
}

function shouldUseSecureCookie(request?: NextRequest): boolean {
  // Prefer explicit proxy header when available (Apache/Nginx).
  const forwardedProto = request?.headers.get("x-forwarded-proto")?.toLowerCase();
  if (forwardedProto === "https") return true;
  if (forwardedProto === "http") return false;

  // Fallback for direct requests (localhost/dev).
  if (request?.nextUrl.protocol === "https:") return true;
  if (request?.nextUrl.protocol === "http:") return false;

  // Last resort: keep strict behavior in production.
  return process.env.NODE_ENV === "production";
}

export function setAuthCookie(
  response: NextResponse,
  token: string,
  request?: NextRequest
): void {
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: shouldUseSecureCookie(request),
    sameSite: "lax",
    maxAge: AUTH_TOKEN_TTL_SECONDS,
    path: "/",
  });
}

export function clearAuthCookie(response: NextResponse, request?: NextRequest): void {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: shouldUseSecureCookie(request),
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}
