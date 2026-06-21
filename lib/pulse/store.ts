import { readDataFile, withDataFileLock, writeDataFile } from "@/lib/server/jsonFileStore";
import {
  PulseRun,
  PulseTask,
  PulseTaskCreateInput,
} from "@/lib/pulse/types";
import { computeNextRunAt, normalizeScheduleInput } from "@/lib/pulse/schedule";

const TASKS_FILE = "pulse-tasks.json";
const RUNS_FILE = "pulse-runs.json";
const MAX_RUNS = 120;

function cleanString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function cleanEmoji(value: unknown): string {
  const cleaned = cleanString(value);
  return cleaned ? Array.from(cleaned)[0] ?? "✨" : "✨";
}

function parseTask(value: unknown): PulseTask | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<PulseTask>;
  if (
    typeof raw.id !== "string" ||
    typeof raw.title !== "string" ||
    typeof raw.emoji !== "string" ||
    typeof raw.prompt !== "string" ||
    typeof raw.executionPrompt !== "string" ||
    (raw.status !== "active" && raw.status !== "paused") ||
    typeof raw.nextRunAt !== "string" ||
    typeof raw.createdAt !== "string" ||
    typeof raw.updatedAt !== "string" ||
    !raw.schedule ||
    typeof raw.schedule !== "object"
  ) {
    return null;
  }
  return raw as PulseTask;
}

function parseRun(value: unknown): PulseRun | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<PulseRun>;
  if (
    typeof raw.id !== "string" ||
    typeof raw.taskId !== "string" ||
    (raw.status !== "queued" &&
      raw.status !== "running" &&
      raw.status !== "completed" &&
      raw.status !== "failed") ||
    typeof raw.title !== "string" ||
    typeof raw.content !== "string" ||
    typeof raw.createdAt !== "string" ||
    typeof raw.updatedAt !== "string" ||
    !Array.isArray(raw.citations)
  ) {
    return null;
  }
  return raw as PulseRun;
}

async function readTasks(): Promise<PulseTask[]> {
  const parsed = await readDataFile(TASKS_FILE, [] as unknown[]);
  return Array.isArray(parsed) ? parsed.map(parseTask).filter(Boolean) as PulseTask[] : [];
}

async function writeTasks(tasks: PulseTask[]) {
  await writeDataFile(TASKS_FILE, tasks);
}

async function readRuns(): Promise<PulseRun[]> {
  const parsed = await readDataFile(RUNS_FILE, [] as unknown[]);
  return Array.isArray(parsed) ? parsed.map(parseRun).filter(Boolean) as PulseRun[] : [];
}

async function writeRuns(runs: PulseRun[]) {
  await writeDataFile(RUNS_FILE, runs.slice(0, MAX_RUNS));
}

export function normalizePulseTaskInput(input: PulseTaskCreateInput): Omit<
  PulseTask,
  "id" | "status" | "nextRunAt" | "createdAt" | "updatedAt"
> {
  const title = cleanString(input.title);
  const prompt = cleanString(input.prompt);
  if (!title) throw new Error("Titulo da rotina e obrigatorio.");
  if (!prompt) throw new Error("Prompt da rotina e obrigatorio.");

  const schedule = normalizeScheduleInput(input);
  const executionPrompt = cleanString(input.executionPrompt) ?? prompt;

  return {
    title: title.slice(0, 120),
    emoji: cleanEmoji(input.emoji),
    prompt,
    executionPrompt,
    schedule,
  };
}

export async function listPulseTasks(): Promise<PulseTask[]> {
  const tasks = await readTasks();
  return tasks.sort((a, b) => a.nextRunAt.localeCompare(b.nextRunAt));
}

export async function getPulseTask(taskId: string): Promise<PulseTask | null> {
  const tasks = await readTasks();
  return tasks.find((task) => task.id === taskId) ?? null;
}

