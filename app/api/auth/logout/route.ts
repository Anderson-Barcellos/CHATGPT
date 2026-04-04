import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/server/auth";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  clearAuthCookie(response, request);
  return response;
}
