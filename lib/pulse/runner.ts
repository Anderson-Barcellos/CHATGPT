import OpenAI from "openai";
import type { PulseRun, PulseTask } from "@/lib/pulse/types";
import { buildPulseSystemPrompt } from "@/lib/pulse/context";
import { createOpenAIClient } from "@/lib/server/chatRequest";
import { responseToMessagePatch } from "@/lib/chat/responseToMessagePatch";
import {
  advancePulseTask,
  createPulseRun,
  finishPulseRun,
  getDuePulseTasks,
  hasRunningPulseRun,
} from "@/lib/pulse/store";

const DEFAULT_PULSE_MODEL = "gpt-5.4";
const DEFAULT_IMAGE_MODEL = "gpt-image-2";
const MAX_DUE_TASKS_PER_TICK = 2;

function buildPulseInput(task: PulseTask): OpenAI.Responses.ResponseInput {
  return [
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: task.executionPrompt,
        },
      ],
    },
  ];
}

async function executeTask(task: PulseTask, openai: OpenAI): Promise<PulseRun> {
  const run = await createPulseRun(task);

  try {
    const instructions = await buildPulseSystemPrompt(task);
    const response = await openai.responses.create({
      model: process.env.PULSE_RUN_MODEL?.trim() || DEFAULT_PULSE_MODEL,
      instructions,
      input: buildPulseInput(task),
      max_output_tokens: 4500,
      reasoning: { effort: "medium", summary: "detailed" },
      text: { verbosity: "high" },
      tools: [
        {
          type: "web_search_preview",
          search_context_size: "medium",
          user_location: { type: "approximate", country: "BR" },
        },
        {
          type: "image_generation",
          model: DEFAULT_IMAGE_MODEL,
          quality: "high",
          size: "auto",
          background: "auto",
          output_format: "png",
        },
      ],
    });

    const patch = responseToMessagePatch(response);
    const completed = await finishPulseRun(run.id, {
      status: patch.streamStatus === "completed" ? "completed" : "failed",
      title: task.title,
      content: patch.content || "",
      citations: patch.citations ?? [],
      ...(patch.imageBase64 ? { imageBase64: patch.imageBase64 } : {}),
      ...(patch.imageMimeType ? { imageMimeType: patch.imageMimeType } : {}),
      responseId: response.id,
      completedAt: new Date().toISOString(),
      ...(patch.streamStatus !== "completed"
        ? { error: patch.content || "A execução Pulse não retornou resposta final." }
        : {}),
    });
    await advancePulseTask(task, run.id);
    return completed ?? run;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao executar rotina Pulse.";
    const failed = await finishPulseRun(run.id, {
      status: "failed",
      title: task.title,
      content: "",
      error: message,
      completedAt: new Date().toISOString(),
    });
    await advancePulseTask(task, run.id);
    return failed ?? run;
  }
}

export async function runDuePulseTasks(now = new Date()) {
  const openai = createOpenAIClient();
  if (!openai) {
    throw new Error("OPENAI_API_KEY nao configurada no servidor.");
  }

  const dueTasks = (await getDuePulseTasks(now)).slice(0, MAX_DUE_TASKS_PER_TICK);
  const runs: PulseRun[] = [];
  const skipped: string[] = [];

  for (const task of dueTasks) {
    if (await hasRunningPulseRun(task.id)) {
      skipped.push(task.id);
      continue;
    }
    runs.push(await executeTask(task, openai));
  }

  return {
    checkedAt: now.toISOString(),
    dueCount: dueTasks.length,
    startedCount: runs.length,
    skipped,
    runs,
  };
}

export async function runPulseTaskNow(task: PulseTask) {
  const openai = createOpenAIClient();
  if (!openai) {
    throw new Error("OPENAI_API_KEY nao configurada no servidor.");
  }
  if (await hasRunningPulseRun(task.id)) {
    throw new Error("Essa rotina Pulse ja esta em execucao.");
  }
  return executeTask(task, openai);
}
