import { CustomInstructions } from "@/types";
import { DEFAULT_TTS_PREFERENCES, normalizeTtsPreferences } from "@/lib/tts/speechText";

export const DEFAULT_PERSONA: CustomInstructions = {
  id: "default",
  importedBiography: "",
  contextAboutUser: "",
  responsePreferences: "",
  customSystemInstructions: "",
  ttsPreferences: DEFAULT_TTS_PREFERENCES,
};

type PersonaUpdateResult =
  | { ok: true; data: CustomInstructions }
  | { ok: false; error: string; status?: 409 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function hydratePersona(value: unknown): CustomInstructions {
  if (!isRecord(value)) return DEFAULT_PERSONA;

  return {
    id: typeof value.id === "string" && value.id ? value.id : "default",
    importedBiography: typeof value.importedBiography === "string" ? value.importedBiography : "",
    contextAboutUser:
      typeof value.contextAboutUser === "string" ? value.contextAboutUser : "",
    responsePreferences:
      typeof value.responsePreferences === "string" ? value.responsePreferences : "",
    customSystemInstructions:
      typeof value.customSystemInstructions === "string"
        ? value.customSystemInstructions
        : "",
    chatInstructions: typeof value.chatInstructions === "string" ? value.chatInstructions : undefined,
    ttsPreferences: normalizeTtsPreferences(
      value.ttsPreferences as Partial<CustomInstructions["ttsPreferences"]>
    ),
  };
}

export function normalizePersonaUpdate(
  current: CustomInstructions,
  body: unknown
): PersonaUpdateResult {
  if (!isRecord(body)) {
    return { ok: false, error: "body must be an object" };
  }

  const {
    importedBiography,
    contextAboutUser,
    responsePreferences,
    customSystemInstructions,
    chatInstructions,
    previousChatInstructions,
    ttsPreferences,
  } = body;

  if (importedBiography !== undefined && typeof importedBiography !== "string") {
    return { ok: false, error: "importedBiography must be a string" };
  }

  if (
    contextAboutUser !== undefined &&
    typeof contextAboutUser !== "string"
  ) {
    return { ok: false, error: "contextAboutUser must be a string" };
  }

  if (
    responsePreferences !== undefined &&
    typeof responsePreferences !== "string"
  ) {
    return { ok: false, error: "responsePreferences must be a string" };
  }

  if (
    customSystemInstructions !== undefined &&
    typeof customSystemInstructions !== "string"
  ) {
    return { ok: false, error: "customSystemInstructions must be a string" };
  }

  if (chatInstructions !== undefined && typeof chatInstructions !== "string") {
    return { ok: false, error: "chatInstructions must be a string" };
  }

  if (previousChatInstructions !== undefined) {
    if (typeof chatInstructions !== "string" ||
        (previousChatInstructions !== null && typeof previousChatInstructions !== "string")) {
      return { ok: false, error: "Invalid chat instructions revision" };
    }
    if (previousChatInstructions !== (current.chatInstructions ?? null)) {
      return { ok: false, error: "As instruções foram alteradas em outra sessão.", status: 409 };
    }
  }

  if (
    ttsPreferences !== undefined &&
    !isRecord(ttsPreferences)
  ) {
    return { ok: false, error: "ttsPreferences must be an object" };
  }

  return {
    ok: true,
    data: {
      ...current,
      importedBiography: typeof importedBiography === "string" ? importedBiography : current.importedBiography,
      contextAboutUser:
        typeof contextAboutUser === "string"
          ? contextAboutUser
          : current.contextAboutUser,
      responsePreferences:
        typeof responsePreferences === "string"
          ? responsePreferences
          : current.responsePreferences,
      customSystemInstructions:
        typeof customSystemInstructions === "string"
          ? customSystemInstructions
          : current.customSystemInstructions,
      chatInstructions: typeof chatInstructions === "string" ? chatInstructions : current.chatInstructions,
      ttsPreferences:
        ttsPreferences !== undefined
          ? normalizeTtsPreferences(ttsPreferences)
          : normalizeTtsPreferences(current.ttsPreferences),
    },
  };
}
