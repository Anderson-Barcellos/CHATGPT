import { NextRequest, NextResponse } from "next/server";
import { isAuthEnabled, isAuthenticatedRequest } from "@/lib/server/auth";

export async function GET(request: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ authenticated: true });
  }

  return NextResponse.json({
    authenticated: await isAuthenticatedRequest(request),
  });
}
