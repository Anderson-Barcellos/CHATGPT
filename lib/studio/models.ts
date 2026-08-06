import { MODELS } from "@/lib/models/modelConfig";

export const STUDIO_MODEL_IDS = [
  "gpt-5.6-luna",
  "gpt-5.6-terra",
  "gpt-5.6-sol",
  "gpt-5.4-mini",
] as const;

export type StudioModelId = (typeof STUDIO_MODEL_IDS)[number];

export const DEFAULT_STUDIO_MODEL_ID: StudioModelId = "gpt-5.6-luna";

export function isStudioModelId(value: unknown): value is StudioModelId {
  return (
    typeof value === "string" &&
    (STUDIO_MODEL_IDS as readonly string[]).includes(value)
  );
}

export function getStudioModels() {
  return STUDIO_MODEL_IDS.map((id) => MODELS[id]).filter(Boolean);
}
