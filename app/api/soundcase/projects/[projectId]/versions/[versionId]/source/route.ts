import { NextRequest } from "next/server";
import { requireAppAuth } from "@/lib/server/routeAuth";
import { getSoundCaseVersion, readSoundCaseVersionSource } from "@/lib/server/soundcase/jobs";
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
      return Response.json({ error: "SoundCase version not found", code: "soundcase_version_not_found" }, { status: 404 });
    }
    const text = await readSoundCaseVersionSource(projectId, versionId);
    return Response.json({ text }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return soundCaseErrorResponse(error); }
}
