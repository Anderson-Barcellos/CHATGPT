import { NextRequest, NextResponse } from "next/server";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";
import { requireAppAuth } from "@/lib/server/routeAuth";
import { createSoundCaseVersion } from "@/lib/server/soundcase/jobs";
import { getSoundCaseProject } from "@/lib/server/soundcase/store";
import { invalidSoundCaseIdResponse, invalidSoundCasePayloadResponse, isSoundCaseId, parseSoundCaseSettings, soundCaseErrorResponse, toPublicSoundCaseVersion } from "@/lib/server/soundcase/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ projectId: string }> };

export async function GET(request: NextRequest, context: Context) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;
  const { projectId } = await context.params;
  if (!isSoundCaseId(projectId)) return invalidSoundCaseIdResponse();
  try { return NextResponse.json({ versions: (await getSoundCaseProject(projectId)).versions }); }
  catch (error) { return soundCaseErrorResponse(error); }
}

export async function POST(request: NextRequest, context: Context) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;
  const { projectId } = await context.params;
  if (!isSoundCaseId(projectId)) return invalidSoundCaseIdResponse();
  const body = await readJsonWithLimit<unknown>(request, { limitBytes: 16 * 1024 });
  if (!body.ok) return body.reason === "too_large"
    ? Response.json({ error: "Payload too large", code: "soundcase_payload_too_large" }, { status: 413 })
    : invalidSoundCasePayloadResponse("settings");
  const value = body.value;
  const settings = value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === 1 && "settings" in value
    ? parseSoundCaseSettings((value as { settings?: unknown }).settings)
    : null;
  if (!settings) return invalidSoundCasePayloadResponse("settings");
  try {
    const result = await createSoundCaseVersion(projectId, settings);
    return NextResponse.json(
      { created: result.created, version: toPublicSoundCaseVersion(result.version) },
      { status: result.created ? 201 : 200 }
    );
  } catch (error) { return soundCaseErrorResponse(error); }
}
