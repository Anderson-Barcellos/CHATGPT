import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import {
  RUNNER_MAX_EVENTS,
  StudioWorkspaceRunnerManager,
  buildRunnerCommand,
} from "@/lib/server/studioWorkspaceRunner";
import type { StudioWorkspaceRunEvent } from "@/lib/studio/workspaceServerProtocol";

class FakeProcess extends EventEmitter {
  stdin = new PassThrough();
  stdout = new PassThrough();
  stderr = new PassThrough();
}

interface SpawnCall {
  command: string;
  args: string[];
  process: FakeProcess;
}

function createSpawnFake() {
  const calls: SpawnCall[] = [];
  const spawnImpl = (command: string, args: string[]) => {
    const fake = new FakeProcess();
    calls.push({ command, args, process: fake });
    if (command === "systemctl") {
      queueMicrotask(() => fake.emit("close", 0, null));
    }
    return fake;
  };
  return { calls, spawnImpl };
}

async function collectEvents(
  events: AsyncGenerator<StudioWorkspaceRunEvent>
): Promise<StudioWorkspaceRunEvent[]> {
  const collected: StudioWorkspaceRunEvent[] = [];
  for await (const event of events) collected.push(event);
  return collected;
}

function statusOf(events: StudioWorkspaceRunEvent[]) {
  const last = events[events.length - 1];
  return last?.type === "status" ? last.status : undefined;
}

describe("buildRunnerCommand", () => {
  it("builds the proven systemd-run recipe", () => {
    const { command, args } = buildRunnerCommand({
      filePath: "main.py",
      unitId: "gaucho-studio-run-teste",
      timeoutMs: 120_000,
    });

    expect(command).toBe("systemd-run");
    expect(args).toContain("--uid=studio");
    expect(args).toContain("--unit=gaucho-studio-run-teste");
    expect(args).toContain(
      "--property=BindPaths=/root/studio-projects/active:/workspace"
    );
    expect(args).toContain("--property=ProtectSystem=strict");
    expect(args).toContain("--property=ProtectHome=true");
    expect(args).toContain("--property=NoNewPrivileges=true");
    expect(args).toContain("--property=RuntimeMaxSec=150");
    expect(args).toContain("--collect");
    expect(args).toContain("--pipe");
    expect(args[args.length - 2]).toBe("/opt/studio-venv/bin/python");
    expect(args[args.length - 1]).toBe("/workspace/main.py");
  });

  it("inherits the API key without exposing its value in argv", () => {
    const { args } = buildRunnerCommand({
      filePath: "main.py",
      unitId: "u",
      timeoutMs: 1_000,
    });

    expect(args).toContain("--setenv=OPENAI_API_KEY");
    expect(args.some((arg) => arg.startsWith("--setenv=OPENAI_API_KEY="))).toBe(
      false
    );
  });

  it("refuses unvalidated file paths defensively", () => {
    expect(() =>
      buildRunnerCommand({ filePath: "../fuga.py", unitId: "u", timeoutMs: 1 })
    ).toThrow();
    expect(() =>
      buildRunnerCommand({ filePath: "/etc/passwd", unitId: "u", timeoutMs: 1 })
    ).toThrow();
  });
});

