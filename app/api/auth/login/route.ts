import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  getAuthPassword,
  getAuthUsername,
  isAuthEnabled,
  setAuthCookie,
  signAuthToken,
} from "@/lib/server/auth";

function valuesMatch(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!isAuthEnabled()) {
      return NextResponse.json({ success: true });
    }

    const correctUsername = getAuthUsername();
    const correctPassword = getAuthPassword();

    const usernameMatches = valuesMatch(username ?? "", correctUsername);
    const passwordMatches = valuesMatch(password ?? "", correctPassword);

    if (!usernameMatches || !passwordMatches) {
      return NextResponse.json(
        { error: "Credenciais incorretas" },
        { status: 401 }
      );
    }

    const token = await signAuthToken();
    const response = NextResponse.json({ success: true });
    setAuthCookie(response, token, request);

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Erro ao processar login" },
      { status: 500 }
    );
  }
}
