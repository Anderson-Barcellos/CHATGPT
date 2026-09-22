import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookie, isAuthConfigurationValid } from "@/lib/server/auth";

export async function POST(request: NextRequest) {
  if (!isAuthConfigurationValid()) {
    return NextResponse.json(
      { error: "Serviço de autenticação indisponível" },
      { status: 503 }
    );
  }

  const response = NextResponse.json({ success: true });
  clearAuthCookie(response, request);
  return response;
}
