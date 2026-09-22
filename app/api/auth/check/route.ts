import { NextRequest, NextResponse } from "next/server";
import {
  isAuthConfigurationValid,
  isAuthEnabled,
  isAuthenticatedRequest,
} from "@/lib/server/auth";

export async function GET(request: NextRequest) {
  if (!isAuthConfigurationValid()) {
    return NextResponse.json(
      { error: "Serviço de autenticação indisponível" },
      { status: 503 }
    );
  }

  const authEnabled = isAuthEnabled();
  if (!authEnabled) {
    return NextResponse.json({ authenticated: false, authEnabled: false });
  }

  return NextResponse.json({
    authEnabled: true,
    authenticated: await isAuthenticatedRequest(request),
  });
}
