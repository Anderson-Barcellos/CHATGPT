import { SignJWT, jwtVerify, errors as joseErrors } from "jose";
import { NextRequest, NextResponse } from "next/server";

export const AUTH_COOKIE_NAME = "auth-token";
const AUTH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

type AuthTokenPayload = {
  authenticated: true;
};

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret) {
    throw new Error("JWT_SECRET must be configured when AUTH_ENABLED=true.");
  }

  return new TextEncoder().encode(secret);
}

export function isAuthEnabled(): boolean {
  return process.env.AUTH_ENABLED === "true";
}

export function getAuthPassword(): string {
  const password = process.env.AUTH_PASSWORD?.trim();

  if (!password) {
    throw new Error("AUTH_PASSWORD must be configured when AUTH_ENABLED=true.");
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
