import type {
  StudioFile,
  StudioFileLanguage,
  StudioRunResult,
} from "@/lib/studio/types";
import type {
  StudioArchiveEntry,
  StudioWorkspaceRunEvent,
  StudioWorkspaceTreeEntry,
} from "@/lib/studio/workspaceServerProtocol";
import { apiUrl } from "@/lib/utils";

export const STUDIO_WORKSPACE_TOKEN_HEADER = "X-Studio-Workspace-Token";

const DEFAULT_AUTOSAVE_DELAY_MS = 600;

export interface StudioServerTreeRow {
  entry: StudioWorkspaceTreeEntry;
  depth: number;
}

export type StudioServerSaveState = "saved" | "dirty" | "saving" | "error";

export interface StudioServerRunSession {
  filePath: string;
  result: StudioRunResult;
}

export interface StudioServerWorkspaceState {
  enabled: boolean | null;
  unlocked: boolean;
  unlockPromptOpen: boolean;
  unlockError: string | null;
  tree: StudioServerTreeRow[];
  files: Record<string, StudioFile>;
  openFilePaths: string[];
  activeFilePath: string | null;
  saveState: StudioServerSaveState;
  running: boolean;
  runSession: StudioServerRunSession | null;
  archives: StudioArchiveEntry[];
  busy: boolean;
  errorMessage: string | null;
}

export interface StudioTokenStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StudioServerWorkspaceControllerOptions {
  fetchImpl?: typeof fetch;
  autosaveDelayMs?: number;
  tokenStorage?: StudioTokenStorage | null;
}

export const STUDIO_WORKSPACE_TOKEN_STORAGE_KEY =
  "gaucho-studio:workspace-token:v1";

// sessionStorage: o token sobrevive a reload/F5 na mesma aba, mas morre ao
// fechá-la; o TTL de 60 min e a invalidação por restart do serviço seguem
// valendo no servidor.
function defaultTokenStorage(): StudioTokenStorage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export interface StudioServerWorkspaceController {
  getState(): StudioServerWorkspaceState;
  subscribe(listener: () => void): () => void;
  refreshStatus(): Promise<void>;
  openUnlockPrompt(): void;
  cancelUnlock(): void;
  unlock(password: string): Promise<boolean>;
  loadTree(): Promise<void>;
  openFile(path: string): Promise<void>;
  createFile(path: string): Promise<boolean>;
  createFolder(path: string): Promise<boolean>;
  deleteEntry(path: string): Promise<boolean>;
  selectFile(path: string): void;
  closeFile(path: string): void;
  editActiveFile(content: string): void;
  flushAutosave(): Promise<void>;
  run(): Promise<void>;
  sendStdin(text: string): Promise<boolean>;
  stop(): Promise<void>;
  saveArchive(name: string): Promise<Blob | null>;
  loadArchives(): Promise<void>;
  restoreArchive(slug: string): Promise<boolean>;
  importArchive(file: File): Promise<boolean>;
  resetWorkspace(): Promise<boolean>;
  clearRunSession(): void;
  dispose(): void;
}

export function languageForWorkspacePath(path: string): StudioFileLanguage {
  const name = path.toLowerCase();
  if (name.endsWith(".py")) return "python";
  if (name.endsWith(".ts") || name.endsWith(".tsx")) return "typescript";
  if (name.endsWith(".js") || name.endsWith(".jsx")) return "javascript";
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".md")) return "markdown";
  return "plaintext";
}

export function buildWorkspaceTreeRows(
  entries: StudioWorkspaceTreeEntry[]
): StudioServerTreeRow[] {
  const byParent = new Map<string, StudioWorkspaceTreeEntry[]>();
  for (const entry of entries) {
    const separator = entry.path.lastIndexOf("/");
    const parent = separator === -1 ? "" : entry.path.slice(0, separator);
    const siblings = byParent.get(parent);
    if (siblings) siblings.push(entry);
    else byParent.set(parent, [entry]);
  }

  const rows: StudioServerTreeRow[] = [];
  const emit = (parent: string, depth: number) => {
    const children = [...(byParent.get(parent) ?? [])].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name, "pt-BR");
    });
    for (const entry of children) {
      rows.push({ entry, depth });
      if (entry.kind === "directory") emit(entry.path, depth + 1);
    }
  };
  emit("", 0);
  return rows;
}

