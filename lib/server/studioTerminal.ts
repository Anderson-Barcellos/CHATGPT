import { randomUUID } from "node:crypto";
import { buildJailParentEnv, hasJailOpenAIKey } from "@/lib/server/studioJailEnv";
import type {
  StudioTerminalEvent,
  StudioTerminalExitReason,
} from "@/lib/studio/workspaceServerProtocol";

// 30 min sem tecla do usuário mata a sessão; o RuntimeMaxSec da unit é o
// backstop caso o processo node caia sem executar o kill.
export const DEFAULT_TERMINAL_IDLE_TIMEOUT_MS = 30 * 60_000;
export const TERMINAL_RUNTIME_MAX_SEC = 8 * 60 * 60;
export const TERMINAL_REPLAY_LIMIT_BYTES = 200 * 1024;

const TERMINAL_UNIT_PREFIX = "gaucho-studio-term-";
const TERMINAL_WORKSPACE = "/workspace";
const TERMINAL_PATH_ENV = "/opt/studio-venv/bin:/usr/local/bin:/usr/bin:/bin";

export function buildTerminalCommand({
  unitId,
  env = process.env,
}: {
  unitId: string;
  env?: NodeJS.ProcessEnv;
}): {
  command: string;
  args: string[];
} {
  return {
    command: "systemd-run",
    args: [
      "--uid=studio",
      `--unit=${unitId}`,
      "--property=BindPaths=/root/studio-projects/active:/workspace",
      `--property=WorkingDirectory=${TERMINAL_WORKSPACE}`,
      "--property=ProtectSystem=strict",
      "--property=ProtectHome=true",
      "--property=PrivateTmp=true",
      "--property=NoNewPrivileges=true",
      "--property=MemoryMax=1G",
      "--property=CPUQuota=100%",
      "--property=TasksMax=64",
      `--property=RuntimeMaxSec=${TERMINAL_RUNTIME_MAX_SEC}`,
      `--setenv=HOME=${TERMINAL_WORKSPACE}`,
      "--setenv=LANG=C.UTF-8",
      `--setenv=PATH=${TERMINAL_PATH_ENV}`,
      "--setenv=TERM=xterm-256color",
      // Sem "=valor": o systemd-run herda a chave do próprio ambiente (já
      // trocada pela de escopo restrito) e o valor nunca aparece em argv/ps.
      ...(hasJailOpenAIKey(env) ? ["--setenv=OPENAI_API_KEY"] : []),
      "--collect",
      "--pty",
      "--quiet",
      "/bin/bash",
      "--norc",
      "-i",
    ],
  };
}

export interface TerminalPtyLike {
  onData(listener: (data: string) => void): { dispose(): void };
  onExit(listener: (event: { exitCode: number }) => void): { dispose(): void };
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): void;
}

export interface TerminalSpawnOptions {
  cols: number;
  rows: number;
  unitId: string;
}

export type TerminalSpawn = (options: TerminalSpawnOptions) => TerminalPtyLike;

function defaultTerminalSpawn({
  cols,
  rows,
  unitId,
}: TerminalSpawnOptions): TerminalPtyLike {
  // Import tardio: node-pty é nativo e só pode carregar no runtime node do
  // servidor, nunca no bundle do cliente.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pty = require("node-pty") as typeof import("node-pty");
  const { command, args } = buildTerminalCommand({ unitId });
  return pty.spawn(command, args, {
    name: "xterm-256color",
    cols,
    rows,
    cwd: "/",
    env: buildJailParentEnv(process.env) as Record<string, string>,
  });
}

class AsyncEventQueue<T> {
  private readonly items: T[] = [];
  private waiter: (() => void) | null = null;
  private ended = false;

  push(item: T): void {
    if (this.ended) return;
    this.items.push(item);
    this.waiter?.();
  }

  end(): void {
    this.ended = true;
    this.waiter?.();
  }

  async *drain(): AsyncGenerator<T> {
    while (true) {
      while (this.items.length > 0) {
        yield this.items.shift() as T;
      }
      if (this.ended) return;
      await new Promise<void>((resolve) => {
        this.waiter = resolve;
      });
      this.waiter = null;
    }
  }
}

interface TerminalSession {
  unitId: string;
  pty: TerminalPtyLike;
  replayBuffer: string;
  idleTimer: ReturnType<typeof setTimeout> | null;
  pendingExitReason: StudioTerminalExitReason;
}

