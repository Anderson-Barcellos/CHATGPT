import { NextRequest } from "next/server";
import { requireAppAuth } from "@/lib/server/routeAuth";
import { getSoundCaseVersion } from "@/lib/server/soundcase/jobs";
import { streamSoundCaseAsset } from "@/lib/server/soundcase/assets";
import { invalidSoundCaseIdResponse, isSoundCaseId, soundCaseErrorResponse } from "@/lib/server/soundcase/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ projectId: string; versionId: string }> };

export async function GET(request: NextRequest, context: Context) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;
  const { projectId, versionId } = await context.params;
  if (!isSoundCaseId(projectId) || !isSoundCaseId(versionId)) return invalidSoundCaseIdResponse();
  try {
    const version = await getSoundCaseVersion(projectId, versionId);
    if (version.projectId !== projectId || version.id !== versionId) {
      return Response.json({ error: "SoundCase asset not found", code: "soundcase_asset_not_found" }, { status: 404 });
    }
    return streamSoundCaseAsset({ request, version, kind: "audio" });
  } catch (error) { return soundCaseErrorResponse(error); }
}
