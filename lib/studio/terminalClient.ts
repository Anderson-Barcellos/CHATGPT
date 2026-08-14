import { STUDIO_WORKSPACE_TOKEN_STORAGE_KEY } from "@/lib/studio/serverWorkspace";
import type {
  StudioTerminalEvent,
  StudioTerminalExitReason,
} from "@/lib/studio/workspaceServerProtocol";
import { apiUrl } from "@/lib/utils";

export const TERMINAL_INPUT_FLUSH_MS = 16;
export const TERMINAL_RESIZE_DEBOUNCE_MS = 150;

const TOKEN_HEADER = "X-Studio-Workspace-Token";

export type StudioTerminalClientStatus =
  | "idle"
  | "connecting"
  | "open"
  | "closed"
  | "error";

export interface StudioTerminalClientState {
  status: StudioTerminalClientStatus;
  exitReason: StudioTerminalExitReason | null;
  error: string | null;
}

function isTerminalEvent(value: unknown): value is StudioTerminalEvent {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { type?: unknown };
  return candidate.type === "data" || candidate.type === "exit";
}

export function createTerminalEventParser(): {
  push(chunk: string): StudioTerminalEvent[];
} {
  let buffer = "";
  return {
    push(chunk: string) {
      buffer += chunk;
      const events: StudioTerminalEvent[] = [];
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const rawFrame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        for (const line of rawFrame.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed: unknown = JSON.parse(line.slice(6));
            if (isTerminalEvent(parsed)) events.push(parsed);
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

export interface StudioTerminalClientConnectOptions {
  cols: number;
  rows: number;
  onData: (data: string) => void;
}

export interface StudioTerminalClientController {
  getState(): StudioTerminalClientState;
  subscribe(listener: () => void): () => void;
  connect(options: StudioTerminalClientConnectOptions): void;
  sendInput(data: string): void;
  sendResize(cols: number, rows: number): void;
  close(): Promise<void>;
  dispose(): void;
}

export interface StudioTerminalClientOptions {
  fetchImpl?: typeof fetch;
  tokenProvider?: () => string | null;
}

export function createTerminalClientController(
  options: StudioTerminalClientOptions = {}
): StudioTerminalClientController {
  const fetchImpl =
    options.fetchImpl ??
    ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const tokenProvider = options.tokenProvider ?? defaultTokenProvider;

  let state: StudioTerminalClientState = {
    status: "idle",
    exitReason: null,
    error: null,
  };
  let disposed = false;
  let abortController: AbortController | null = null;
  let pendingInput = "";
  let inputTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingResize: { cols: number; rows: number } | null = null;
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();

  function update(patch: Partial<StudioTerminalClientState>) {
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

  function flushInput(): void {
    if (inputTimer !== null) clearTimeout(inputTimer);
    inputTimer = null;
    const data = pendingInput;
    pendingInput = "";
    if (data.length === 0) return;
    void post("/api/studio/workspace/terminal/input", { data });
  }

  function flushResize(): void {
    if (resizeTimer !== null) clearTimeout(resizeTimer);
    resizeTimer = null;
    const geometry = pendingResize;
    pendingResize = null;
    if (!geometry) return;
    void post("/api/studio/workspace/terminal/resize", geometry);
  }

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    connect({ cols, rows, onData }) {
      if (state.status === "connecting" || state.status === "open") return;
      abortController = new AbortController();
      update({ status: "connecting", exitReason: null, error: null });

      void (async () => {
        try {
          const response = await fetchImpl(
            apiUrl(
              `/api/studio/workspace/terminal/stream?cols=${cols}&rows=${rows}`
            ),
            { headers: authHeaders(), signal: abortController?.signal }
          );
          if (!response.ok || !response.body) {
            update({
              status: "error",
              error:
                (await readErrorMessage(response)) ??
                "Não consegui abrir o terminal no servidor.",
            });
            return;
          }

          update({ status: "open" });
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          const parser = createTerminalEventParser();
          let sawExit = false;

          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            for (const event of parser.push(
              decoder.decode(value, { stream: true })
            )) {
              if (event.type === "data") {
                onData(event.data);
              } else {
                sawExit = true;
                update({ status: "closed", exitReason: event.reason });
              }
            }
          }

          if (!sawExit && state.status === "open") {
            update({
              status: "error",
              error: "A conexão com o terminal foi perdida.",
            });
          }
        } catch {
          // Abort local (close/dispose) não é falha; o estado já foi decidido.
          if (state.status === "open" || state.status === "connecting") {
            update({
              status: "error",
              error: "A conexão com o terminal foi perdida.",
            });
          }
        }
      })();
    },

    sendInput(data) {
      if (state.status !== "open") return;
      pendingInput += data;
      if (inputTimer === null) {
        inputTimer = setTimeout(flushInput, TERMINAL_INPUT_FLUSH_MS);
      }
    },

    sendResize(cols, rows) {
      if (state.status !== "open") return;
      pendingResize = { cols, rows };
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(flushResize, TERMINAL_RESIZE_DEBOUNCE_MS);
    },

    async close() {
      flushInput();
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      resizeTimer = null;
      pendingResize = null;
      update({ status: "closed", exitReason: "closed" });
      await post("/api/studio/workspace/terminal/close");
      abortController?.abort();
      abortController = null;
    },

    dispose() {
      if (inputTimer !== null) clearTimeout(inputTimer);
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      inputTimer = null;
      resizeTimer = null;
      abortController?.abort();
      abortController = null;
      listeners.clear();
      disposed = true;
    },
  };
}
