import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DEFAULT_CHAT_MODEL_CATALOG } from "@/lib/models/chatModelCatalog";

vi.mock("server-only", () => ({}));

const get = vi.fn();
vi.mock("./geminiChat", () => ({
  createGeminiClient: () => ({ models: { get } }),
}));

let root: string;
let cwd: ReturnType<typeof vi.spyOn>;
const catalogFile = () => path.join(root, "data/chat-model-catalog.json");

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "gaucho-gemini-catalog-"));
  cwd = vi.spyOn(process, "cwd").mockReturnValue(root);
  await mkdir(path.join(root, "data"));
  const rows = DEFAULT_CHAT_MODEL_CATALOG.rows.filter(({ model }) => model.provider !== "google");
  await writeFile(catalogFile(), JSON.stringify({ version: 2, revision: 3, rows }));
  get.mockReset();
  vi.resetModules();
});

afterEach(async () => {
  cwd.mockRestore();
  await rm(root, { recursive: true, force: true });
});

it("cadastra o Gemini 4 Neon depois de confirmar o ID no Google", async () => {
  get.mockResolvedValue({ name: "models/gemini-4-neon", thinking: true });
  const { addChatModel, resolveChatModelForRequest } = await import("./chatModelCatalog");
  const next = await addChatModel(3, "gemini-4-neon", "Neon", "google", []);
  expect(get).toHaveBeenCalledWith(expect.objectContaining({ model: "gemini-4-neon" }));
  const row = next.rows.at(-1)!;
  expect(row.model).toMatchObject({ id: "gemini-4-neon", name: "Neon", provider: "google", family: "gemini" });
  expect(row.model.supportedReasoningEfforts).toEqual(["low", "medium", "high"]);
  expect((await resolveChatModelForRequest("gemini-4-neon"))?.provider).toBe("google");
});

it("cadastra um Gemini de texto fora da lista embutida com low/medium/high", async () => {
  get.mockResolvedValue({ name: "models/gemini-4-argon", thinking: true });
  const { addChatModel, resolveChatModelForRequest } = await import("./chatModelCatalog");
  await addChatModel(3, "gemini-4-argon", "Argon", "google", []);
  const model = await resolveChatModelForRequest("gemini-4-argon");
  expect(model).toMatchObject({ provider: "google", family: "gemini", supportsVerbosity: false });
  expect(model?.supportedReasoningEfforts).toEqual(["low", "medium", "high"]);
});

it("ID ausente no Google devolve 422 e deixa o catálogo intacto", async () => {
  get.mockRejectedValue(Object.assign(new Error("not found"), { status: 404 }));
  const before = await readFile(catalogFile(), "utf8");
  const { addChatModel } = await import("./chatModelCatalog");
  await expect(addChatModel(3, "gemini-4-fantasma", "X", "google", [])).rejects.toMatchObject({ status: 422 });
  expect(await readFile(catalogFile(), "utf8")).toBe(before);
});

it("troca o ID de uma linha para um Gemini e mantém a posição", async () => {
  get.mockResolvedValue({ name: "models/gemini-4-hydrogen", thinking: true });
  const { readChatModelCatalog, updateChatModel } = await import("./chatModelCatalog");
  const before = await readChatModelCatalog();
  const target = before.rows[1].model;
  const next = await updateChatModel(3, target.id, "Hydrogen", true, undefined, "gemini-4-hydrogen");
  expect(next.rows[1].model).toMatchObject({ id: "gemini-4-hydrogen", provider: "google" });
});
