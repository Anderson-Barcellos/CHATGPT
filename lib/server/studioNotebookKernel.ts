import { spawn as nodeSpawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { StringDecoder } from "node:string_decoder";
import type {
  StudioNotebookEvent,
  StudioNotebookKernelExitReason,
  StudioNotebookKernelStatus,
} from "@/lib/studio/workspaceServerProtocol";

// 30 min sem execução mata o kernel; o RuntimeMaxSec da unit é o backstop
// caso o processo node caia sem executar o kill (mesmo padrão do terminal).
export const DEFAULT_KERNEL_IDLE_TIMEOUT_MS = 30 * 60_000;
export const KERNEL_RUNTIME_MAX_SEC = 8 * 60 * 60;
// Se o shutdown gracioso via protocolo não fechar o bridge neste prazo,
// derruba unit e bridge na força.
export const KERNEL_SHUTDOWN_GRACE_MS = 5_000;

const KERNEL_UNIT_PREFIX = "gaucho-studio-kernel-";
const KERNEL_WORKSPACE = "/workspace";
const KERNEL_HOST_WORKSPACE = "/root/studio-projects/active";
const KERNEL_PATH_ENV = "/opt/studio-venv/bin:/usr/local/bin:/usr/bin:/bin";
const KERNEL_PYTHON = "/opt/studio-venv/bin/python";

export function buildKernelCommand({
  unitId,
  connectionFileName,
}: {
  unitId: string;
  connectionFileName: string;
}): { command: string; args: string[] } {
  return {
    command: "systemd-run",
    args: [
      "--uid=studio",
      `--unit=${unitId}`,
      `--property=BindPaths=${KERNEL_HOST_WORKSPACE}:${KERNEL_WORKSPACE}`,
      `--property=WorkingDirectory=${KERNEL_WORKSPACE}`,
      "--property=ProtectSystem=strict",
      "--property=ProtectHome=true",
      "--property=PrivateTmp=true",
      "--property=NoNewPrivileges=true",
      "--property=MemoryMax=2G",
      "--property=CPUQuota=100%",
      "--property=TasksMax=64",
      `--property=RuntimeMaxSec=${KERNEL_RUNTIME_MAX_SEC}`,
      "--setenv=PYTHONUNBUFFERED=1",
      `--setenv=HOME=${KERNEL_WORKSPACE}`,
      "--setenv=LANG=C.UTF-8",
      `--setenv=PATH=${KERNEL_PATH_ENV}`,
      // Sem "=valor": o systemd-run herda a chave do próprio ambiente e o
      // valor nunca aparece em argv/ps (mesma paridade do runner/terminal).
      "--setenv=OPENAI_API_KEY",
      "--collect",
      "--quiet",
      KERNEL_PYTHON,
      "-m",
      "ipykernel_launcher",
      "-f",
      `${KERNEL_WORKSPACE}/${connectionFileName}`,
    ],
  };
}

export function buildBridgeCommand({
  connectionFileName,
}: {
  connectionFileName: string;
}): { command: string; args: string[] } {
  return {
    command: KERNEL_PYTHON,
    args: [
      "-u",
      path.join(process.cwd(), "lib/server/studio-kernel-bridge.py"),
      path.join(KERNEL_HOST_WORKSPACE, connectionFileName),
    ],
  };
}

interface KernelChildProcess {
  stdin?: { writable: boolean; write(data: string): boolean };
  stdout?: NodeJS.ReadableStream;
  on?(event: "close", listener: (code: number | null) => void): unknown;
  kill?(signal?: string): void;
}

export type KernelSpawn = (
  command: string,
  args: string[],
  options: { env?: NodeJS.ProcessEnv }
) => KernelChildProcess;

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

interface KernelSession {
  unitId: string;
  connectionFileName: string;
  bridge: KernelChildProcess;
  status: StudioNotebookKernelStatus;
  pendingExecutions: number;
  idleTimer: ReturnType<typeof setTimeout> | null;
  graceTimer: ReturnType<typeof setTimeout> | null;
  pendingExitReason: StudioNotebookKernelExitReason;
}

type OpenStreamResult =
  | { ok: false; reason: "stream_busy" | "spawn_failed" }
  | {
      ok: true;
      created: boolean;
      unitId: string;
      events: AsyncGenerator<StudioNotebookEvent>;
    };

interface BridgeLine {
  event?: string;
  id?: string;
  name?: string;
  text?: string;
  data?: Record<string, string>;
  executionCount?: number | null;
  status?: string;
  ename?: string;
  evalue?: string;
  traceback?: string[];
  prompt?: string;
  password?: boolean;
}

export class StudioNotebookKernelManager {
  private readonly spawnImpl: KernelSpawn;
  private readonly idleTimeoutMs: number;
  private session: KernelSession | null = null;
  private stream: AsyncEventQueue<StudioNotebookEvent> | null = null;

  constructor({
    spawnImpl,
    idleTimeoutMs = DEFAULT_KERNEL_IDLE_TIMEOUT_MS,
  }: { spawnImpl?: KernelSpawn; idleTimeoutMs?: number } = {}) {
    this.spawnImpl = spawnImpl ?? (nodeSpawn as unknown as KernelSpawn);
    this.idleTimeoutMs = idleTimeoutMs;
  }

  isActive(): boolean {
    return this.session !== null;
  }

  hasStream(): boolean {
    return this.stream !== null;
  }

  openStream(): OpenStreamResult {
    if (this.stream) {
      return { ok: false, reason: "stream_busy" };
    }

    let created = false;
    if (!this.session) {
      const suffix = randomUUID().slice(0, 8);
      const unitId = `${KERNEL_UNIT_PREFIX}${suffix}`;
      const connectionFileName = `.gaucho-kernel-${suffix}.json`;

      // Se o node morreu com kernel aberto, o connection file antigo fica
      // órfão no workspace; varre antes de criar o novo (poupando o atual).
      void readdir(KERNEL_HOST_WORKSPACE)
        .then((entries) =>
          Promise.all(
            entries
              .filter(
                (entry) =>
                  entry.startsWith(".gaucho-kernel-") &&
                  entry.endsWith(".json") &&
                  entry !== connectionFileName
              )
              .map((entry) =>
                rm(path.join(KERNEL_HOST_WORKSPACE, entry), { force: true })
              )
          )
        )
        .catch(() => undefined);

      let bridge: KernelChildProcess;
      try {
        const kernel = buildKernelCommand({ unitId, connectionFileName });
        this.spawnImpl(kernel.command, kernel.args, { env: { ...process.env } });
        const bridgeCommand = buildBridgeCommand({ connectionFileName });
        bridge = this.spawnImpl(bridgeCommand.command, bridgeCommand.args, {
          env: { ...process.env },
        });
      } catch {
        return { ok: false, reason: "spawn_failed" };
      }

      const session: KernelSession = {
        unitId,
        connectionFileName,
        bridge,
        status: "starting",
        pendingExecutions: 0,
        idleTimer: null,
        graceTimer: null,
        pendingExitReason: "died",
      };
      this.session = session;
      created = true;

      this.attachBridge(session);
      this.armIdleTimer(session);
    }

    const queue = new AsyncEventQueue<StudioNotebookEvent>();
    this.stream = queue;
    queue.push({ type: "kernel_status", status: this.session.status });

    return {
      ok: true,
      created,
      unitId: this.session.unitId,
      events: queue.drain(),
    };
  }

  detachStream(): void {
    const stream = this.stream;
    this.stream = null;
    stream?.end();
  }

  execute({ cellId, code }: { cellId: string; code: string }): boolean {
    const session = this.session;
    if (!session) return false;
    if (!this.writeToBridge(session, { op: "execute", id: cellId, code })) {
      return false;
    }
    session.pendingExecutions += 1;
    this.setStatus(session, "busy");
    this.armIdleTimer(session);
    return true;
  }

  inputReply(value: string): boolean {
    const session = this.session;
    if (!session) return false;
    if (!this.writeToBridge(session, { op: "input_reply", value })) {
      return false;
    }
    this.armIdleTimer(session);
    return true;
  }

  interrupt(): boolean {
    const session = this.session;
    if (!session) return false;
    try {
      this.spawnImpl(
        "systemctl",
        ["kill", "-s", "SIGINT", `${session.unitId}.service`],
        {}
      );
    } catch {
      return false;
    }
    return true;
  }

  shutdown(reason: StudioNotebookKernelExitReason = "closed"): boolean {
    const session = this.session;
    if (!session) return false;
    session.pendingExitReason = reason;
    this.clearIdleTimer(session);

    const graceful = this.writeToBridge(session, { op: "shutdown" });
    if (session.graceTimer === null) {
      session.graceTimer = setTimeout(() => {
        session.graceTimer = null;
        this.forceStop(session);
      }, KERNEL_SHUTDOWN_GRACE_MS);
      session.graceTimer.unref?.();
    }
    if (!graceful) this.forceStop(session);
    return true;
  }

  private writeToBridge(session: KernelSession, payload: object): boolean {
    const stdin = session.bridge.stdin;
    if (!stdin || !stdin.writable) return false;
    try {
      stdin.write(`${JSON.stringify(payload)}\n`);
    } catch {
      return false;
    }
    return true;
  }

  private forceStop(session: KernelSession): void {
    try {
      this.spawnImpl("systemctl", ["stop", `${session.unitId}.service`], {});
    } catch {
      // RuntimeMaxSec da unit segue como backstop.
    }
    try {
      session.bridge.kill?.();
    } catch {
      // Bridge já em colapso; o close encerra o resto.
    }
  }

  private setStatus(
    session: KernelSession,
    status: StudioNotebookKernelStatus
  ): void {
    if (session.status === status) return;
    session.status = status;
    this.stream?.push({ type: "kernel_status", status });
  }

  private attachBridge(session: KernelSession): void {
    const decoder = new StringDecoder("utf8");
    let pending = "";

    session.bridge.stdout?.on("data", (chunk: Buffer) => {
      if (this.session !== session) return;
      pending += decoder.write(chunk);
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim().length > 0) this.handleBridgeLine(session, line);
      }
    });

    session.bridge.on?.("close", () => {
      if (this.session !== session) return;
      this.clearIdleTimer(session);
      if (session.graceTimer !== null) clearTimeout(session.graceTimer);
      session.graceTimer = null;
      this.session = null;
      void rm(path.join(KERNEL_HOST_WORKSPACE, session.connectionFileName), {
        force: true,
      }).catch(() => undefined);
      const stream = this.stream;
      this.stream = null;
      stream?.push({ type: "kernel_exit", reason: session.pendingExitReason });
      stream?.end();
    });
  }

  private handleBridgeLine(session: KernelSession, line: string): void {
    let parsed: BridgeLine;
    try {
      parsed = JSON.parse(line) as BridgeLine;
    } catch {
      return;
    }

    switch (parsed.event) {
      case "ready":
        this.setStatus(session, "idle");
        break;
      case "started":
        this.stream?.push({ type: "cell_started", cellId: parsed.id ?? "" });
        break;
      case "input_request":
        this.stream?.push({
          type: "input_request",
          cellId: parsed.id ?? "",
          prompt: parsed.prompt ?? "",
          password: parsed.password === true,
        });
        break;
      case "stream":
        this.stream?.push({
          type: "cell_output",
          cellId: parsed.id ?? "",
          output: {
            kind: "stream",
            name: parsed.name === "stderr" ? "stderr" : "stdout",
            text: parsed.text ?? "",
          },
        });
        break;
      case "execute_result":
        this.stream?.push({
          type: "cell_output",
          cellId: parsed.id ?? "",
          output: {
            kind: "execute_result",
            data: parsed.data ?? {},
            executionCount: parsed.executionCount ?? null,
          },
        });
        break;
      case "display_data":
        this.stream?.push({
          type: "cell_output",
          cellId: parsed.id ?? "",
          output: { kind: "display_data", data: parsed.data ?? {} },
        });
        break;
      case "error":
        this.stream?.push({
          type: "cell_output",
          cellId: parsed.id ?? "",
          output: {
            kind: "error",
            ename: parsed.ename ?? "",
            evalue: parsed.evalue ?? "",
            traceback: parsed.traceback ?? [],
          },
        });
        break;
      case "done":
        session.pendingExecutions = Math.max(0, session.pendingExecutions - 1);
        this.stream?.push({
          type: "cell_done",
          cellId: parsed.id ?? "",
          status: parsed.status === "error" ? "error" : "ok",
          executionCount: parsed.executionCount ?? null,
        });
        if (session.pendingExecutions === 0) this.setStatus(session, "idle");
        break;
      case "fatal":
        session.pendingExitReason = "died";
        this.forceStop(session);
        break;
      case "shutdown_ok":
        // O close do bridge fecha a sessão logo em seguida.
        break;
      default:
        break;
    }
  }

  private armIdleTimer(session: KernelSession): void {
    this.clearIdleTimer(session);
    session.idleTimer = setTimeout(() => {
      if (this.session !== session) return;
      this.shutdown("idle");
    }, this.idleTimeoutMs);
    session.idleTimer.unref?.();
  }

  private clearIdleTimer(session: KernelSession): void {
    if (session.idleTimer !== null) clearTimeout(session.idleTimer);
    session.idleTimer = null;
  }
}

export const studioNotebookKernel = new StudioNotebookKernelManager();