describe("StudioWorkspaceRunnerManager", () => {
  it("streams stdout lines as console events and completes", async () => {
    const { calls, spawnImpl } = createSpawnFake();
    const manager = new StudioWorkspaceRunnerManager({ spawnImpl });

    const started = manager.startRun({ filePath: "main.py", timeoutMs: 5_000 });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const pending = collectEvents(started.events);
    const run = calls[0].process;
    run.stdout.write("primeira linha\nsegunda ");
    run.stdout.write("linha\n");
    run.stderr.write("aviso no stderr\n");
    run.emit("close", 0, null);

    const events = await pending;
    const consoles = events.filter((event) => event.type === "console");

    expect(consoles).toEqual([
      { type: "console", level: "log", text: "primeira linha" },
      { type: "console", level: "log", text: "segunda linha" },
      { type: "console", level: "error", text: "aviso no stderr" },
    ]);
    expect(statusOf(events)).toBe("completed");
    expect(manager.isBusy()).toBe(false);
  });

  it("reports non-zero exits as failed", async () => {
    const { calls, spawnImpl } = createSpawnFake();
    const manager = new StudioWorkspaceRunnerManager({ spawnImpl });

    const started = manager.startRun({ filePath: "main.py", timeoutMs: 5_000 });
    if (!started.ok) return;

    const pending = collectEvents(started.events);
    calls[0].process.emit("close", 3, null);

    expect(statusOf(await pending)).toBe("failed");
  });

  it("rejects a second concurrent run", async () => {
    const { calls, spawnImpl } = createSpawnFake();
    const manager = new StudioWorkspaceRunnerManager({ spawnImpl });

    const first = manager.startRun({ filePath: "main.py", timeoutMs: 5_000 });
    const second = manager.startRun({ filePath: "outro.py", timeoutMs: 5_000 });

    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe("run_busy");

    if (first.ok) {
      const pending = collectEvents(first.events);
      calls[0].process.emit("close", 0, null);
      await pending;
    }
  });

  it("stops the active run via systemctl and reports aborted", async () => {
    const { calls, spawnImpl } = createSpawnFake();
    const manager = new StudioWorkspaceRunnerManager({ spawnImpl });

    const started = manager.startRun({ filePath: "main.py", timeoutMs: 5_000 });
    if (!started.ok) return;
    const pending = collectEvents(started.events);

    const stopped = await manager.stop();
    expect(stopped).toBe(true);

    const stopCall = calls.find((call) => call.command === "systemctl");
    expect(stopCall?.args[0]).toBe("stop");
    expect(stopCall?.args[1]).toMatch(/^gaucho-studio-run-/);

    calls[0].process.emit("close", null, "SIGTERM");
    expect(statusOf(await pending)).toBe("aborted");
  });

  it("stops the run and reports timeout when the deadline passes", async () => {
    const { calls, spawnImpl } = createSpawnFake();
    const manager = new StudioWorkspaceRunnerManager({ spawnImpl });

    const started = manager.startRun({ filePath: "main.py", timeoutMs: 30 });
    if (!started.ok) return;
    const pending = collectEvents(started.events);

    await new Promise((resolve) => setTimeout(resolve, 80));
    const stopCall = calls.find((call) => call.command === "systemctl");
    expect(stopCall).toBeDefined();

    calls[0].process.emit("close", null, "SIGTERM");
    expect(statusOf(await pending)).toBe("timeout");
  });

  it("forwards stdin to the active run and echoes it as a command event", async () => {
    const { calls, spawnImpl } = createSpawnFake();
    const manager = new StudioWorkspaceRunnerManager({ spawnImpl });

    const started = manager.startRun({ filePath: "main.py", timeoutMs: 5_000 });
    if (!started.ok) return;
    const pending = collectEvents(started.events);
    const run = calls[0].process;

    const written: string[] = [];
    run.stdin.on("data", (chunk: Buffer) => written.push(chunk.toString()));

    expect(manager.writeStdin("Anders\n")).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 5));

    run.stdout.write("Olá, Anders\n");
    run.emit("close", 0, null);
    const events = await pending;

    expect(written).toEqual(["Anders\n"]);
    expect(events).toContainEqual({
      type: "console",
      level: "command",
      text: "Anders",
    });
    expect(statusOf(events)).toBe("completed");
  });

  it("flushes a prompt without newline after a short idle so input() is visible", async () => {
    const { calls, spawnImpl } = createSpawnFake();
    const manager = new StudioWorkspaceRunnerManager({ spawnImpl });

    const started = manager.startRun({ filePath: "main.py", timeoutMs: 5_000 });
    if (!started.ok) return;
    const events: StudioWorkspaceRunEvent[] = [];
    const consuming = (async () => {
      for await (const event of started.events) events.push(event);
    })();
    const run = calls[0].process;

    run.stdout.write("Qual teu nome? ");
    await new Promise((resolve) => setTimeout(resolve, 400));

    // O prompt precisa chegar com o processo ainda vivo, não no flush do close.
    const firstEvent = events[0] ?? "sem-evento";

    run.emit("close", 0, null);
    await consuming;

    expect(firstEvent).toEqual({
      type: "console",
      level: "log",
      text: "Qual teu nome? ",
    });
  });

  it("refuses stdin without an active run", () => {
    const { spawnImpl } = createSpawnFake();
    const manager = new StudioWorkspaceRunnerManager({ spawnImpl });

    expect(manager.writeStdin("nada\n")).toBe(false);
  });

  it("refuses stdin after the run finished", async () => {
    const { calls, spawnImpl } = createSpawnFake();
    const manager = new StudioWorkspaceRunnerManager({ spawnImpl });

    const started = manager.startRun({ filePath: "main.py", timeoutMs: 5_000 });
    if (!started.ok) return;
    const pending = collectEvents(started.events);
    calls[0].process.emit("close", 0, null);
    await pending;

    expect(manager.writeStdin("tarde demais\n")).toBe(false);
  });

  it("truncates oversized entries and kills runs beyond the output budget", async () => {
    const { calls, spawnImpl } = createSpawnFake();
    const manager = new StudioWorkspaceRunnerManager({ spawnImpl });

    const started = manager.startRun({ filePath: "main.py", timeoutMs: 5_000 });
    if (!started.ok) return;
    const pending = collectEvents(started.events);
    const run = calls[0].process;

    // Entries são truncadas a 16 KiB antes de contar no orçamento de 512 KiB:
    // 40 linhas gigantes viram 40 × 16 KiB = 640 KiB emitidos e estouram.
    const hugeLine = "a".repeat(64 * 1024);
    run.stdout.write(`${hugeLine}\n`.repeat(40));

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls.some((call) => call.command === "systemctl")).toBe(true);

    run.emit("close", null, "SIGTERM");
    const events = await pending;

    expect(events.length).toBeLessThan(RUNNER_MAX_EVENTS + 10);
    const firstConsole = events.find((event) => event.type === "console");
    expect(
      firstConsole?.type === "console" &&
        firstConsole.text.endsWith("… [linha truncada]")
    ).toBe(true);
    expect(
      events.some(
        (event) =>
          event.type === "console" &&
          event.level === "error" &&
          event.text.includes("Limite de saída")
      )
    ).toBe(true);
    expect(statusOf(events)).toBe("failed");
  });
});
