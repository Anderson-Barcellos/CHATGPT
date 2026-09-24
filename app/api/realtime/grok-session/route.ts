import { NextRequest, NextResponse } from "next/server";
import { requireAppAuth } from "@/lib/server/routeAuth";
import { createSoundCaseGrokEphemeralToken, SoundCaseGrokRealtimeError } from "@/lib/server/soundcase/grokRealtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const token = await createSoundCaseGrokEphemeralToken(request.signal);
    return NextResponse.json({ token }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof SoundCaseGrokRealtimeError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return Response.json({ error: "Não foi possível abrir a sessão Grok Realtime." }, { status: 502 });
  }
}
