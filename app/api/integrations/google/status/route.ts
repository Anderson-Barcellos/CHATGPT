import { NextRequest, NextResponse } from "next/server";
import { defaultCalendarId } from "@/lib/calendar/eventDrafts";
import { isGoogleOAuthConfigured, googleOAuthRedirectUri } from "@/lib/google/oauth";
import { getGoogleCalendarConnectionStatus } from "@/lib/google/tokenStore";
import { requireAppAuth } from "@/lib/server/routeAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;

  const status = await getGoogleCalendarConnectionStatus(defaultCalendarId());

  return NextResponse.json({
    ...status,
    oauthConfigured: isGoogleOAuthConfigured(),
    redirectUri: (() => {
      try {
        return googleOAuthRedirectUri(request);
      } catch {
        return null;
      }
    })(),
  });
}
