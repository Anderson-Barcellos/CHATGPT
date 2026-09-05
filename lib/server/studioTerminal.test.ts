import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_TERMINAL_IDLE_TIMEOUT_MS,
  StudioTerminalManager,
  TERMINAL_REPLAY_LIMIT_BYTES,
  buildTerminalCommand,
} from "@/lib/server/studioTerminal";
import type { StudioTerminalEvent } from "@/lib/studio/workspaceServerProtocol";

class FakePty {
  killed: string[] = [];
  written: string[] = [];
  resizes: Array<{ cols: number; rows: number }> = [];
  private dataListeners: Array<(data: string) => void> = [];
  private exitListeners: Array<(event: { exitCode: number }) => void> = [];

  onData(listener: (data: string) => void) {
    this.dataListeners.push(listener);
    return { dispose: () => {} };
  }

  onExit(listener: (event: { exitCode: number }) => void) {
    this.exitListeners.push(listener);
    return { dispose: () => {} };
  }

  write(data: string) {
    this.written.push(data);
  }

  resize(cols: number, rows: number) {
    this.resizes.push({ cols, rows });
  }

  kill(signal?: string) {
    this.killed.push(signal ?? "SIGTERM");
  }

  emitData(data: string) {
    for (const listener of this.dataListeners) listener(data);
  }

  emitExit(exitCode = 0) {
    for (const listener of this.exitListeners) listener({ exitCode });
  }
}

function createSpawnFake() {
  const ptys: FakePty[] = [];
  const spawnCalls: Array<{ cols: number; rows: number; unitId: string }> = [];
  const spawnImpl = (opts: { cols: number; rows: number; unitId: string }) => {
    const fake = new FakePty();
    ptys.push(fake);
    spawnCalls.push(opts);
    return fake;
  };
  return { ptys, spawnCalls, spawnImpl };
}

