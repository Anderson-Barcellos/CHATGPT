import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioNotebookEvent } from "@/lib/studio/workspaceServerProtocol";
import {
  DEFAULT_KERNEL_IDLE_TIMEOUT_MS,
  KERNEL_RUNTIME_MAX_SEC,
  StudioNotebookKernelManager,
  buildBridgeCommand,
  buildKernelCommand,
} from "./studioNotebookKernel";

type Listener = (...args: unknown[]) => void;

class FakeStream {
  private listeners = new Map<string, Listener[]>();

  on(event: string, listener: Listener): this {
    const list = this.listeners.get(event) ?? [];
    list.push(listener);
    this.listeners.set(event, list);
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(...args);
    }
  }
}

class FakeBridgeChild {
  stdinChunks: string[] = [];
  killed = false;
  stdin = {
    writable: true,
    write: (data: string): boolean => {
      this.stdinChunks.push(data);
      return true;
    },
  };
  stdout = new FakeStream();
  stderr = new FakeStream();
  private events = new FakeStream();

  on(event: string, listener: Listener): this {
    this.events.on(event, listener);
    return this;
  }

  kill(): void {
    this.killed = true;
  }

  emitLine(payload: unknown): void {
    this.stdout.emit("data", Buffer.from(`${JSON.stringify(payload)}\n`, "utf8"));
  }

  emitClose(code: number | null = 0): void {
    this.events.emit("close", code, null);
  }
}

interface Harness {
  manager: StudioNotebookKernelManager;
  spawnCalls: Array<{ command: string; args: string[] }>;
  bridges: FakeBridgeChild[];
}

function createHarness(options: { idleTimeoutMs?: number } = {}): Harness {
  const spawnCalls: Array<{ command: string; args: string[] }> = [];
  const bridges: FakeBridgeChild[] = [];
  const manager = new StudioNotebookKernelManager({
    idleTimeoutMs: options.idleTimeoutMs,
    spawnImpl: (command, args) => {
      spawnCalls.push({ command, args });
      if (command.endsWith("python")) {
        const bridge = new FakeBridgeChild();
        bridges.push(bridge);
        return bridge as never;
      }
      return new FakeBridgeChild() as never;
    },
  });
  return { manager, spawnCalls, bridges };
}

async function collect(
  events: AsyncGenerator<StudioNotebookEvent>,
  count: number
): Promise<StudioNotebookEvent[]> {
  const collected: StudioNotebookEvent[] = [];
  for await (const event of events) {
    collected.push(event);
    if (collected.length >= count) break;
  }
  return collected;
}

describe("buildKernelCommand", () => {
  it("monta a receita systemd-run da jail com o connection file em /workspace", () => {
    const { command, args } = buildKernelCommand({
      unitId: "gaucho-studio-kernel-abc",
      connectionFileName: ".gaucho-kernel-abc.json",
    });

    expect(command).toBe("systemd-run");
    expect(args).toContain("--uid=studio");
    expect(args).toContain("--unit=gaucho-studio-kernel-abc");
    expect(args).toContain(
      "--property=BindPaths=/root/studio-projects/active:/workspace"
    );
    expect(args).toContain("--property=MemoryMax=1G");
    expect(args).toContain("--property=NoNewPrivileges=true");
    expect(args).toContain(
      `--property=RuntimeMaxSec=${KERNEL_RUNTIME_MAX_SEC}`
    );
    expect(args).toContain("--setenv=OPENAI_API_KEY");
    expect(args).not.toContain("--pty");
    expect(args).not.toContain("--wait");
    const launcherIndex = args.indexOf("ipykernel_launcher");
    expect(launcherIndex).toBeGreaterThan(-1);
    expect(args.slice(launcherIndex)).toEqual([
      "ipykernel_launcher",
      "-f",
      "/workspace/.gaucho-kernel-abc.json",
    ]);
  });
});

