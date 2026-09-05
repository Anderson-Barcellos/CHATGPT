import { spawn as nodeSpawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { StringDecoder } from "node:string_decoder";
import { buildJailParentEnv, hasJailOpenAIKey } from "@/lib/server/studioJailEnv";
import type {
  StudioWorkspaceRunEvent,
  StudioWorkspaceRunStatus,
} from "@/lib/studio/workspaceServerProtocol";

export const RUNNER_MAX_EVENTS = 2_000;
export const RUNNER_MAX_TOTAL_BYTES = 512 * 1024;
export const RUNNER_MAX_ENTRY_BYTES = 16 * 1024;
export const DEFAULT_RUN_TIMEOUT_MS = 120_000;
// Prompt de input() não termina em \n; sem este flush o usuário não vê a
// pergunta enquanto o processo espera stdin.
export const RUNNER_PARTIAL_FLUSH_MS = 150;

const RUNNER_PYTHON = "/opt/studio-venv/bin/python";
const RUNNER_WORKSPACE = "/workspace";
const RUNNER_UNIT_PREFIX = "gaucho-studio-run-";
const RUNNER_PATH_ENV =
  "/opt/studio-venv/bin:/usr/local/bin:/usr/bin:/bin";

interface BuildRunnerCommandOptions {
  filePath: string;
  unitId: string;
  timeoutMs: number;
  env?: NodeJS.ProcessEnv;
}

export function buildRunnerCommand({
  filePath,
  unitId,
  timeoutMs,
  env = process.env,
}: BuildRunnerCommandOptions): { command: string; args: string[] } {
  // Defesa em profundidade: a rota valida com resolveWorkspacePath antes,
  // mas o builder nunca aceita um caminho fora do workspace.
  if (
    !filePath ||
    filePath.startsWith("/") ||
    filePath.split("/").some((segment) => segment === ".." || segment === "")
  ) {
    throw new Error("Caminho de execução inválido para o runner.");
  }

  const runtimeMaxSec = Math.ceil(timeoutMs / 1000) + 30;

  return {
    command: "systemd-run",
    args: [
      "--uid=studio",
      `--unit=${unitId}`,
      "--property=BindPaths=/root/studio-projects/active:/workspace",
      `--property=WorkingDirectory=${RUNNER_WORKSPACE}`,
      "--property=ProtectSystem=strict",
      "--property=ProtectHome=true",
      "--property=PrivateTmp=true",
      "--property=NoNewPrivileges=true",
      "--property=MemoryMax=1G",
      "--property=CPUQuota=100%",
      "--property=TasksMax=64",
      `--property=RuntimeMaxSec=${runtimeMaxSec}`,
      "--setenv=PYTHONUNBUFFERED=1",
      `--setenv=HOME=${RUNNER_WORKSPACE}`,
      "--setenv=LANG=C.UTF-8",
      `--setenv=PATH=${RUNNER_PATH_ENV}`,
      // Sem "=valor": o systemd-run herda a chave do próprio ambiente (já
      // trocada pela de escopo restrito) e o valor nunca aparece em argv/ps.
      ...(hasJailOpenAIKey(env) ? ["--setenv=OPENAI_API_KEY"] : []),
      "--collect",
      "--wait",
      "--pipe",
      RUNNER_PYTHON,
      `${RUNNER_WORKSPACE}/${filePath}`,
    ],
  };
}

interface RunnerChildProcess {
  stdin?: NodeJS.WritableStream;
  stdout: NodeJS.ReadableStream;
  stderr: NodeJS.ReadableStream;
  on(event: "close", listener: (code: number | null, signal: string | null) => void): unknown;
  on(event: "error", listener: (error: Error) => void): unknown;
}

export type RunnerSpawn = (
  command: string,
  args: string[],
  options: { env?: NodeJS.ProcessEnv }
) => RunnerChildProcess;

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

interface StartRunOptions {
  filePath: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

type StartRunResult =
  | { ok: false; reason: "run_busy" }
  | { ok: true; unitId: string; events: AsyncGenerator<StudioWorkspaceRunEvent> };

export class StudioWorkspaceRunnerManager {
  private readonly spawnImpl: RunnerSpawn;
  private activeUnitId: string | null = null;
  private stdinWriter: ((data: string) => boolean) | null = null;

  constructor({ spawnImpl }: { spawnImpl?: RunnerSpawn } = {}) {
    this.spawnImpl = spawnImpl ?? (nodeSpawn as unknown as RunnerSpawn);
  }

  isBusy(): boolean {
    return this.activeUnitId !== null;
  }

  // Escreve no stdin da execução ativa (dados já com o "\n" final). O eco
  // volta pelo próprio stream de eventos como nível "command".
  writeStdin(data: string): boolean {
    return this.stdinWriter?.(data) ?? false;
  }

  async stop(): Promise<boolean> {
    if (!this.activeUnitId) return false;
    this.stopRequested = true;
    this.systemctlStop(this.activeUnitId);
    return true;
  }

  private stopRequested = false;
  private timeoutFired = false;

  private systemctlStop(unitId: string): void {
    try {
      this.spawnImpl("systemctl", ["stop", `${unitId}.service`], {});
    } catch {
      // Falha ao pedir stop: o RuntimeMaxSec da unit segue como backstop.
    }
  }

  startRun({
    filePath,
    timeoutMs = DEFAULT_RUN_TIMEOUT_MS,
    env = process.env,
  }: StartRunOptions): StartRunResult {
    if (this.activeUnitId) {
      return { ok: false, reason: "run_busy" };
    }

    const unitId = `${RUNNER_UNIT_PREFIX}${randomUUID().slice(0, 8)}`;
    const { command, args } = buildRunnerCommand({ filePath, unitId, timeoutMs, env });

    this.activeUnitId = unitId;
    this.stopRequested = false;
    this.timeoutFired = false;

    const queue = new AsyncEventQueue<StudioWorkspaceRunEvent>();
    const startedAt = Date.now();
    let eventCount = 0;
    let totalBytes = 0;
    let budgetExceeded = false;
    let settled = false;

    const pushConsole = (
      level: "log" | "error" | "command",
      line: string
    ): void => {
      if (budgetExceeded) return;

      let text = line;
      if (Buffer.byteLength(text, "utf8") > RUNNER_MAX_ENTRY_BYTES) {
        text = `${text.slice(0, RUNNER_MAX_ENTRY_BYTES)}… [linha truncada]`;
      }

      eventCount += 1;
      totalBytes += Buffer.byteLength(text, "utf8");
      if (eventCount > RUNNER_MAX_EVENTS || totalBytes > RUNNER_MAX_TOTAL_BYTES) {
        budgetExceeded = true;
        queue.push({
          type: "console",
          level: "error",
          text: "Limite de saída do runner excedido; execução interrompida.",
        });
        this.systemctlStop(unitId);
        return;
      }

      queue.push({ type: "console", level, text });
    };

    const finish = (code: number | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      this.activeUnitId = null;
      this.stdinWriter = null;

      let status: StudioWorkspaceRunStatus;
      if (budgetExceeded) status = "failed";
      else if (this.stopRequested) status = "aborted";
      else if (this.timeoutFired) status = "timeout";
      else if (code === 0) status = "completed";
      else status = "failed";

      queue.push({
        type: "status",
        status,
        durationMs: Math.max(1, Date.now() - startedAt),
      });
      queue.end();
    };

    const timeout = setTimeout(() => {
      this.timeoutFired = true;
      this.systemctlStop(unitId);
    }, timeoutMs);

    let child: RunnerChildProcess;
    try {
      child = this.spawnImpl(command, args, { env: buildJailParentEnv(env) });
    } catch {
      clearTimeout(timeout);
      this.activeUnitId = null;
      queue.push({
        type: "console",
        level: "error",
        text: "Falha ao iniciar o runner no servidor.",
      });
      queue.push({ type: "status", status: "failed", durationMs: 1 });
      queue.end();
      return { ok: true, unitId, events: queue.drain() };
    }

    const attachLineReader = (
      stream: NodeJS.ReadableStream,
      level: "log" | "error"
    ): (() => void) => {
      const decoder = new StringDecoder("utf8");
      let pending = "";
      let idleFlush: ReturnType<typeof setTimeout> | null = null;

      const cancelIdleFlush = () => {
        if (idleFlush !== null) clearTimeout(idleFlush);
        idleFlush = null;
      };

      stream.on("data", (chunk: Buffer) => {
        cancelIdleFlush();
        pending += decoder.write(chunk);
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        for (const line of lines) {
          pushConsole(level, line);
        }
        if (pending.length > 0) {
          idleFlush = setTimeout(() => {
            idleFlush = null;
            if (pending.length === 0) return;
            pushConsole(level, pending);
            pending = "";
          }, RUNNER_PARTIAL_FLUSH_MS);
        }
      });

      return () => {
        cancelIdleFlush();
        pending += decoder.end();
        if (pending.length > 0) pushConsole(level, pending);
        pending = "";
      };
    };

    const flushStdout = attachLineReader(child.stdout, "log");
    const flushStderr = attachLineReader(child.stderr, "error");

    this.stdinWriter = (data: string): boolean => {
      const stdin = child.stdin;
      if (settled || !stdin || !stdin.writable) return false;
      try {
        stdin.write(data);
      } catch {
        return false;
      }
      pushConsole("command", data.endsWith("\n") ? data.slice(0, -1) : data);
      return true;
    };

    child.on("error", () => {
      pushConsole("error", "Falha no processo do runner.");
      finish(null);
    });

    child.on("close", (code: number | null) => {
      flushStdout();
      flushStderr();
      finish(code);
    });

    return { ok: true, unitId, events: queue.drain() };
  }
}

export const studioWorkspaceRunner = new StudioWorkspaceRunnerManager();

export function getConfiguredRunTimeoutMs(): number {
  const parsed = parseInt(
    process.env.STUDIO_RUN_TIMEOUT_MS || `${DEFAULT_RUN_TIMEOUT_MS}`,
    10
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RUN_TIMEOUT_MS;
}
