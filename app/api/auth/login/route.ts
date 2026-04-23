import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  getAuthPassword,
  isAuthEnabled,
  setAuthCookie,
  signAuthToken,
} from "@/lib/server/auth";

function passwordsMatch(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (!isAuthEnabled()) {
      return NextResponse.json({ success: true });
    }

    const correctPassword = getAuthPassword();

    if (!passwordsMatch(password ?? "", correctPassword)) {
      return NextResponse.json(
        { error: "Senha incorreta" },
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
