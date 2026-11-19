import "server-only";
import { createHash } from "crypto";
import { promises as fs, constants } from "fs";
import path from "path";
import type { CustomInstructions, Memory } from "@/types";
import { DEFAULT_PERSONA, hydratePersona } from "@/lib/persona/persona";
import { readDataFile, withDataFileLock, writeDataFile } from "@/lib/server/jsonFileStore";
import { LEGACY_BIOGRAPHY } from "./legacyBiography";

export interface PersonalSource { id: string; text: string; updatedAt?: string }
export const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export async function readPersonalPersona(): Promise<CustomInstructions> {
  return withDataFileLock("persona.json", async () => {
    const raw = await readDataFile<CustomInstructions>("persona.json", DEFAULT_PERSONA);
    if (raw.importedBiography === undefined) {
      const file = path.join(process.cwd(), "data", "persona.json");
      try { await fs.copyFile(file, `${file}.before-personal-synthesis`, constants.COPYFILE_EXCL); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
      await fs.chmod(`${file}.before-personal-synthesis`, 0o600);
      raw.importedBiography = process.env.GAUCHO_ISOLATED_RUNTIME === "true" ? "" : LEGACY_BIOGRAPHY;
      await writeDataFile("persona.json", raw);
    }
    return hydratePersona(raw);
  });
}

export function collectPersonalSources(persona: CustomInstructions, memories: Memory[]): PersonalSource[] {
  return [
    { id: "profile:imported", text: persona.importedBiography || "" },
    { id: "profile:about", text: persona.contextAboutUser },
    ...memories.filter(m => m.isActive).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
      .map(m => ({ id: `memory:${m.id}`, text: m.content, updatedAt: String(m.updatedAt) })),
  ].filter(s => s.text.trim());
}

export async function readPersonalSources() {
  const [persona, memories] = await Promise.all([
    readPersonalPersona(), readDataFile<Memory[]>("memories.json", []),
  ]);
  const sources = collectPersonalSources(persona, memories);
  return { persona, sources, hash: digest(sources) };
}

export function renderSources(sources: PersonalSource[]) {
  return sources.map(s => `[${s.id}] ${s.text}`).join("\n\n");
}
