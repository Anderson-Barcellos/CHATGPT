import { NextRequest, NextResponse } from "next/server";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";
import { requireAppAuth } from "@/lib/server/routeAuth";
import { getSoundCaseProject, saveSoundCaseDraft } from "@/lib/server/soundcase/store";
import { deleteSoundCaseProjectWithJobs } from "@/lib/server/soundcase/jobs";
import { invalidSoundCaseIdResponse, invalidSoundCasePayloadResponse, isSoundCaseId, parseSoundCaseProjectUpdate, soundCaseErrorResponse } from "@/lib/server/soundcase/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ projectId: string }> };

async function projectIdOf(context: Context): Promise<string | null> {
  const { projectId } = await context.params;
  return isSoundCaseId(projectId) ? projectId : null;
}

export async function GET(request: NextRequest, context: Context) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;
  const projectId = await projectIdOf(context);
  if (!projectId) return invalidSoundCaseIdResponse();
  try { return NextResponse.json({ project: await getSoundCaseProject(projectId) }); }
  catch (error) { return soundCaseErrorResponse(error); }
}

export async function PATCH(request: NextRequest, context: Context) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;
  const projectId = await projectIdOf(context);
  if (!projectId) return invalidSoundCaseIdResponse();
  const body = await readJsonWithLimit<unknown>(request, { limitBytes: 1024 * 1024 + 4096 });
  if (!body.ok) return body.reason === "too_large"
    ? Response.json({ error: "Payload too large", code: "soundcase_payload_too_large" }, { status: 413 })
    : invalidSoundCasePayloadResponse();
  const input = parseSoundCaseProjectUpdate(body.value);
  if (!input) return invalidSoundCasePayloadResponse();
  try { return NextResponse.json({ project: await saveSoundCaseDraft(projectId, input) }); }
  catch (error) { return soundCaseErrorResponse(error); }
}

export async function POST(request: NextRequest, context: Context) {
  return PATCH(request, context);
}

export async function DELETE(request: NextRequest, context: Context) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;
  const projectId = await projectIdOf(context);
  if (!projectId) return invalidSoundCaseIdResponse();
  try {
    await deleteSoundCaseProjectWithJobs(projectId);
    return NextResponse.json({ deleted: true, projectId });
  } catch (error) { return soundCaseErrorResponse(error); }
}
