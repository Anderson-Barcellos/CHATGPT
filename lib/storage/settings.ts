import { db } from "@/lib/storage/db";
import { CustomInstructions } from "@/types";

const DEFAULT_SETTINGS_ID = "default";

export async function ensureCustomInstructions(): Promise<CustomInstructions> {
  const existing = await db.settings.get(DEFAULT_SETTINGS_ID);
  if (existing) return existing;

  const created: CustomInstructions = {
    id: DEFAULT_SETTINGS_ID,
    contextAboutUser: "",
    responsePreferences: "",
  };

  await db.settings.put(created);
  return created;
}

export async function saveCustomInstructions(
  updates: Partial<CustomInstructions>
): Promise<CustomInstructions> {
  const current = await ensureCustomInstructions();
  const next = { ...current, ...updates };
  await db.settings.put(next);
  return next;
}
