import { NextRequest, NextResponse } from "next/server";
import { CustomInstructions } from "@/types";
import { readDataFile, withDataFileLock, writeDataFile } from "@/lib/server/jsonFileStore";
import { isAuthEnabled, isAuthenticatedRequest } from "@/lib/server/auth";
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
  const data = await readDataFile(FILE_NAME, DEFAULT_PERSONA);
  return hydratePersona(data);
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

    const data = await withDataFileLock(FILE_NAME, async () => {
      const current = await readPersona();
      const update = normalizePersonaUpdate(current, body);
      if (!update.ok) {
        return update;
      }

      const data = update.data;
      await writePersona(data);
      return { ok: true as const, data };
    });

    if (!data.ok) {
      return NextResponse.json({ error: data.error }, { status: 400 });
    }

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
