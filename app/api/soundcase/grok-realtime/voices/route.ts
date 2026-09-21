import { NextRequest, NextResponse } from "next/server";
import { requireAppAuth } from "@/lib/server/routeAuth";
import { listSoundCaseGrokVoices } from "@/lib/server/soundcase/grokRealtime";
import { soundCaseErrorResponse } from "@/lib/server/soundcase/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;
  try {
    return NextResponse.json({ voices: await listSoundCaseGrokVoices(request.signal) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return soundCaseErrorResponse(error); }
}
