import { STUDIO_WORKSPACE_TOKEN_STORAGE_KEY } from "@/lib/studio/serverWorkspace";
import type {
  StudioNotebookEvent,
  StudioNotebookKernelExitReason,
  StudioNotebookKernelStatus,
} from "@/lib/studio/workspaceServerProtocol";
import { apiUrl } from "@/lib/utils";

const TOKEN_HEADER = "X-Studio-Workspace-Token";

export type StudioNotebookClientStatus =
  | "idle"
  | "connecting"
  | "open"
  | "closed"
  | "error";

export interface StudioNotebookClientState {
  status: StudioNotebookClientStatus;
  kernelStatus: StudioNotebookKernelStatus | null;
  exitReason: StudioNotebookKernelExitReason | null;
  error: string | null;
}

function isNotebookEvent(value: unknown): value is StudioNotebookEvent {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { type?: unknown };
  return (
    candidate.type === "kernel_status" ||
    candidate.type === "cell_output" ||
    candidate.type === "cell_done" ||
    candidate.type === "kernel_exit"
  );
}

export function createNotebookEventParser(): {
  push(chunk: string): StudioNotebookEvent[];
} {
  let buffer = "";
  return {
    push(chunk: string) {
      buffer += chunk;
      const events: StudioNotebookEvent[] = [];
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const rawFrame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        for (const line of rawFrame.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed: unknown = JSON.parse(line.slice(6));
            if (isNotebookEvent(parsed)) events.push(parsed);
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

function defaultTokenProvider(): string | null {
  try {
    return typeof window !== "undefined"
      ? window.sessionStorage.getItem(STUDIO_WORKSPACE_TOKEN_STORAGE_KEY)
      : null;
  } catch {
    return null;
  }
}

async function readErrorMessage(response: Response): Promise<string | null> {
  try {
    const payload = (await response.clone().json()) as { message?: unknown };
    if (typeof payload.message === "string") return payload.message;
  } catch {
    // Corpo não-JSON: cai no fallback do chamador.
  }
  return null;
}

export interface StudioNotebookClientConnectOptions {
  onEvent: (event: StudioNotebookEvent) => void;
}

export interface StudioNotebookClientController {
  getState(): StudioNotebookClientState;
  subscribe(listener: () => void): () => void;
  connect(options: StudioNotebookClientConnectOptions): void;
  execute(cellId: string, code: string): Promise<boolean>;
  interrupt(): Promise<void>;
  shutdown(): Promise<void>;
  dispose(): void;
}

export interface StudioNotebookClientOptions {
  fetchImpl?: typeof fetch;
  tokenProvider?: () => string | null;
}

export function createNotebookClientController(
  options: StudioNotebookClientOptions = {}
): StudioNotebookClientController {
  const fetchImpl =
    options.fetchImpl ??
    ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const tokenProvider = options.tokenProvider ?? defaultTokenProvider;

  let state: StudioNotebookClientState = {
    status: "idle",
    kernelStatus: null,
    exitReason: null,
    error: null,
  };
  let disposed = false;
  let abortController: AbortController | null = null;
  const listeners = new Set<() => void>();

  function update(patch: Partial<StudioNotebookClientState>) {
    if (disposed) return;
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  }

  function authHeaders(extra?: Record<string, string>): Headers {
    const headers = new Headers(extra);
    const token = tokenProvider();
    if (token) headers.set(TOKEN_HEADER, token);
    return headers;
  }

  async function post(path: string, body?: unknown): Promise<Response | null> {
    try {
      return await fetchImpl(apiUrl(path), {
        method: "POST",
        headers: authHeaders(
          body === undefined ? undefined : { "Content-Type": "application/json" }
        ),
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      return null;
    }
  }

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    connect({ onEvent }) {
      if (state.status === "connecting" || state.status === "open") return;
      abortController = new AbortController();
      update({
        status: "connecting",
        kernelStatus: null,
        exitReason: null,
        error: null,
      });

      void (async () => {
        try {
          const response = await fetchImpl(
            apiUrl("/api/studio/workspace/notebook/stream"),
            { headers: authHeaders(), signal: abortController?.signal }
          );
          if (!response.ok || !response.body) {
            update({
              status: "error",
              error:
                (await readErrorMessage(response)) ??
                "Não consegui abrir o kernel do notebook no servidor.",
            });
            return;
          }

          update({ status: "open" });
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          const parser = createNotebookEventParser();
          let sawExit = false;

          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            for (const event of parser.push(
              decoder.decode(value, { stream: true })
            )) {
              if (event.type === "kernel_status") {
                update({ kernelStatus: event.status });
              } else if (event.type === "kernel_exit") {
                sawExit = true;
                update({
                  status: "closed",
                  kernelStatus: null,
                  exitReason: event.reason,
                });
              }
              onEvent(event);
            }
          }

          if (!sawExit && state.status === "open") {
            update({
              status: "error",
              error: "A conexão com o kernel do notebook foi perdida.",
            });
          }
        } catch {
          // Abort local (dispose) não é falha; o estado já foi decidido.
          if (state.status === "open" || state.status === "connecting") {
            update({
              status: "error",
              error: "A conexão com o kernel do notebook foi perdida.",
            });
          }
        }
      })();
    },

    async execute(cellId, code) {
      const response = await post("/api/studio/workspace/notebook/execute", {
        cellId,
        code,
      });
      return response?.ok ?? false;
    },

    async interrupt() {
      await post("/api/studio/workspace/notebook/interrupt");
    },

    async shutdown() {
      await post("/api/studio/workspace/notebook/shutdown");
    },

    dispose() {
      abortController?.abort();
      abortController = null;
      listeners.clear();
      disposed = true;
    },
  };
}
