import { NextRequest, NextResponse } from "next/server";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";
import { requireAppAuth } from "@/lib/server/routeAuth";
import { createSoundCaseProject, getSoundCaseProject, listSoundCaseProjects } from "@/lib/server/soundcase/store";
import { invalidSoundCasePayloadResponse, parseSoundCaseProjectCreate, soundCaseErrorResponse } from "@/lib/server/soundcase/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;
  try {
    return NextResponse.json({ projects: await listSoundCaseProjects() });
  } catch (error) {
    return soundCaseErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;
  const body = await readJsonWithLimit<unknown>(request, { limitBytes: 1024 * 1024 + 4096 });
  if (!body.ok) return body.reason === "too_large"
    ? Response.json({ error: "Payload too large", code: "soundcase_payload_too_large" }, { status: 413 })
    : invalidSoundCasePayloadResponse();
  const input = parseSoundCaseProjectCreate(body.value);
  if (!input) return invalidSoundCasePayloadResponse();
  try {
    const created = await createSoundCaseProject(input);
    const project = await getSoundCaseProject(created.id);
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return soundCaseErrorResponse(error);
  }
}