export function filterVisibleTreeRows(
  rows: StudioServerTreeRow[],
  collapsedPaths: ReadonlySet<string>
): StudioServerTreeRow[] {
  if (collapsedPaths.size === 0) return rows;
  return rows.filter((row) => {
    for (const collapsed of collapsedPaths) {
      if (
        row.entry.path === collapsed ||
        !row.entry.path.startsWith(`${collapsed}/`)
      ) {
        continue;
      }
      return false;
    }
    return true;
  });
}

export function pickDefaultWorkspaceFile(
  rows: StudioServerTreeRow[]
): string | null {
  const main = rows.find(
    (row) => row.entry.path === "main.py" && row.entry.kind === "file"
  );
  if (main) return main.entry.path;
  const firstEditable = rows.find(
    (row) => row.entry.kind === "file" && row.entry.editable
  );
  return firstEditable?.entry.path ?? null;
}

function isRunEvent(value: unknown): value is StudioWorkspaceRunEvent {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { type?: unknown };
  return candidate.type === "console" || candidate.type === "status";
}

export function createRunEventParser(): {
  push(chunk: string): StudioWorkspaceRunEvent[];
} {
  let buffer = "";
  return {
    push(chunk: string) {
      buffer += chunk;
      const events: StudioWorkspaceRunEvent[] = [];
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const rawFrame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        for (const line of rawFrame.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed: unknown = JSON.parse(line.slice(6));
            if (isRunEvent(parsed)) events.push(parsed);
          } catch {
            // Frame malformado: ignora e segue o stream.
          }
        }
        boundary = buffer.indexOf("\n\n");
      }
      return events;
    },
  };
}

export function createInitialServerRunResult(): StudioRunResult {
  return { status: "completed", durationMs: 0, entries: [] };
}

export function appendRunEvent(
  result: StudioRunResult,
  event: StudioWorkspaceRunEvent,
  sequence: number
): StudioRunResult {
  if (event.type === "status") {
    return { ...result, status: event.status, durationMs: event.durationMs };
  }
  return {
    ...result,
    entries: [
      ...result.entries,
      {
        id: `studio-server-run-${sequence}`,
        level: event.level,
        text: event.text,
      },
    ],
  };
}

function createInitialState(): StudioServerWorkspaceState {
  return {
    enabled: null,
    unlocked: false,
    unlockPromptOpen: false,
    unlockError: null,
    tree: [],
    files: {},
    openFilePaths: [],
    activeFilePath: null,
    saveState: "saved",
    running: false,
    runSession: null,
    archives: [],
    busy: false,
    errorMessage: null,
  };
}

async function readErrorMessage(response: Response): Promise<string | null> {
  try {
    const payload = (await response.clone().json()) as {
      message?: unknown;
      error?: unknown;
    };
    if (typeof payload.message === "string") return payload.message;
    if (typeof payload.error === "string") return payload.error;
  } catch {
    // Corpo não-JSON: cai no fallback do chamador.
  }
  return null;
}

interface PendingReplay {
  retry: () => void;
  cancel: () => void;
}