export async function listPulseRuns(taskId?: string): Promise<PulseRun[]> {
  const runs = await readRuns();
  return runs
    .filter((run) => !taskId || run.taskId === taskId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deletePulseRun(runId: string): Promise<boolean> {
  return withDataFileLock(RUNS_FILE, async () => {
    const runs = await readRuns();
    const filtered = runs.filter((run) => run.id !== runId);
    if (filtered.length === runs.length) return false;
    await writeRuns(filtered);
    return true;
  });
}

export async function createPulseTask(input: PulseTaskCreateInput): Promise<PulseTask> {
  return withDataFileLock(TASKS_FILE, async () => {
    const tasks = await readTasks();
    const now = new Date().toISOString();
    const normalized = normalizePulseTaskInput(input);
    const task: PulseTask = {
      id: crypto.randomUUID(),
      ...normalized,
      status: "active",
      nextRunAt: computeNextRunAt(normalized.schedule),
      createdAt: now,
      updatedAt: now,
    };
    tasks.unshift(task);
    await writeTasks(tasks);
    return task;
  });
}

export async function updatePulseTaskStatus(
  taskId: string,
  status: PulseTask["status"]
): Promise<PulseTask | null> {
  return withDataFileLock(TASKS_FILE, async () => {
    const tasks = await readTasks();
    const index = tasks.findIndex((task) => task.id === taskId);
    if (index === -1) return null;
    const updated = {
      ...tasks[index],
      status,
      updatedAt: new Date().toISOString(),
    };
    tasks[index] = updated;
    await writeTasks(tasks);
    return updated;
  });
}

export async function deletePulseTask(taskId: string): Promise<boolean> {
  return withDataFileLock(TASKS_FILE, async () => {
    const tasks = await readTasks();
    const filtered = tasks.filter((task) => task.id !== taskId);
    if (filtered.length === tasks.length) return false;
    await writeTasks(filtered);
    return true;
  });
}

export async function getDuePulseTasks(now = new Date()): Promise<PulseTask[]> {
  const tasks = await readTasks();
  const nowMs = now.getTime();
  return tasks.filter(
    (task) => task.status === "active" && new Date(task.nextRunAt).getTime() <= nowMs
  );
}

export async function createPulseRun(task: PulseTask): Promise<PulseRun> {
  return withDataFileLock(RUNS_FILE, async () => {
    const runs = await readRuns();
    const now = new Date().toISOString();
    const run: PulseRun = {
      id: crypto.randomUUID(),
      taskId: task.id,
      status: "running",
      title: task.title,
      content: "",
      citations: [],
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    runs.unshift(run);
    await writeRuns(runs);
    return run;
  });
}

export async function finishPulseRun(
  runId: string,
  updates: Partial<PulseRun>
): Promise<PulseRun | null> {
  return withDataFileLock(RUNS_FILE, async () => {
    const runs = await readRuns();
    const index = runs.findIndex((run) => run.id === runId);
    if (index === -1) return null;
    const updated = {
      ...runs[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    runs[index] = updated;
    await writeRuns(runs);
    return updated;
  });
}

export async function advancePulseTask(task: PulseTask, runId?: string): Promise<PulseTask | null> {
  return withDataFileLock(TASKS_FILE, async () => {
    const tasks = await readTasks();
    const index = tasks.findIndex((item) => item.id === task.id);
    if (index === -1) return null;
    const now = new Date();
    const updated: PulseTask = {
      ...tasks[index],
      nextRunAt: computeNextRunAt(tasks[index].schedule, now),
      lastRunAt: now.toISOString(),
      ...(runId ? { lastRunId: runId } : {}),
      updatedAt: now.toISOString(),
    };
    tasks[index] = updated;
    await writeTasks(tasks);
    return updated;
  });
}

export async function hasRunningPulseRun(taskId: string): Promise<boolean> {
  const runs = await readRuns();
  return runs.some((run) => run.taskId === taskId && run.status === "running");
}
