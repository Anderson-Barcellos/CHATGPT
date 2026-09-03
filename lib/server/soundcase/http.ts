import { jsonError } from "@/lib/api/errors";
import type {
  CreateSoundCaseProjectInput,
  SoundCaseGenerationSettings,
  SoundCasePublicVersion,
  SoundCaseVersion,
  UpdateSoundCaseProjectInput,
} from "@/lib/soundcase/types";
import { isTtsVoice } from "@/lib/tts/speechText";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function isSoundCaseId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function onlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

export function parseSoundCaseProjectCreate(value: unknown): CreateSoundCaseProjectInput | null {
  if (!isRecord(value) || !onlyKeys(value, ["title", "text"])) return null;
  if (value.title !== undefined && typeof value.title !== "string") return null;
  if (value.text !== undefined && typeof value.text !== "string") return null;
  return {
    ...(typeof value.title === "string" ? { title: value.title } : {}),
    ...(typeof value.text === "string" ? { text: value.text } : {}),
  };
}

export function parseSoundCaseProjectUpdate(value: unknown): UpdateSoundCaseProjectInput | null {
  if (!isRecord(value) || !onlyKeys(value, ["title", "text", "revision"])) return null;
  if (typeof value.text !== "string" || !Number.isInteger(value.revision) || Number(value.revision) < 0) return null;
  if (value.title !== undefined && typeof value.title !== "string") return null;
  return {
    text: value.text,
    revision: Number(value.revision),
    ...(typeof value.title === "string" ? { title: value.title } : {}),
  };
}

export function parseSoundCaseSettings(value: unknown): SoundCaseGenerationSettings | null {
  if (!isRecord(value) || !onlyKeys(value, [
    "automatic", "playbackMode", "format", "voiceOverride", "speedOverride", "instructionsOverride",
  ])) return null;
  const speed = value.speedOverride;
  const instructions = value.instructionsOverride;
  if (
    typeof value.automatic !== "boolean" ||
    (value.playbackMode !== "realtime" && value.playbackMode !== "silent") ||
    (value.format !== "mp3" && value.format !== "flac" && value.format !== "wav") ||
    !(value.voiceOverride === null || isTtsVoice(value.voiceOverride)) ||
    !(speed === null || (typeof speed === "number" && Number.isFinite(speed) && speed >= 0.25 && speed <= 4)) ||
    !(instructions === null || (typeof instructions === "string" && instructions.length <= 1_200))
  ) return null;
  return {
    automatic: value.automatic,
    playbackMode: value.playbackMode,
    format: value.format,
    voiceOverride: value.voiceOverride,
    speedOverride: speed,
    instructionsOverride: instructions,
  };
}

export function toPublicSoundCaseVersion(version: SoundCaseVersion): SoundCasePublicVersion {
  const { segments: _segments, manifest: _manifest, ...publicVersion } = version;
  return publicVersion;
}

export function soundCaseErrorResponse(error: unknown): Response {
  if (
    error && typeof error === "object" &&
    "status" in error && "code" in error &&
    typeof (error as { status?: unknown }).status === "number" &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    const known = error as { status: number; code: string };
    return jsonError(known.status, "SoundCase request failed", {
      message: "Não foi possível concluir esta ação no SoundCase.",
      code: known.code,
    });
  }
  const diagnosticId = crypto.randomUUID();
  console.error("[soundcase] request failed", { diagnosticId });
  return Response.json({
    error: "SoundCase request failed",
    message: "Não foi possível concluir esta ação agora.",
    code: "soundcase_internal_error",
    diagnosticId,
  }, { status: 500 });
}

export function invalidSoundCaseIdResponse(): Response {
  return jsonError(400, "Invalid SoundCase id", {
    message: "O identificador do SoundCase é inválido.",
    code: "soundcase_id_invalid",
  });
}

export function invalidSoundCasePayloadResponse(reason = "payload"): Response {
  return jsonError(400, "Invalid SoundCase payload", {
    message: "Os dados enviados ao SoundCase são inválidos.",
    code: `soundcase_${reason}_invalid`,
  });
}
