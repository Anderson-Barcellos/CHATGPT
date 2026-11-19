import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  CLAUDE_EFFORTS,
  DEFAULT_CHAT_MODEL_CATALOG,
  getChatModel,
  hasOpenAIChatProfile,
  type ChatModelCatalog,
  type ChatModelInfo,
  type ChatModelRow,
} from "@/lib/models/chatModelCatalog";
import type { ReasoningEffort } from "@/types";
import { createAnthropicClient } from "./anthropicChat";
import { ALLOWED_CHAT_MODELS, createOpenAIClient, resolveRequestedModel } from "./chatRequest";
import { withDataFileLock, writeDataFile } from "./jsonFileStore";

const FILE_NAME = "chat-model-catalog.json";
const providerOptions = { timeout: 8000, maxRetries: 0 };
const EMPTY_CATALOG: ChatModelCatalog = { revision: 0, rows: [] };

export class ChatCatalogError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function readOverrides(): Promise<ChatModelCatalog> {
  try {
    return JSON.parse(await readFile(path.join(process.cwd(), "data", FILE_NAME), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return EMPTY_CATALOG;
    throw error;
  }
}

function withDefaults(overrides: ChatModelCatalog): ChatModelCatalog {
  const rows = new Map(DEFAULT_CHAT_MODEL_CATALOG.rows.map((row) => [row.model.id, row]));
  for (const row of overrides.rows) rows.set(row.model.id, row);
  return { revision: overrides.revision, rows: [...rows.values()] };
}

export async function readChatModelCatalog(): Promise<ChatModelCatalog> {
  return withDefaults(await readOverrides());
}

export async function resolveChatModelForRequest(id: string): Promise<ChatModelInfo | undefined> {
  const builtIn = ALLOWED_CHAT_MODELS.has(id) ? getChatModel(id) : undefined;
  if (builtIn) return builtIn;
  return (await readOverrides()).rows.find(({ model }) => model.id === id)?.model;
}

function assertRevision(catalog: ChatModelCatalog, revision: number) {
  if (catalog.revision !== revision) {
    throw new ChatCatalogError(409, "A lista mudou em outra aba. Confira a versão atual e tente novamente.");
  }
}

function assertNewModel(catalog: ChatModelCatalog, id: string) {
  if (catalog.rows.some(({ model }) => model.id === id)) {
    throw new ChatCatalogError(409, "Este ID já está cadastrado. Se estiver oculto, use Mostrar.");
  }
  if (resolveRequestedModel(id) !== id) {
    throw new ChatCatalogError(422, "Este ID é um alias antigo. Use o ID atual publicado pelo provedor.");
  }
}

async function lookupModel<T>(lookup: () => Promise<T>): Promise<T> {
  try {
    return await lookup();
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 404) throw new ChatCatalogError(422, "Esse ID não apareceu para a conta do provedor.");
    if (status === 401 || status === 403) {
      throw new ChatCatalogError(422, "A conta do provedor não tem acesso a esse ID ou à consulta de modelos.");
    }
    throw new ChatCatalogError(502, "O provedor não respondeu à consulta do modelo. Tente novamente.");
  }
}

async function discoverModel(
  id: string,
  name: string,
  provider: "openai" | "anthropic",
  openAIEfforts: ReasoningEffort[],
  signal?: AbortSignal,
): Promise<ChatModelInfo> {
  const base: ChatModelInfo = {
    id,
    name,
    provider,
    family: provider === "anthropic" ? "anthropic" : "gpt-6",
    description: provider === "anthropic" ? "Anthropic" : "OpenAI",
    contextWindow: 0,
    maxOutput: 4096,
    capabilities: ["chat"],
    supportsStreaming: true,
    supportsTemperature: false,
    supportsVerbosity: false,
    supportsCodeInterpreter: false,
  };

  if (provider === "anthropic") {
    const client = createAnthropicClient();
    if (!client) throw new ChatCatalogError(503, "A credencial Anthropic está indisponível no servidor.");
    const meta = await lookupModel(() => client.models.retrieve(id, {}, { ...providerOptions, signal }));
    if (meta.lifecycle === "retired") {
      throw new ChatCatalogError(422, "Esse modelo foi aposentado pela Anthropic.");
    }
    const capabilities = meta.capabilities;
    if (!capabilities) {
      const builtIn = getChatModel(id);
      if (builtIn?.provider === "anthropic") return { ...builtIn, name };
      throw new ChatCatalogError(422, "A Anthropic não retornou as capacidades deste modelo.");
    }
    const efforts = CLAUDE_EFFORTS.filter((effort) =>
      capabilities.effort?.supported && capabilities.effort[effort]?.supported
    );
    return {
      ...base,
      contextWindow: meta.max_input_tokens ?? base.contextWindow,
      maxOutput: meta.max_tokens || base.maxOutput,
      capabilities: [
        "chat", "function-calling",
        ...(efforts.length ? ["reasoning" as const] : []),
        ...(capabilities.image_input?.supported ? ["vision" as const] : []),
      ],
      supportedReasoningEfforts: efforts,
      supportsAdaptiveThinking: capabilities.thinking?.types?.adaptive?.supported === true,
      supportsWebSearch: capabilities.server_tools?.web_search?.supported === true,
    };
  }

  const client = createOpenAIClient();
  if (!client) throw new ChatCatalogError(503, "A credencial OpenAI está indisponível no servidor.");
  const meta = await lookupModel(() => client.models.retrieve(id, { ...providerOptions, signal }));
  if ("shutdown_date" in meta && typeof meta.shutdown_date === "string" &&
      Date.parse(meta.shutdown_date) <= Date.now()) {
    throw new ChatCatalogError(422, "Esse modelo foi aposentado pela OpenAI.");
  }

  const builtIn = getChatModel(id);
  if (builtIn && ALLOWED_CHAT_MODELS.has(id)) return { ...builtIn, name };
  if (hasOpenAIChatProfile(id)) {
    return { ...getChatModel("gpt-6.1-sol")!, id, name };
  }
  return {
    ...base,
    capabilities: openAIEfforts.length ? ["chat", "reasoning"] : ["chat"],
    supportedReasoningEfforts: openAIEfforts,
    supportsResponsesTools: false,
  };
}

async function saveRow(
  revision: number,
  change: (catalog: ChatModelCatalog) => ChatModelRow,
): Promise<ChatModelCatalog> {
  return withDataFileLock(FILE_NAME, async () => {
    const overrides = await readOverrides();
    const current = withDefaults(overrides);
    assertRevision(current, revision);
    const updated = change(current);
    const rows = new Map(overrides.rows.map((row) => [row.model.id, row]));
    rows.set(updated.model.id, updated);
    const next = {
      revision: revision + 1,
      rows: [...rows.values()],
    };
    await writeDataFile(FILE_NAME, next);
    return withDefaults(next);
  });
}

export async function addChatModel(
  revision: number,
  id: string,
  name: string,
  provider: "openai" | "anthropic",
  openAIEfforts: ReasoningEffort[],
  signal?: AbortSignal,
): Promise<ChatModelCatalog> {
  const current = await readChatModelCatalog();
  assertRevision(current, revision);
  assertNewModel(current, id);
  const model = await discoverModel(id, name, provider, openAIEfforts, signal);
  signal?.throwIfAborted();
  return saveRow(revision, () => ({ model, visible: true }));
}

export async function updateChatModel(
  revision: number,
  id: string,
  name: string,
  visible: boolean,
  openAIEfforts?: ReasoningEffort[],
): Promise<ChatModelCatalog> {
  return saveRow(revision, (catalog) => {
    const row = catalog.rows.find(({ model }) => model.id === id);
    if (!row) throw new ChatCatalogError(404, "Modelo não cadastrado.");
    if (!visible && !catalog.rows.some((other) => other.model.id !== id && other.visible)) {
      throw new ChatCatalogError(422, "Mantenha pelo menos um modelo visível no seletor.");
    }
    const model = { ...row.model, name };
    if (openAIEfforts) {
      if (model.provider !== "openai" || model.supportsResponsesTools !== false) {
        throw new ChatCatalogError(422, "Este modelo já tem um perfil de raciocínio.");
      }
      model.supportedReasoningEfforts = openAIEfforts;
      model.capabilities = openAIEfforts.length ? ["chat", "reasoning"] : ["chat"];
    }
    return { model, visible };
  });
}
