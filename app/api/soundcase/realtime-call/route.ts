import { NextRequest } from "next/server";
import { requireAppAuth } from "@/lib/server/routeAuth";
import { getSoundCaseVersion } from "@/lib/server/soundcase/jobs";
import { buildRealtimeSession, createRealtimeCallResponse } from "@/lib/server/realtimeCall";
import { invalidSoundCaseIdResponse, isSoundCaseId, soundCaseErrorResponse } from "@/lib/server/soundcase/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_SDP_BYTES = 256 * 1024;

export async function POST(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;
  const projectId = request.nextUrl.searchParams.get("projectId") ?? "";
  const versionId = request.nextUrl.searchParams.get("versionId") ?? "";
  if (!isSoundCaseId(projectId) || !isSoundCaseId(versionId)) return invalidSoundCaseIdResponse();
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_SDP_BYTES) {
    return Response.json({ error: "SDP too large", code: "soundcase_sdp_too_large" }, { status: 413 });
  }
  try {
    const version = await getSoundCaseVersion(projectId, versionId);
    if (!version.direction || !version.effectiveSettings) {
      return Response.json({ error: "SoundCase direction not ready", code: "soundcase_direction_not_ready" }, { status: 409 });
    }
    const sdp = await request.text();
    if (new TextEncoder().encode(sdp).byteLength > MAX_SDP_BYTES) {
      return Response.json({ error: "SDP too large", code: "soundcase_sdp_too_large" }, { status: 413 });
    }
    return createRealtimeCallResponse({
      request,
      sdp,
      session: buildRealtimeSession({
        product: "soundcase",
        voice: version.effectiveSettings.voice.value,
        speed: version.effectiveSettings.speed.value,
        instructions: version.effectiveSettings.instructions.value,
      }),
      safetyIdentifier: "gaucho-soundcase-realtime",
    });
  } catch (error) { return soundCaseErrorResponse(error); }
}
