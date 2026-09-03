import { NextRequest, NextResponse } from "next/server";
import { requireAppAuth } from "@/lib/server/routeAuth";
import { cancelSoundCaseVersion } from "@/lib/server/soundcase/jobs";
import { invalidSoundCaseIdResponse, isSoundCaseId, soundCaseErrorResponse } from "@/lib/server/soundcase/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ projectId: string; versionId: string }> };

export async function POST(request: NextRequest, context: Context) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;
  const { projectId, versionId } = await context.params;
  if (!isSoundCaseId(projectId) || !isSoundCaseId(versionId)) return invalidSoundCaseIdResponse();
  try {
    const version = await cancelSoundCaseVersion(projectId, versionId);
    return NextResponse.json({ projectId, versionId, status: version.status });
  } catch (error) { return soundCaseErrorResponse(error); }
}
