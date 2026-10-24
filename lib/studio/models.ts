import { MODELS } from "@/lib/models/modelConfig";

export const STUDIO_MODEL_IDS = [
  "gpt-6-astra",
  "gpt-6.1-sol",
  "gpt-6-luna",
  "gpt-5.6-sol",
] as const;

export type StudioModelId = (typeof STUDIO_MODEL_IDS)[number];

export const DEFAULT_STUDIO_MODEL_ID: StudioModelId = "gpt-6-luna";

export function isStudioModelId(value: unknown): value is StudioModelId {
  return (
    typeof value === "string" &&
    (STUDIO_MODEL_IDS as readonly string[]).includes(value)
  );
}

export function resolveStudioModelId(value: unknown): StudioModelId {
  if (value === "gpt-6-sol" || value === "gpt-5.6-terra") return "gpt-6.1-sol";
  if (value === "gpt-5.6-luna" || value === "gpt-5.4-mini" || value === "grok-4.7") return "gpt-6-luna";
  return isStudioModelId(value) ? value : DEFAULT_STUDIO_MODEL_ID;
}

export function getStudioModels() {
  return STUDIO_MODEL_IDS.map((id) => MODELS[id]).filter(Boolean);
}