describe("buildBridgeCommand", () => {
  it("chama o python do venv com o bridge e o connection file do host", () => {
    const { command, args } = buildBridgeCommand({
      connectionFileName: ".gaucho-kernel-abc.json",
    });

    expect(command).toBe("/opt/studio-venv/bin/python");
    expect(args[0]).toBe("-u");
    expect(args[1]).toMatch(/studio-kernel-bridge\.py$/);
    expect(args[2]).toBe("/root/studio-projects/active/.gaucho-kernel-abc.json");
  });
});

describe("StudioNotebookKernelManager", () => {
  it("abre stream criando kernel + bridge e reporta starting → idle", async () => {
    const { manager, spawnCalls, bridges } = createHarness();

    const result = manager.openStream();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.created).toBe(true);

    expect(spawnCalls[0]?.command).toBe("systemd-run");
    expect(spawnCalls[1]?.command).toBe("/opt/studio-venv/bin/python");

    bridges[0]?.emitLine({ event: "ready" });
    const events = await collect(result.events, 2);
    expect(events).toEqual([
      { type: "kernel_status", status: "starting" },
      { type: "kernel_status", status: "idle" },
    ]);
  });

  it("recusa segundo stream simultâneo", () => {
    const { manager } = createHarness();
    expect(manager.openStream().ok).toBe(true);
    const second = manager.openStream();
    expect(second).toEqual({ ok: false, reason: "stream_busy" });
  });

  it("reporta spawn_failed quando o spawn quebra", () => {
    const manager = new StudioNotebookKernelManager({
      spawnImpl: () => {
        throw new Error("boom");
      },
    });
    expect(manager.openStream()).toEqual({ ok: false, reason: "spawn_failed" });
  });

  it("executa célula: manda JSON pro bridge e traduz eventos até cell_done", async () => {
    const { manager, bridges } = createHarness();
    const result = manager.openStream();
    if (!result.ok) throw new Error("stream");
    const bridge = bridges[0]!;
    bridge.emitLine({ event: "ready" });

    expect(manager.execute({ cellId: "c1", code: "print('oi')" })).toBe(true);
    expect(JSON.parse(bridge.stdinChunks[0] ?? "")).toEqual({
      op: "execute",
      id: "c1",
      code: "print('oi')",
    });

    bridge.emitLine({ event: "stream", id: "c1", name: "stdout", text: "oi\n" });
    bridge.emitLine({
      event: "execute_result",
      id: "c1",
      data: { "text/plain": "42" },
      executionCount: 1,
    });
    bridge.emitLine({ event: "done", id: "c1", status: "ok", executionCount: 1 });

    const events = await collect(result.events, 6);
    expect(events).toEqual([
      { type: "kernel_status", status: "starting" },
      { type: "kernel_status", status: "idle" },
      { type: "kernel_status", status: "busy" },
      {
        type: "cell_output",
        cellId: "c1",
        output: { kind: "stream", name: "stdout", text: "oi\n" },
      },
      {
        type: "cell_output",
        cellId: "c1",
        output: {
          kind: "execute_result",
          data: { "text/plain": "42" },
          executionCount: 1,
        },
      },
      { type: "cell_done", cellId: "c1", status: "ok", executionCount: 1 },
    ]);
  });

  it("traduz erro do kernel em cell_output error + cell_done error", async () => {
    const { manager, bridges } = createHarness();
    const result = manager.openStream();
    if (!result.ok) throw new Error("stream");
    const bridge = bridges[0]!;
    bridge.emitLine({ event: "ready" });
    manager.execute({ cellId: "c9", code: "1/0" });
    bridge.emitLine({
      event: "error",
      id: "c9",
      ename: "ZeroDivisionError",
      evalue: "division by zero",
      traceback: ["tb"],
    });
    bridge.emitLine({
      event: "done",
      id: "c9",
      status: "error",
      executionCount: 2,
    });

    const events = await collect(result.events, 5);
    expect(events[3]).toEqual({
      type: "cell_output",
      cellId: "c9",
      output: {
        kind: "error",
        ename: "ZeroDivisionError",
        evalue: "division by zero",
        traceback: ["tb"],
      },
    });
    expect(events[4]).toEqual({
      type: "cell_done",
      cellId: "c9",
      status: "error",
      executionCount: 2,
    });
  });

  it("recusa execute sem kernel ativo", () => {
    const { manager } = createHarness();
    expect(manager.execute({ cellId: "c1", code: "x" })).toBe(false);
  });

  it("reanexa stream após detach com o status atual do kernel", async () => {
    const { manager, bridges } = createHarness();
    const first = manager.openStream();
    if (!first.ok) throw new Error("stream");
    bridges[0]?.emitLine({ event: "ready" });
    await collect(first.events, 2);

    manager.detachStream();
    const second = manager.openStream();
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.created).toBe(false);
    const events = await collect(second.events, 1);
    expect(events).toEqual([{ type: "kernel_status", status: "idle" }]);
  });

  it("shutdown gracioso: manda op shutdown e fecha com reason closed", async () => {
    const { manager, bridges } = createHarness();
    const result = manager.openStream();
    if (!result.ok) throw new Error("stream");
    const bridge = bridges[0]!;
    bridge.emitLine({ event: "ready" });

    expect(manager.shutdown()).toBe(true);
    expect(
      bridge.stdinChunks.some((chunk) => chunk.includes('"shutdown"'))
    ).toBe(true);

    bridge.emitLine({ event: "shutdown_ok" });
    bridge.emitClose();

    const events = await collect(result.events, 3);
    expect(events[2]).toEqual({ type: "kernel_exit", reason: "closed" });
    expect(manager.isActive()).toBe(false);

    const fresh = manager.openStream();
    expect(fresh.ok && fresh.created).toBe(true);
  });

  it("fatal do bridge derruba o kernel com reason died", async () => {
    const { manager, bridges, spawnCalls } = createHarness();
    const result = manager.openStream();
    if (!result.ok) throw new Error("stream");
    const bridge = bridges[0]!;
    bridge.emitLine({ event: "ready" });
    bridge.emitLine({ event: "fatal", message: "kernel morreu" });
    bridge.emitClose(1);

    const events = await collect(result.events, 3);
    expect(events[2]).toEqual({ type: "kernel_exit", reason: "died" });
    expect(
      spawnCalls.some(
        ({ command, args }) => command === "systemctl" && args[0] === "stop"
      )
    ).toBe(true);
  });

  it("interrupt manda SIGINT pra unit do kernel", () => {
    const { manager, spawnCalls, bridges } = createHarness();
    manager.openStream();
    bridges[0]?.emitLine({ event: "ready" });

    expect(manager.interrupt()).toBe(true);
    const killCall = spawnCalls.find(
      ({ command, args }) => command === "systemctl" && args[0] === "kill"
    );
    expect(killCall).toBeDefined();
    expect(killCall?.args).toContain("-s");
    expect(killCall?.args).toContain("SIGINT");
  });

  describe("idle-kill", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("mata o kernel após 30 min sem execução; execute rearma", () => {
      const { manager, bridges } = createHarness();
      const result = manager.openStream();
      if (!result.ok) throw new Error("stream");
      const bridge = bridges[0]!;
      bridge.emitLine({ event: "ready" });

      vi.advanceTimersByTime(DEFAULT_KERNEL_IDLE_TIMEOUT_MS - 1_000);
      manager.execute({ cellId: "c1", code: "1" });
      vi.advanceTimersByTime(DEFAULT_KERNEL_IDLE_TIMEOUT_MS - 1_000);
      expect(
        bridge.stdinChunks.some((chunk) => chunk.includes('"shutdown"'))
      ).toBe(false);

      vi.advanceTimersByTime(2_000);
      expect(
        bridge.stdinChunks.some((chunk) => chunk.includes('"shutdown"'))
      ).toBe(true);
    });
  });
});
