import { NextRequest, NextResponse } from "next/server";
import { CustomInstructions } from "@/types";
import { readDataFile, withDataFileLock, writeDataFile } from "@/lib/server/jsonFileStore";
import { isAuthEnabled, isAuthenticatedRequest } from "@/lib/server/auth";
import { readPersonalPersona } from "@/lib/server/memory/personalSources";
import { schedulePersonalSynthesis } from "@/lib/server/memory/personalSynthesis";
import {
  DEFAULT_PERSONA,
  hydratePersona,
  normalizePersonaUpdate,
} from "@/lib/persona/persona";

const FILE_NAME = "persona.json";

function unauthorized() {
  return NextResponse.json(
    { error: "Unauthorized", message: "Faça login para continuar." },
    { status: 401 }
  );
}

async function readPersona(): Promise<CustomInstructions> {
  return readPersonalPersona();
}

async function writePersona(data: CustomInstructions) {
  await writeDataFile(FILE_NAME, data);
}

export async function GET(request: NextRequest) {
  if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
    return unauthorized();
  }

  const data = await readPersona();
  return NextResponse.json(data);
}

async function savePersonaRequest(request: NextRequest) {
  if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
    return unauthorized();
  }

  try {
    const body = await request.json();
    await readPersona();

    const data = await withDataFileLock(FILE_NAME, async () => {
      const raw = await readDataFile(FILE_NAME, DEFAULT_PERSONA);
      const current = hydratePersona(raw);
      const update = normalizePersonaUpdate(current, body);
      if (!update.ok) {
        return update;
      }

      const data = update.data;
      await writePersona({ ...raw, ...data });
      return { ok: true as const, data };
    });

    if (!data.ok) {
      return NextResponse.json({ error: data.error }, { status: data.status ?? 400 });
    }

    schedulePersonalSynthesis();
    return NextResponse.json(data.data);
  } catch (error) {
    console.error("[persona] save error", error);
    return NextResponse.json({ error: "Failed to save persona" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  return savePersonaRequest(request);
}

export async function POST(request: NextRequest) {
  return savePersonaRequest(request);
}
