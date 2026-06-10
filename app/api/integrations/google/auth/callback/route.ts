import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors";
import {
  exchangeGoogleOAuthCode,
  GoogleOAuthConfigError,
  GoogleOAuthExchangeError,
} from "@/lib/google/oauth";
import { GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/google/oauthState";
import { saveGoogleCalendarToken } from "@/lib/google/tokenStore";
import { requireAppAuth } from "@/lib/server/routeAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function appRedirectUrl(request: NextRequest, status: "connected" | "error"): URL {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const url = new URL(`${basePath || ""}/`, request.nextUrl.origin);
  url.searchParams.set("googleCalendar", status);
  return url;
}

function clearStateCookie(response: NextResponse): void {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim();
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    path: basePath ? (basePath.startsWith("/") ? basePath : `/${basePath}`) : "/",
  });
}

export async function GET(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;

  const expectedState = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const oauthError = request.nextUrl.searchParams.get("error");

  if (oauthError) {
    return jsonError(400, "Google OAuth denied", {
      message: "Autorizacao do Google nao foi concluida.",
      code: "google_oauth_denied",
    });
  }

  if (!expectedState || !state || expectedState !== state) {
    return jsonError(400, "Invalid Google OAuth state", {
      message: "Estado OAuth invalido. Inicie a conexao novamente.",
      code: "google_oauth_state_invalid",
    });
  }

  if (!code) {
    return jsonError(400, "Missing Google OAuth code", {
      message: "Google nao retornou codigo de autorizacao.",
      code: "google_oauth_code_missing",
    });
  }

  try {
    const tokenSet = await exchangeGoogleOAuthCode(code, request);
    await saveGoogleCalendarToken(tokenSet);
    const response = NextResponse.redirect(appRedirectUrl(request, "connected"));
    clearStateCookie(response);
    return response;
  } catch (error) {
    if (error instanceof GoogleOAuthConfigError) {
      return jsonError(503, "Google OAuth not configured", {
        message: error.message,
        code: "google_oauth_not_configured",
      });
    }

    if (error instanceof GoogleOAuthExchangeError) {
      return jsonError(error.status, "Google OAuth exchange failed", {
        message: error.message,
        code: "google_oauth_exchange_failed",
      });
    }

    console.error("[google-oauth] callback error", error);
    return jsonError(500, "Failed to finish Google OAuth", {
      message: "Nao consegui finalizar a conexao com o Google agora.",
      code: "google_oauth_callback_failed",
    });
  }
}
