import { NextRequest, NextResponse } from "next/server";
import { requireAppAuth } from "@/lib/server/routeAuth";
import { getSoundCaseVersion } from "@/lib/server/soundcase/jobs";
import { createSoundCaseGrokEphemeralToken } from "@/lib/server/soundcase/grokRealtime";
import { invalidSoundCaseIdResponse, isSoundCaseId, soundCaseErrorResponse } from "@/lib/server/soundcase/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;
  const projectId = request.nextUrl.searchParams.get("projectId") ?? "";
  const versionId = request.nextUrl.searchParams.get("versionId") ?? "";
  if (!isSoundCaseId(projectId) || !isSoundCaseId(versionId)) return invalidSoundCaseIdResponse();
  try {
    const version = await getSoundCaseVersion(projectId, versionId);
    if (version.projectId !== projectId || version.id !== versionId) {
      return Response.json({ error: "SoundCase version not found", code: "soundcase_version_not_found" }, { status: 404 });
    }
    if (!version.direction) {
      return Response.json({ error: "SoundCase direction unavailable", message: "Esta versão ainda não possui uma direção de leitura.", code: "soundcase_direction_unavailable" }, { status: 409 });
    }
    const token = await createSoundCaseGrokEphemeralToken(request.signal);
    return NextResponse.json({ token }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return soundCaseErrorResponse(error); }
}
