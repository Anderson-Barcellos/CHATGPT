import { NextRequest, NextResponse } from "next/server";
import { isAuthEnabled, isAuthenticatedRequest } from "@/lib/server/auth";

export async function GET(request: NextRequest) {
  const authEnabled = isAuthEnabled();
  if (!authEnabled) {
    return NextResponse.json({ authenticated: false, authEnabled: false });
  }

  return NextResponse.json({
    authEnabled: true,
    authenticated: await isAuthenticatedRequest(request),
  });
}
