import { NextRequest, NextResponse } from "next/server";
import { CustomInstructions } from "@/types";
import { readDataFile, withDataFileLock, writeDataFile } from "@/lib/server/jsonFileStore";
import { isAuthEnabled, isAuthenticatedRequest } from "@/lib/server/auth";
import { DEFAULT_TTS_PREFERENCES, normalizeTtsPreferences } from "@/lib/tts/speechText";

const FILE_NAME = "persona.json";
const DEFAULT_PERSONA: CustomInstructions = {
  id: "default",
  contextAboutUser: "",
  responsePreferences: "",
  customSystemInstructions: "",
  ttsPreferences: DEFAULT_TTS_PREFERENCES,
};

function unauthorized() {
  return NextResponse.json(
    { error: "Unauthorized", message: "Faça login para continuar." },
    { status: 401 }
  );
}

async function readPersona(): Promise<CustomInstructions> {
  const data = await readDataFile(FILE_NAME, DEFAULT_PERSONA);
  if (!data || typeof data !== "object") return DEFAULT_PERSONA;

  const candidate = data as Partial<CustomInstructions>;
  return {
    id: candidate.id || "default",
    contextAboutUser:
      typeof candidate.contextAboutUser === "string"
        ? candidate.contextAboutUser
        : "",
    responsePreferences:
      typeof candidate.responsePreferences === "string"
        ? candidate.responsePreferences
        : "",
    customSystemInstructions:
      typeof candidate.customSystemInstructions === "string"
        ? candidate.customSystemInstructions
        : "",
    ttsPreferences: normalizeTtsPreferences(candidate.ttsPreferences),
  };
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

export async function PUT(request: NextRequest) {
  if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
    return unauthorized();
  }

  try {
    const body = await request.json();
    const {
      contextAboutUser,
      responsePreferences,
      customSystemInstructions,
      ttsPreferences,
    } = body;

    if (typeof contextAboutUser !== "string") {
      return NextResponse.json(
        { error: "contextAboutUser must be a string" },
        { status: 400 }
      );
    }

    if (
      responsePreferences !== undefined &&
      typeof responsePreferences !== "string"
    ) {
      return NextResponse.json(
        { error: "responsePreferences must be a string" },
        { status: 400 }
      );
    }

    if (
      customSystemInstructions !== undefined &&
      typeof customSystemInstructions !== "string"
    ) {
      return NextResponse.json(
        { error: "customSystemInstructions must be a string" },
        { status: 400 }
      );
    }

    if (
      ttsPreferences !== undefined &&
      (!ttsPreferences || typeof ttsPreferences !== "object")
    ) {
      return NextResponse.json(
        { error: "ttsPreferences must be an object" },
        { status: 400 }
      );
    }

    const current = await readPersona();
    const data: CustomInstructions = {
      ...current,
      contextAboutUser,
      responsePreferences:
        typeof responsePreferences === "string"
          ? responsePreferences
          : current.responsePreferences,
      customSystemInstructions:
        typeof customSystemInstructions === "string"
          ? customSystemInstructions
          : current.customSystemInstructions,
      ttsPreferences:
        ttsPreferences !== undefined
          ? normalizeTtsPreferences(ttsPreferences)
          : current.ttsPreferences,
    };

    await withDataFileLock(FILE_NAME, async () => {
      await writePersona(data);
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("[persona] PUT error", error);
    return NextResponse.json({ error: "Failed to save persona" }, { status: 500 });
  }
}
