import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DEFAULT_CHAT_MODEL_CATALOG } from "@/lib/models/chatModelCatalog";
import { buildResponseCreateParams } from "./chatRequest";

vi.mock("server-only", () => ({}));
vi.mock("openai", () => ({
  default: class {
    models = { retrieve: async (id: string) => ({ id }) };
  },
}));

const terraId = "gpt-6.1-terra";
const customId = "gpt-web-search-qa";
let root: string;
let catalogPath: string;
let cwd: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  vi.stubEnv("OPENAI_API_KEY", "synthetic");
  root = await mkdtemp(path.join(os.tmpdir(), "gaucho-openai-catalog-"));
  cwd = vi.spyOn(process, "cwd").mockReturnValue(root);
  vi.resetModules();
  await mkdir(path.join(root, "data"));
  catalogPath = path.join(root, "data/chat-model-catalog.json");
});

afterEach(async () => {
  cwd.mockRestore();
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});

async function requestFor(model: string, responseMode: "default" | "quiz" = "default") {
  const { resolveChatModelForRequest } = await import("./chatModelCatalog");
  const registered = await resolveChatModelForRequest(model);
  expect(registered).toBeDefined();
  return buildResponseCreateParams({
    model, responseMode, reasoning: { effort: "low" }, codeInterpreterEnabled: true,
    input: [{ role: "user", content: "Pesquise e cite a fonte." }],
  }, registered);
}

it("habilita busca para o Terra já salvo e preserva seus esforços, nome e revisão", async () => {
  const { readChatModelCatalog } = await import("./chatModelCatalog");
  const original = {
    version: 2, revision: 3,
    rows: [{
      visible: true,
      model: {
        ...DEFAULT_CHAT_MODEL_CATALOG.rows[0].model,
        id: terraId, name: "Terra QA", provider: "openai",
        supportsResponsesTools: false, supportedReasoningEfforts: ["low", "high"],
      },
    }],
  };
  await writeFile(catalogPath, JSON.stringify(original));
  const catalog = await readChatModelCatalog();
  expect(catalog.revision).toBe(3);
  expect(catalog.rows[0].model).toMatchObject({
    name: "Terra QA", supportsWebSearch: true, supportedReasoningEfforts: ["low", "high"],
  });
  const params = await requestFor(terraId);
  expect(params.model).toBe(terraId);
  expect(params.reasoning).toEqual({ effort: "low" });
  expect(params.tools?.map(tool => tool.type)).toEqual(["web_search"]);
  expect((await requestFor(terraId, "quiz")).tools).toEqual([]);
  expect(JSON.parse(await readFile(catalogPath, "utf8"))).toEqual(original);
});

it("habilita a busca no Terra novo e configura a capacidade em outros IDs sem perfil", async () => {
  const { addChatModel, updateChatModel } = await import("./chatModelCatalog");
  const terra = await addChatModel(0, terraId, "Terra QA", "openai", ["low"]);
  expect(terra.rows.at(-1)?.model.supportsWebSearch).toBe(true);
  expect((await requestFor(terraId)).tools?.map(tool => tool.type)).toEqual(["web_search"]);

  const custom = await addChatModel(terra.revision, customId, "Novo QA", "openai", ["low"]);
  expect((await requestFor(customId)).tools).toEqual([]);

  const enabled = await updateChatModel(custom.revision, customId, "Novo QA", true, undefined, customId, undefined, {
    webSearchEnabled: true,
  });
  expect((await requestFor(customId)).tools?.map(tool => tool.type)).toEqual(["web_search"]);

  await updateChatModel(enabled.revision, customId, "Novo QA", true, undefined, customId, undefined, {
    webSearchEnabled: false,
  });
  expect((await requestFor(customId)).tools).toEqual([]);
  expect((await requestFor("gpt-6-luna")).tools?.map(tool => tool.type)).toContain("web_search_preview");
});