async function collectEvents(
  events: AsyncGenerator<StudioTerminalEvent>
): Promise<StudioTerminalEvent[]> {
  const collected: StudioTerminalEvent[] = [];
  for await (const event of events) collected.push(event);
  return collected;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("buildTerminalCommand", () => {
  it("builds the spike-proven systemd-run --pty recipe", () => {
    const { command, args } = buildTerminalCommand({
      unitId: "gaucho-studio-term-teste",
    });

    expect(command).toBe("systemd-run");
    expect(args).toContain("--uid=studio");
    expect(args).toContain("--unit=gaucho-studio-term-teste");
    expect(args).toContain(
      "--property=BindPaths=/root/studio-projects/active:/workspace"
    );
    expect(args).toContain("--property=WorkingDirectory=/workspace");
    expect(args).toContain("--property=ProtectSystem=strict");
    expect(args).toContain("--property=ProtectHome=true");
    expect(args).toContain("--property=PrivateTmp=true");
    expect(args).toContain("--property=NoNewPrivileges=true");
    expect(args).toContain("--property=MemoryMax=1G");
    expect(args).toContain("--pty");
    expect(args).toContain("--collect");
    expect(args).not.toContain("--pipe");
    expect(args).not.toContain("--wait");
    expect(args.slice(-3)).toEqual(["/bin/bash", "--norc", "-i"]);
  });

  it("keeps a RuntimeMaxSec backstop above the idle timeout", () => {
    const { args } = buildTerminalCommand({ unitId: "u" });
    const runtimeArg = args.find((arg) =>
      arg.startsWith("--property=RuntimeMaxSec=")
    );
    expect(runtimeArg).toBeDefined();
    const seconds = parseInt(runtimeArg!.split("=")[2], 10);
    expect(seconds * 1000).toBeGreaterThan(DEFAULT_TERMINAL_IDLE_TIMEOUT_MS);
  });

  it("forwards only the scoped Studio key without exposing its value in argv", () => {
    const { args } = buildTerminalCommand({ unitId: "u", env: { NODE_ENV: "test", STUDIO_OPENAI_API_KEY: "sk-jail" } });
    expect(args).toContain("--setenv=OPENAI_API_KEY");
    expect(args.some((arg) => arg.startsWith("--setenv=OPENAI_API_KEY="))).toBe(
      false
    );
  });

  it("does not forward any key when STUDIO_OPENAI_API_KEY is unset", () => {
    const { args } = buildTerminalCommand({ unitId: "u", env: { NODE_ENV: "test", OPENAI_API_KEY: "sk-principal" } });
    expect(args).not.toContain("--setenv=OPENAI_API_KEY");
  });
});

describe("StudioTerminalManager", () => {
  it("opens a session and streams pty output as data events", async () => {
    const { ptys, spawnCalls, spawnImpl } = createSpawnFake();
    const manager = new StudioTerminalManager({ spawnImpl });

    const opened = manager.openStream({ cols: 80, rows: 24 });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.created).toBe(true);
    expect(spawnCalls[0]).toMatchObject({ cols: 80, rows: 24 });
    expect(spawnCalls[0].unitId).toMatch(/^gaucho-studio-term-/);

    const pending = collectEvents(opened.events);
    ptys[0].emitData("bash-5.2$ ");
    ptys[0].emitExit(0);

    const events = await pending;
    expect(events[0]).toEqual({ type: "data", data: "bash-5.2$ " });
    expect(events[events.length - 1]).toEqual({
      type: "exit",
      reason: "exited",
    });
    expect(manager.isActive()).toBe(false);
  });

  it("forwards input and resize to the pty", () => {
    const { ptys, spawnImpl } = createSpawnFake();
    const manager = new StudioTerminalManager({ spawnImpl });

    const opened = manager.openStream({ cols: 80, rows: 24 });
    if (!opened.ok) return;

    expect(manager.write("ls\r")).toBe(true);
    expect(manager.resize(132, 40)).toBe(true);
    expect(ptys[0].written).toEqual(["ls\r"]);
    expect(ptys[0].resizes).toEqual([{ cols: 132, rows: 40 }]);
  });

  it("refuses input and resize without an active session", () => {
    const { spawnImpl } = createSpawnFake();
    const manager = new StudioTerminalManager({ spawnImpl });

    expect(manager.write("eco")).toBe(false);
    expect(manager.resize(80, 24)).toBe(false);
  });

  it("rejects a second stream while one is attached", () => {
    const { spawnImpl } = createSpawnFake();
    const manager = new StudioTerminalManager({ spawnImpl });

    const first = manager.openStream({ cols: 80, rows: 24 });
    expect(first.ok).toBe(true);
    const second = manager.openStream({ cols: 80, rows: 24 });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe("stream_busy");
  });

  it("keeps the session alive on detach and replays the buffer on reattach", async () => {
    const { ptys, spawnCalls, spawnImpl } = createSpawnFake();
    const manager = new StudioTerminalManager({ spawnImpl });

    const first = manager.openStream({ cols: 80, rows: 24 });
    if (!first.ok) return;
    ptys[0].emitData("saida antes da queda\r\n");
    manager.detachStream();
    expect(manager.isActive()).toBe(true);

    const second = manager.openStream({ cols: 100, rows: 30 });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.created).toBe(false);
    expect(spawnCalls).toHaveLength(1);
    // Reanexo adapta o PTY ao tamanho do novo cliente.
    expect(ptys[0].resizes).toContainEqual({ cols: 100, rows: 30 });

    const pending = collectEvents(second.events);
    ptys[0].emitExit(0);
    const events = await pending;
    expect(events[0]).toEqual({
      type: "data",
      data: "saida antes da queda\r\n",
    });
  });

  it("caps the replay buffer, keeping only the newest bytes", async () => {
    const { ptys, spawnImpl } = createSpawnFake();
    const manager = new StudioTerminalManager({ spawnImpl });

    const first = manager.openStream({ cols: 80, rows: 24 });
    if (!first.ok) return;
    ptys[0].emitData("x".repeat(TERMINAL_REPLAY_LIMIT_BYTES));
    ptys[0].emitData("FINAL");
    manager.detachStream();

    const second = manager.openStream({ cols: 80, rows: 24 });
    if (!second.ok) return;
    const pending = collectEvents(second.events);
    ptys[0].emitExit(0);
    const events = await pending;

    const replay = events[0];
    expect(replay.type).toBe("data");
    if (replay.type !== "data") return;
    expect(replay.data.endsWith("FINAL")).toBe(true);
    expect(replay.data.length).toBeLessThanOrEqual(
      TERMINAL_REPLAY_LIMIT_BYTES
    );
  });

  it("close kills the pty and reports the exit as closed", async () => {
    const { ptys, spawnImpl } = createSpawnFake();
    const manager = new StudioTerminalManager({ spawnImpl });

    const opened = manager.openStream({ cols: 80, rows: 24 });
    if (!opened.ok) return;
    const pending = collectEvents(opened.events);

    expect(manager.close()).toBe(true);
    expect(ptys[0].killed.length).toBeGreaterThan(0);
    ptys[0].emitExit(0);

    const events = await pending;
    expect(events[events.length - 1]).toEqual({
      type: "exit",
      reason: "closed",
    });
    expect(manager.isActive()).toBe(false);
  });

  it("allows a fresh session after the previous one exits", async () => {
    const { ptys, spawnCalls, spawnImpl } = createSpawnFake();
    const manager = new StudioTerminalManager({ spawnImpl });

    const first = manager.openStream({ cols: 80, rows: 24 });
    if (!first.ok) return;
    const pending = collectEvents(first.events);
    ptys[0].emitExit(0);
    await pending;

    const second = manager.openStream({ cols: 80, rows: 24 });
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.created).toBe(true);
    expect(spawnCalls).toHaveLength(2);
  });

  it("kills an idle session and reports the exit as idle", async () => {
    vi.useFakeTimers();
    const { ptys, spawnImpl } = createSpawnFake();
    const manager = new StudioTerminalManager({
      spawnImpl,
      idleTimeoutMs: 1_000,
    });

    const opened = manager.openStream({ cols: 80, rows: 24 });
    if (!opened.ok) return;
    const pending = collectEvents(opened.events);

    // Input reseta o relógio de inatividade.
    vi.advanceTimersByTime(700);
    manager.write("ls\r");
    vi.advanceTimersByTime(700);
    expect(ptys[0].killed).toHaveLength(0);

    vi.advanceTimersByTime(400);
    expect(ptys[0].killed.length).toBeGreaterThan(0);
    ptys[0].emitExit(0);

    vi.useRealTimers();
    const events = await pending;
    expect(events[events.length - 1]).toEqual({ type: "exit", reason: "idle" });
  });

  it("reports a spawn failure as a failed open", () => {
    const manager = new StudioTerminalManager({
      spawnImpl: () => {
        throw new Error("sem toolchain");
      },
    });

    const opened = manager.openStream({ cols: 80, rows: 24 });
    expect(opened.ok).toBe(false);
    if (!opened.ok) expect(opened.reason).toBe("spawn_failed");
    expect(manager.isActive()).toBe(false);
  });
});