interface OpenStreamOptions {
  cols: number;
  rows: number;
}

type OpenStreamResult =
  | { ok: false; reason: "stream_busy" | "spawn_failed" }
  | {
      ok: true;
      created: boolean;
      unitId: string;
      events: AsyncGenerator<StudioTerminalEvent>;
    };

export class StudioTerminalManager {
  private readonly spawnImpl: TerminalSpawn;
  private readonly idleTimeoutMs: number;
  private session: TerminalSession | null = null;
  private stream: AsyncEventQueue<StudioTerminalEvent> | null = null;

  constructor({
    spawnImpl,
    idleTimeoutMs = DEFAULT_TERMINAL_IDLE_TIMEOUT_MS,
  }: { spawnImpl?: TerminalSpawn; idleTimeoutMs?: number } = {}) {
    this.spawnImpl = spawnImpl ?? defaultTerminalSpawn;
    this.idleTimeoutMs = idleTimeoutMs;
  }

  isActive(): boolean {
    return this.session !== null;
  }

  hasStream(): boolean {
    return this.stream !== null;
  }

  openStream({ cols, rows }: OpenStreamOptions): OpenStreamResult {
    if (this.stream) {
      return { ok: false, reason: "stream_busy" };
    }

    let created = false;
    if (!this.session) {
      const unitId = `${TERMINAL_UNIT_PREFIX}${randomUUID().slice(0, 8)}`;
      let pty: TerminalPtyLike;
      try {
        pty = this.spawnImpl({ cols, rows, unitId });
      } catch {
        return { ok: false, reason: "spawn_failed" };
      }

      const session: TerminalSession = {
        unitId,
        pty,
        replayBuffer: "",
        idleTimer: null,
        pendingExitReason: "exited",
      };
      this.session = session;
      created = true;

      pty.onData((data) => {
        if (this.session !== session) return;
        session.replayBuffer = (session.replayBuffer + data).slice(
          -TERMINAL_REPLAY_LIMIT_BYTES
        );
        this.stream?.push({ type: "data", data });
      });

      pty.onExit(() => {
        if (this.session !== session) return;
        this.clearIdleTimer(session);
        this.session = null;
        const stream = this.stream;
        this.stream = null;
        stream?.push({ type: "exit", reason: session.pendingExitReason });
        stream?.end();
      });

      this.armIdleTimer(session);
    } else {
      // Reanexo pós-queda do SSE: adapta o PTY ao tamanho do novo cliente.
      try {
        this.session.pty.resize(cols, rows);
      } catch {
        // PTY pode estar morrendo; o onExit encerra o stream logo em seguida.
      }
    }

    const queue = new AsyncEventQueue<StudioTerminalEvent>();
    this.stream = queue;
    const replay = this.session?.replayBuffer ?? "";
    if (!created && replay.length > 0) {
      queue.push({ type: "data", data: replay });
    }

    return {
      ok: true,
      created,
      unitId: this.session?.unitId ?? "",
      events: queue.drain(),
    };
  }

  detachStream(): void {
    const stream = this.stream;
    this.stream = null;
    stream?.end();
  }

  write(data: string): boolean {
    const session = this.session;
    if (!session) return false;
    try {
      session.pty.write(data);
    } catch {
      return false;
    }
    this.armIdleTimer(session);
    return true;
  }

  resize(cols: number, rows: number): boolean {
    const session = this.session;
    if (!session) return false;
    try {
      session.pty.resize(cols, rows);
    } catch {
      return false;
    }
    return true;
  }

  close(): boolean {
    const session = this.session;
    if (!session) return false;
    session.pendingExitReason = "closed";
    this.clearIdleTimer(session);
    try {
      session.pty.kill();
    } catch {
      // Sessão já em colapso; onExit fecha o resto.
    }
    return true;
  }

  private armIdleTimer(session: TerminalSession): void {
    this.clearIdleTimer(session);
    session.idleTimer = setTimeout(() => {
      if (this.session !== session) return;
      session.pendingExitReason = "idle";
      try {
        session.pty.kill();
      } catch {
        // Sessão já em colapso; onExit fecha o resto.
      }
    }, this.idleTimeoutMs);
    session.idleTimer.unref?.();
  }

  private clearIdleTimer(session: TerminalSession): void {
    if (session.idleTimer !== null) clearTimeout(session.idleTimer);
    session.idleTimer = null;
  }
}

export const studioTerminal = new StudioTerminalManager();
