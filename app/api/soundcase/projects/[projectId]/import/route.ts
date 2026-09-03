import { NextRequest, NextResponse } from "next/server";
import { requireAppAuth } from "@/lib/server/routeAuth";
import { importSoundCaseText, SOUNDCASE_MAX_IMPORT_BYTES } from "@/lib/server/soundcase/store";
import { invalidSoundCaseIdResponse, invalidSoundCasePayloadResponse, isSoundCaseId, soundCaseErrorResponse } from "@/lib/server/soundcase/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ projectId: string }> };

export async function POST(request: NextRequest, context: Context) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;
  const { projectId } = await context.params;
  if (!isSoundCaseId(projectId)) return invalidSoundCaseIdResponse();
  let file: File | null = null;
  try {
    const candidate = (await request.formData()).get("file");
    file = candidate instanceof File ? candidate : null;
  } catch {
    return invalidSoundCasePayloadResponse("import");
  }
  if (!file) return invalidSoundCasePayloadResponse("import");
  if (file.size > SOUNDCASE_MAX_IMPORT_BYTES) {
    return Response.json({ error: "Import too large", code: "soundcase_import_size" }, { status: 413 });
  }
  try {
    const project = await importSoundCaseText(projectId, {
      name: file.name, mime: file.type, bytes: new Uint8Array(await file.arrayBuffer()),
    });
    return NextResponse.json({ project });
  } catch (error) { return soundCaseErrorResponse(error); }
}