export function createServerWorkspaceController(
  options: StudioServerWorkspaceControllerOptions = {}
): StudioServerWorkspaceController {
  const fetchImpl =
    options.fetchImpl ??
    ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const autosaveDelayMs = options.autosaveDelayMs ?? DEFAULT_AUTOSAVE_DELAY_MS;
  const tokenStorage =
    options.tokenStorage !== undefined
      ? options.tokenStorage
      : defaultTokenStorage();

  const readStoredToken = (): string | null => {
    try {
      return tokenStorage?.getItem(STUDIO_WORKSPACE_TOKEN_STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  };
  const writeStoredToken = (value: string | null): void => {
    try {
      if (value === null) {
        tokenStorage?.removeItem(STUDIO_WORKSPACE_TOKEN_STORAGE_KEY);
      } else {
        tokenStorage?.setItem(STUDIO_WORKSPACE_TOKEN_STORAGE_KEY, value);
      }
    } catch {
      // Storage indisponível: o token segue valendo só nesta instância.
    }
  };

  let state = createInitialState();
  let token: string | null = readStoredToken();
  let disposed = false;
  let pendingReplays: PendingReplay[] = [];
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingSave: { path: string; content: string } | null = null;
  const listeners = new Set<() => void>();

  function update(patch: Partial<StudioServerWorkspaceState>) {
    if (disposed) return;
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  }

  async function authorizedFetch(
    path: string,
    init: RequestInit = {}
  ): Promise<Response> {
    const headers = new Headers(init.headers);
    if (token) headers.set(STUDIO_WORKSPACE_TOKEN_HEADER, token);
    const response = await fetchImpl(apiUrl(path), { ...init, headers });
    if (response.status !== 401) return response;

    let code: string | null = null;
    try {
      code = ((await response.clone().json()) as { code?: string }).code ?? null;
    } catch {
      code = null;
    }
    if (code !== "studio_workspace_locked") return response;

    token = null;
    writeStoredToken(null);
    update({ unlocked: false, unlockPromptOpen: true });
    return new Promise<Response>((resolve, reject) => {
      pendingReplays.push({
        retry: () => {
          authorizedFetch(path, init).then(resolve, reject);
        },
        cancel: () => resolve(response),
      });
    });
  }

  async function requestJson<T>(
    path: string,
    init: RequestInit = {},
    fallbackError: string
  ): Promise<T | null> {
    try {
      const response = await authorizedFetch(path, init);
      if (!response.ok) {
        update({
          errorMessage: (await readErrorMessage(response)) ?? fallbackError,
        });
        return null;
      }
      return (await response.json()) as T;
    } catch {
      update({ errorMessage: fallbackError });
      return null;
    }
  }

  function scheduleAutosave() {
    if (autosaveTimer !== null) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      autosaveTimer = null;
      void flushAutosave();
    }, autosaveDelayMs);
  }

  async function flushAutosave(): Promise<void> {
    const save = pendingSave;
    if (!save) return;
    pendingSave = null;
    update({ saveState: "saving" });
    try {
      const response = await authorizedFetch("/api/studio/workspace/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(save),
      });
      if (!response.ok) {
        update({ saveState: "error" });
        return;
      }
      // Nova edição durante o voo mantém o estado sujo até o próximo flush.
      if (!pendingSave) update({ saveState: "saved" });
    } catch {
      update({ saveState: "error" });
    }
  }

  async function loadTree(): Promise<void> {
    const data = await requestJson<{ entries: StudioWorkspaceTreeEntry[] }>(
      "/api/studio/workspace/tree",
      {},
      "Não consegui carregar a árvore do workspace."
    );
    if (!data) return;
    update({ tree: buildWorkspaceTreeRows(data.entries), errorMessage: null });
  }

  async function run(): Promise<void> {
    const filePath = state.activeFilePath;
    if (!filePath || state.running) return;

    let sequence = 0;
    let result = createInitialServerRunResult();
    let sawStatus = false;
    const applyEvent = (event: StudioWorkspaceRunEvent) => {
      if (event.type === "status") sawStatus = true;
      result = appendRunEvent(result, event, sequence);
      sequence += 1;
      update({ runSession: { filePath, result } });
    };

    update({
      running: true,
      runSession: { filePath, result },
    });

    try {
      const response = await authorizedFetch("/api/studio/workspace/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath }),
      });
      if (!response.ok || !response.body) {
        applyEvent({
          type: "console",
          level: "error",
          text:
            (await readErrorMessage(response)) ??
            "Falha ao iniciar a execução no servidor.",
        });
        applyEvent({ type: "status", status: "failed", durationMs: 0 });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const parser = createRunEventParser();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const event of parser.push(decoder.decode(value, { stream: true }))) {
          applyEvent(event);
        }
      }
      if (!sawStatus) {
        applyEvent({
          type: "console",
          level: "error",
          text: "A conexão terminou sem status final da execução.",
        });
        applyEvent({ type: "status", status: "failed", durationMs: 0 });
      }
    } catch {
      applyEvent({
        type: "console",
        level: "error",
        text: "A conexão com a execução foi perdida.",
      });
      applyEvent({ type: "status", status: "failed", durationMs: 0 });
    } finally {
      update({ running: false });
      await loadTree();
    }
  }

  async function openFile(path: string): Promise<void> {
    if (state.files[path]) {
      update({
        activeFilePath: path,
        openFilePaths: state.openFilePaths.includes(path)
          ? state.openFilePaths
          : [...state.openFilePaths, path],
      });
      return;
    }
    const data = await requestJson<{ content: string }>(
      `/api/studio/workspace/file?path=${encodeURIComponent(path)}`,
      {},
      "Não consegui abrir o arquivo do workspace."
    );
    if (!data) return;
    const file: StudioFile = {
      path,
      name: path.split("/").at(-1) ?? path,
      language: languageForWorkspacePath(path),
      content: data.content,
    };
    update({
      files: { ...state.files, [path]: file },
      activeFilePath: path,
      openFilePaths: state.openFilePaths.includes(path)
        ? state.openFilePaths
        : [...state.openFilePaths, path],
      errorMessage: null,
    });
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async refreshStatus() {
      const data = await requestJson<{ enabled: boolean; unlocked: boolean }>(
        "/api/studio/workspace/status",
        {},
        "Não consegui consultar o status do workspace."
      );
      if (!data) return;
      update({ enabled: data.enabled, unlocked: data.unlocked });
    },

    openUnlockPrompt() {
      update({ unlockPromptOpen: true, unlockError: null });
    },

    cancelUnlock() {
      const replays = pendingReplays;
      pendingReplays = [];
      for (const replay of replays) replay.cancel();
      update({ unlockPromptOpen: false, unlockError: null });
    },

    async unlock(password) {
      update({ unlockError: null });
      try {
        const response = await fetchImpl(apiUrl("/api/studio/workspace/unlock"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        if (!response.ok) {
          update({
            unlockPromptOpen: true,
            unlockError:
              (await readErrorMessage(response)) ??
              "Senha do workspace incorreta.",
          });
          return false;
        }
        const data = (await response.json()) as { token?: unknown };
        if (typeof data.token !== "string" || !data.token) {
          update({
            unlockPromptOpen: true,
            unlockError: "Resposta de desbloqueio inválida.",
          });
          return false;
        }
        token = data.token;
        writeStoredToken(token);
        update({
          unlocked: true,
          unlockPromptOpen: false,
          unlockError: null,
        });
        const replays = pendingReplays;
        pendingReplays = [];
        for (const replay of replays) replay.retry();
        return true;
      } catch {
        update({
          unlockPromptOpen: true,
          unlockError: "Não consegui falar com o servidor para desbloquear.",
        });
        return false;
      }
    },

    loadTree,

    openFile,

    async createFile(path) {
      const data = await requestJson<{ saved: boolean }>(
        "/api/studio/workspace/file",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path, content: "" }),
        },
        "Não consegui criar o arquivo."
      );
      if (!data) return false;
      await loadTree();
      await openFile(path);
      return true;
    },

    async createFolder(path) {
      const data = await requestJson<{ created: boolean }>(
        "/api/studio/workspace/folder",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path }),
        },
        "Não consegui criar a pasta."
      );
      if (!data) return false;
      await loadTree();
      return true;
    },

    async deleteEntry(path) {
      const data = await requestJson<{ deleted: boolean }>(
        `/api/studio/workspace/file?path=${encodeURIComponent(path)}`,
        { method: "DELETE" },
        "Não consegui excluir do workspace."
      );
      if (!data) return false;

      // Fecha as abas do próprio caminho e de tudo abaixo dele (pasta).
      const affected = (candidate: string) =>
        candidate === path || candidate.startsWith(`${path}/`);
      const nextOpen = state.openFilePaths.filter(
        (candidate) => !affected(candidate)
      );
      const nextFiles = { ...state.files };
      for (const candidate of Object.keys(nextFiles)) {
        if (affected(candidate)) delete nextFiles[candidate];
      }
      update({
        openFilePaths: nextOpen,
        files: nextFiles,
        activeFilePath:
          state.activeFilePath !== null && affected(state.activeFilePath)
            ? nextOpen.at(-1) ?? null
            : state.activeFilePath,
      });
      await loadTree();
      return true;
    },

    selectFile(path) {
      if (!state.files[path]) return;
      update({ activeFilePath: path });
    },

    closeFile(path) {
      const index = state.openFilePaths.indexOf(path);
      if (index === -1) return;
      const nextOpen = state.openFilePaths.filter(
        (candidate) => candidate !== path
      );
      const nextFiles = { ...state.files };
      delete nextFiles[path];
      update({
        openFilePaths: nextOpen,
        files: nextFiles,
        activeFilePath:
          state.activeFilePath === path
            ? nextOpen[Math.max(0, index - 1)] ?? nextOpen[0] ?? null
            : state.activeFilePath,
      });
    },

    editActiveFile(content) {
      const path = state.activeFilePath;
      const file = path ? state.files[path] : undefined;
      if (!path || !file || file.content === content) return;
      pendingSave = { path, content };
      update({
        files: { ...state.files, [path]: { ...file, content } },
        saveState: "dirty",
      });
      scheduleAutosave();
    },

    flushAutosave,

    run,

    async sendStdin(text) {
      if (!state.running) return false;
      const data = await requestJson<{ sent: boolean }>(
        "/api/studio/workspace/run/stdin",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // O eco do que foi digitado volta pelo stream SSE como "command".
          body: JSON.stringify({ data: `${text}\n` }),
        },
        "Não consegui enviar a entrada para a execução."
      );
      return data?.sent === true;
    },

    async stop() {
      await requestJson<{ stopped: boolean }>(
        "/api/studio/workspace/stop",
        { method: "POST" },
        "Não consegui parar a execução."
      );
    },

    async saveArchive(name) {
      update({ busy: true });
      try {
        const response = await authorizedFetch("/api/studio/workspace/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (!response.ok) {
          update({
            errorMessage:
              (await readErrorMessage(response)) ??
              "Não consegui salvar o projeto.",
          });
          return null;
        }
        return await response.blob();
      } catch {
        update({ errorMessage: "Não consegui salvar o projeto." });
        return null;
      } finally {
        update({ busy: false });
      }
    },

    async loadArchives() {
      const data = await requestJson<{ archives: StudioArchiveEntry[] }>(
        "/api/studio/workspace/archive",
        {},
        "Não consegui listar os projetos salvos."
      );
      if (!data) return;
      update({ archives: data.archives });
    },

    async restoreArchive(slug) {
      update({ busy: true });
      try {
        const data = await requestJson<{ restored: boolean }>(
          "/api/studio/workspace/restore",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug }),
          },
          "Não consegui restaurar o projeto salvo."
        );
        if (!data) return false;
        update({ files: {}, openFilePaths: [], activeFilePath: null });
        await loadTree();
        return true;
      } finally {
        update({ busy: false });
      }
    },

    async importArchive(file) {
      update({ busy: true });
      try {
        const formData = new FormData();
        formData.append("file", file);
        const data = await requestJson<{ imported: boolean }>(
          "/api/studio/workspace/import",
          { method: "POST", body: formData },
          "Não consegui importar o zip."
        );
        if (!data) return false;
        update({ files: {}, openFilePaths: [], activeFilePath: null });
        await loadTree();
        return true;
      } finally {
        update({ busy: false });
      }
    },

    async resetWorkspace() {
      update({ busy: true });
      try {
        const data = await requestJson<{ reset: boolean }>(
          "/api/studio/workspace/reset",
          { method: "POST" },
          "Não consegui resetar o workspace."
        );
        if (!data) return false;
        update({ files: {}, openFilePaths: [], activeFilePath: null });
        await loadTree();
        return true;
      } finally {
        update({ busy: false });
      }
    },

    clearRunSession() {
      update({ runSession: null });
    },

    dispose() {
      if (autosaveTimer !== null) clearTimeout(autosaveTimer);
      autosaveTimer = null;
      const replays = pendingReplays;
      pendingReplays = [];
      for (const replay of replays) replay.cancel();
      listeners.clear();
      disposed = true;
    },
  };
}
