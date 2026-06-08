import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import type { GoogleOAuthTokenSet } from "@/lib/google/tokenStore";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
] as const;

export class GoogleOAuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleOAuthConfigError";
  }
}

export class GoogleOAuthExchangeError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "GoogleOAuthExchangeError";
    this.status = status;
  }
}

interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

function cleanEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function basePath(): string {
  const configured = cleanEnv("NEXT_PUBLIC_BASE_PATH");
  if (!configured) return "";
  return configured.startsWith("/") ? configured : `/${configured}`;
}

function appOrigin(request?: NextRequest): string | undefined {
  const publicUrl = cleanEnv("NEXT_PUBLIC_APP_URL");
  if (publicUrl) return publicUrl.replace(/\/$/, "");

  if (request) {
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
    if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;
    return request.nextUrl.origin;
  }

  return undefined;
}

export function googleOAuthRedirectUri(request?: NextRequest): string {
  const configured = cleanEnv("GOOGLE_OAUTH_REDIRECT_URI");
  if (configured) return configured;

  const origin = appOrigin(request);
  if (!origin) {
    throw new GoogleOAuthConfigError(
      "GOOGLE_OAUTH_REDIRECT_URI ou NEXT_PUBLIC_APP_URL precisa estar configurado."
    );
  }

  return `${origin}${basePath()}/api/integrations/google/auth/callback`;
}

export function getGoogleOAuthConfig(request?: NextRequest): GoogleOAuthConfig {
  const clientId = cleanEnv("GOOGLE_CLIENT_ID");
  const clientSecret = cleanEnv("GOOGLE_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new GoogleOAuthConfigError(
      "GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET precisam estar configurados."
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri: googleOAuthRedirectUri(request),
  };
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(cleanEnv("GOOGLE_CLIENT_ID") && cleanEnv("GOOGLE_CLIENT_SECRET"));
}

export function createGoogleOAuthState(): string {
  return randomBytes(24).toString("base64url");
}

export function buildGoogleOAuthAuthorizationUrl(
  state: string,
  request?: NextRequest
): string {
  const config = getGoogleOAuthConfig(request);
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

async function postGoogleTokenRequest(
  body: URLSearchParams
): Promise<GoogleOAuthTokenSet> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};

  if (!response.ok) {
    const description =
      typeof payload.error_description === "string"
        ? payload.error_description
        : "Falha ao trocar credenciais com o Google.";
    throw new GoogleOAuthExchangeError(description, response.status);
  }

  return payload as GoogleOAuthTokenSet;
}

export async function exchangeGoogleOAuthCode(
  code: string,
  request?: NextRequest
): Promise<GoogleOAuthTokenSet> {
  const config = getGoogleOAuthConfig(request);
  return postGoogleTokenRequest(
    new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    })
  );
}

export async function refreshGoogleOAuthAccessToken(
  refreshToken: string,
  request?: NextRequest
): Promise<GoogleOAuthTokenSet> {
  const config = getGoogleOAuthConfig(request);
  return postGoogleTokenRequest(
    new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    })
  );
}
