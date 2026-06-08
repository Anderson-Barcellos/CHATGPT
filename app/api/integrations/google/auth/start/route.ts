import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { buildGoogleOAuthAuthorizationUrl, createGoogleOAuthState, GoogleOAuthConfigError } from "@/lib/google/oauth";
import { GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/google/oauthState";
import { requireAppAuth } from "@/lib/server/routeAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authCookiePath(): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim();
  if (!basePath) return "/";
  return basePath.startsWith("/") ? basePath : `/${basePath}`;
}

function secureCookie(request: NextRequest): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.toLowerCase();
  if (forwardedProto === "https") return true;
  if (forwardedProto === "http") return false;
  return request.nextUrl.protocol === "https:";
}

export async function GET(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const state = createGoogleOAuthState();
    const response = NextResponse.redirect(
      buildGoogleOAuthAuthorizationUrl(state, request)
    );

    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: secureCookie(request),
      sameSite: "lax",
      maxAge: 10 * 60,
      path: authCookiePath(),
    });

    return response;
  } catch (error) {
    if (error instanceof GoogleOAuthConfigError) {
      return jsonError(503, "Google OAuth not configured", {
        message: error.message,
        code: "google_oauth_not_configured",
      });
    }

    console.error("[google-oauth] start error", error);
    return jsonError(500, "Failed to start Google OAuth", {
      message: "Nao consegui iniciar a conexao com o Google agora.",
      code: "google_oauth_start_failed",
    });
  }
}
