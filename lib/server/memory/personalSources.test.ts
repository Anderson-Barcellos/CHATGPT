import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
vi.mock("server-only", () => ({}));
let directory: string;
beforeEach(async () => {
  vi.resetModules(); directory = await mkdtemp(path.join(os.tmpdir(), "personal-migration-"));
  await mkdir(path.join(directory, "data"));
  vi.spyOn(process, "cwd").mockReturnValue(directory);
  vi.stubEnv("GAUCHO_ISOLATED_RUNTIME", "true");
});
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });
describe("personal biography migration", () => {
  it("backs up exact original bytes and preserves all existing fields once", async () => {
    const file = path.join(directory, "data/persona.json");
    const raw = '{"id":"default","contextAboutUser":"Perfil sintético","responsePreferences":"Prosa","unknown":{"keep":true}}\n';
    await writeFile(file, raw);
    const { readPersonalPersona } = await import("./personalSources");
    await readPersonalPersona(); await readPersonalPersona();
    expect(await readFile(`${file}.before-personal-synthesis`, "utf8")).toBe(raw);
    expect((await stat(`${file}.before-personal-synthesis`)).mode & 0o777).toBe(0o600);
    expect(JSON.parse(await readFile(file, "utf8"))).toMatchObject({ contextAboutUser: "Perfil sintético", importedBiography: "", unknown: { keep: true } });
  });
  it("does not repopulate an intentionally cleared imported biography", async () => {
    const file = path.join(directory, "data/persona.json");
    const raw = '{"contextAboutUser":"Novo","importedBiography":"","responsePreferences":""}';
    await writeFile(file, raw);
    const { readPersonalPersona } = await import("./personalSources"); await readPersonalPersona();
    expect(await readFile(file, "utf8")).toBe(raw);
  });
});
