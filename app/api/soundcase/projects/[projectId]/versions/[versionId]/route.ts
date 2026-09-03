import { NextRequest, NextResponse } from "next/server";
import { requireAppAuth } from "@/lib/server/routeAuth";
import { deleteSoundCaseVersion, getSoundCaseVersion } from "@/lib/server/soundcase/jobs";
import { invalidSoundCaseIdResponse, isSoundCaseId, soundCaseErrorResponse, toPublicSoundCaseVersion } from "@/lib/server/soundcase/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ projectId: string; versionId: string }> };
async function ids(context: Context) {
  const value = await context.params;
  return isSoundCaseId(value.projectId) && isSoundCaseId(value.versionId) ? value : null;
}

export async function GET(request: NextRequest, context: Context) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;
  const value = await ids(context);
  if (!value) return invalidSoundCaseIdResponse();
  try { return NextResponse.json({ version: toPublicSoundCaseVersion(await getSoundCaseVersion(value.projectId, value.versionId)) }); }
  catch (error) { return soundCaseErrorResponse(error); }
}

export async function DELETE(request: NextRequest, context: Context) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;
  const value = await ids(context);
  if (!value) return invalidSoundCaseIdResponse();
  try {
    await deleteSoundCaseVersion(value.projectId, value.versionId);
    return NextResponse.json({ deleted: true, ...value });
  } catch (error) { return soundCaseErrorResponse(error); }
}
