import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PulseRun, PulseTask } from "@/lib/pulse/types";

const files = vi.hoisted(() => new Map<string, unknown>());
const openai = vi.hoisted(() => ({
  responses: { create: vi.fn() },
}));
const openaiKey = vi.hoisted(() => ({ missing: false }));

vi.mock("@/lib/server/jsonFileStore", () => {
  const chains = new Map<string, Promise<unknown>>();
  return {
    readDataFile: async <T,>(name: string, fallback: T) =>
      (files.has(name) ? structuredClone(files.get(name)) : fallback) as T,
    writeDataFile: async (name: string, value: unknown) => {
      files.set(name, structuredClone(value));
    },
    withDataFileLock: async <T,>(name: string, fn: () => Promise<T>) => {
      const previous = chains.get(name) ?? Promise.resolve();
      const next = previous.then(fn, fn);
      chains.set(name, next.catch(() => undefined));
      return next;
    },
  };
});
vi.mock("@/lib/server/chatRequest", () => ({
  createOpenAIClient: () => (openaiKey.missing ? null : openai),
}));
vi.mock("@/lib/pulse/context", () => ({
  buildPulseSystemPrompt: async () => "instructions",
}));

import { runDuePulseTasks, startPulseTaskNow } from "@/lib/pulse/runner";

const now = new Date("2026-09-05T03:00:00.000Z");
const task: PulseTask = {
  id: "task-1",
  title: "Radar",
  emoji: "📡",
  prompt: "Pesquise.",
  executionPrompt: "Pesquise novidades.",
  model: "gpt-6.1-sol",
  status: "active",
  schedule: { recurrenceType: "daily", time: "09:00" } as unknown as PulseTask["schedule"],
  nextRunAt: new Date(now.getTime() - 60_000).toISOString(),
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
};

function runs(): PulseRun[] {
  return (files.get("pulse-runs.json") as PulseRun[]) ?? [];
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  files.clear();
  files.set("pulse-tasks.json", [task]);
  openai.responses.create.mockReset();
  openaiKey.missing = false;
});

describe("Pulse manual start", () => {
  it("returns the claimed running run immediately and settles it in the background", async () => {
    const pending = deferred<never>();
    openai.responses.create.mockReturnValue(pending.promise);

    const started = await startPulseTaskNow(task);
    expect(started.status).toBe("running");
    expect(runs()[0]).toMatchObject({ id: started.id, status: "running" });

    await expect(startPulseTaskNow(task)).rejects.toThrow("ja esta em execucao");

    pending.reject(new Error("provider down"));
    await vi.waitFor(() => {
      expect(runs()[0]).toMatchObject({ id: started.id, status: "failed", error: "provider down" });
    });

    const again = await startPulseTaskNow(task);
    expect(again.id).not.toBe(started.id);
  });

  it("recovers a run orphaned by a restart before the due tick claims again", async () => {
    files.set("pulse-runs.json", [
      {
        id: "orphan",
        taskId: task.id,
        status: "running",
        title: task.title,
        content: "",
        citations: [],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    ]);
    openai.responses.create.mockRejectedValue(new Error("provider down"));

    const result = await runDuePulseTasks(now);

    expect(result.skipped).toEqual([]);
    expect(result.startedCount).toBe(1);
    const byId = new Map(runs().map((run) => [run.id, run]));
    expect(byId.get("orphan")?.status).toBe("failed");
    expect(result.runs[0].id).not.toBe("orphan");
  });

  it("finaliza o run agendado como failed quando falta a chave do provider", async () => {
    const grokTask = { ...task, model: "grok-4.7" as const };
    files.set("pulse-tasks.json", [grokTask]);
    openaiKey.missing = true;

    const result = await runDuePulseTasks(now);

    expect(result.startedCount).toBe(1);
    expect(result.runs[0]).toMatchObject({
      status: "failed",
      error: "OPENAI_API_KEY nao configurada no servidor.",
      modelUsed: "gpt-6-luna",
      reasoningEffort: "medium",
    });
    expect(runs()[0]).toMatchObject({
      status: "failed",
      error: "OPENAI_API_KEY nao configurada no servidor.",
    });
    expect(openai.responses.create).not.toHaveBeenCalled();
  });

  it("roda a rotina salva com Grok no Luna, com busca web e imagem da OpenAI", async () => {
    const grokTask = { ...task, model: "grok-4.7" as const };
    files.set("pulse-tasks.json", [grokTask]);
    openai.responses.create.mockResolvedValue({
      id: "luna-response",
      status: "completed",
      error: null,
      incomplete_details: null,
      usage: null,
      output_text: "Radar com fonte",
      output: [
        {
          type: "message",
          id: "luna-message",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: "Radar com fonte", annotations: [] }],
        },
        {
          type: "image_generation_call",
          id: "image-call",
          status: "completed",
          result: "imagem-base64",
        },
      ],
    });

    const result = await runDuePulseTasks(now);

    expect(openai.responses.create).toHaveBeenCalledTimes(1);
    expect(openai.responses.create).toHaveBeenCalledWith(expect.objectContaining({
      model: "gpt-6-luna",
      reasoning: { effort: "medium" },
      text: { verbosity: "high" },
      tools: [
        expect.objectContaining({ type: "web_search_preview" }),
        expect.objectContaining({ type: "image_generation", model: "gpt-image-2" }),
      ],
    }));
    expect(result.runs[0]).toMatchObject({
      status: "completed",
      content: "Radar com fonte",
      imageBase64: "imagem-base64",
      modelUsed: "gpt-6-luna",
      reasoningEffort: "medium",
    });
  });
});
