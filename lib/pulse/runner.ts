import OpenAI from "openai";
import type { PulseRun, PulseTask } from "@/lib/pulse/types";
import {
  resolvePulseExecutionProfile,
  type PulseExecutionProfile,
} from "@/lib/pulse/config";
import { buildPulseSystemPrompt } from "@/lib/pulse/context";
import { createOpenAIClient } from "@/lib/server/chatRequest";
import {
  extractResponseOutput,
  responseToMessagePatch,
} from "@/lib/chat/responseToMessagePatch";
import {
  advancePulseTask,
  createPulseRun,
  finishPulseRun,
  getDuePulseTasks,
  recoverOrphanedPulseRuns,
} from "@/lib/pulse/store";
import { derivePulseRunTitle } from "@/lib/pulse/runTitle";

const DEFAULT_IMAGE_MODEL = "gpt-image-2";
const DEFAULT_PULSE_MAX_OUTPUT_TOKENS = 25_000;
const MIN_PULSE_MAX_OUTPUT_TOKENS = 8_000;
const MAX_PULSE_MAX_OUTPUT_TOKENS = 32_000;
const MAX_DUE_TASKS_PER_TICK = 2;
const PULSE_ALREADY_RUNNING_MESSAGE = "Essa rotina Pulse ja esta em execucao.";

// Execuções vivas neste processo. Depois de um restart o conjunto nasce vazio,
// então toda execução `running` no arquivo é órfã e pode ser recuperada (B4).
const activeRunIds = new Set<string>();

export class PulseRunAlreadyRunningError extends Error {
  constructor() {
    super(PULSE_ALREADY_RUNNING_MESSAGE);
    this.name = "PulseRunAlreadyRunningError";
  }
}

async function claimTask(task: PulseTask) {
  const profile = resolvePulseExecutionProfile(task);
  const run = await createPulseRun(task, profile);
  if (!run) throw new PulseRunAlreadyRunningError();
  activeRunIds.add(run.id);
  return { run, profile };
}
function getPulseMaxOutputTokens(): number {
  const configured = Number.parseInt(process.env.PULSE_MAX_OUTPUT_TOKENS ?? "", 10);
  if (!Number.isFinite(configured)) return DEFAULT_PULSE_MAX_OUTPUT_TOKENS;
  return Math.min(
    MAX_PULSE_MAX_OUTPUT_TOKENS,
    Math.max(MIN_PULSE_MAX_OUTPUT_TOKENS, configured)
  );
}

function getIncompleteReason(response: OpenAI.Responses.Response): string | null {
  const details = response.incomplete_details as { reason?: unknown } | null;
  return typeof details?.reason === "string" ? details.reason : null;
}

function pulseFailureMessage(response: OpenAI.Responses.Response, fallback: string): string {
  const reason = getIncompleteReason(response);
  if (response.status === "incomplete" && reason === "max_output_tokens") {
    return "A execução Pulse esgotou PULSE_MAX_OUTPUT_TOKENS antes de produzir a resposta final.";
  }
  if (response.status === "incomplete") {
    return `A execução Pulse terminou incompleta${reason ? ` (${reason})` : ""}.`;
  }
  return response.error?.message || fallback;
}

async function generatePulseOpeningImage(params: {
  openai: OpenAI;
  task: PulseTask;
  content: string;
  profile: PulseExecutionProfile;
}): Promise<{ imageBase64?: string; imageMimeType?: string }> {
  const prompt = [
    `Gere uma imagem conceitual de abertura para a rotina Pulse "${params.task.title}".`,
    "A imagem deve ser editorial, limpa, sofisticada e sem texto legivel.",
    "Use como base estes temas do resultado:",
    params.content.slice(0, 1600),
  ].join("\n\n");

  const response = await params.openai.responses.create({
    model: params.profile.model,
    instructions:
      "Tu geras somente uma imagem de abertura para um card Pulse. Nao escrevas explicacao textual.",
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: prompt }],
      },
    ],
    max_output_tokens: 1200,
    reasoning: { effort: params.profile.reasoningEffort },
    tools: [
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

  const output = extractResponseOutput(response);
  return {
    ...(output.imageBase64 ? { imageBase64: output.imageBase64 } : {}),
    ...(output.imageMimeType ? { imageMimeType: output.imageMimeType } : {}),
  };
}

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
  const { run, profile } = await claimTask(task);
  try {
    return await completeClaimedRun(task, run, profile, openai);
  } finally {
    activeRunIds.delete(run.id);
  }
}

async function completeClaimedRun(
  task: PulseTask,
  run: PulseRun,
  profile: PulseExecutionProfile,
  openai: OpenAI
): Promise<PulseRun> {
  try {
    const instructions = await buildPulseSystemPrompt(task);
    const response = await openai.responses.create({
      model: profile.model,
      instructions,
      input: buildPulseInput(task),
      max_output_tokens: getPulseMaxOutputTokens(),
      reasoning: { effort: profile.reasoningEffort },
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
    const output = extractResponseOutput(response);
    const finalContent =
      output.content || (patch.streamStatus === "completed" ? patch.content || "" : "");
    const fallbackImage: { imageBase64?: string; imageMimeType?: string } =
      patch.streamStatus === "completed" && !output.imageBase64 && finalContent.trim()
        ? await generatePulseOpeningImage({ openai, task, content: finalContent, profile }).catch(
            (error) => {
              console.warn("[pulse] Falha ao gerar imagem fallback:", error);
              return {};
            }
          )
        : {};
    const completed = await finishPulseRun(run.id, {
      status: patch.streamStatus === "completed" ? "completed" : "failed",
      title: derivePulseRunTitle(finalContent, task.title),
      taskTitle: task.title,
      content: finalContent,
      citations: patch.citations ?? output.citations ?? [],
      ...(patch.imageBase64 || output.imageBase64 || fallbackImage.imageBase64
        ? {
            imageBase64:
              patch.imageBase64 ?? output.imageBase64 ?? fallbackImage.imageBase64,
          }
        : {}),
      ...(patch.imageMimeType || output.imageMimeType || fallbackImage.imageMimeType
        ? {
            imageMimeType:
              patch.imageMimeType ?? output.imageMimeType ?? fallbackImage.imageMimeType,
          }
        : {}),
      responseId: response.id,
      completedAt: new Date().toISOString(),
      ...(patch.streamStatus !== "completed"
        ? {
            error: pulseFailureMessage(
              response,
              patch.content || "A execução Pulse não retornou resposta final."
            ),
          }
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
      taskTitle: task.title,
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

  await recoverOrphanedPulseRuns(activeRunIds);
  const dueTasks = (await getDuePulseTasks(now)).slice(0, MAX_DUE_TASKS_PER_TICK);
  const runs: PulseRun[] = [];
  const skipped: string[] = [];

  for (const task of dueTasks) {
    try {
      runs.push(await executeTask(task, openai));
    } catch (error) {
      if (error instanceof PulseRunAlreadyRunningError) {
        skipped.push(task.id);
        continue;
      }
      throw error;
    }
  }

  return {
    checkedAt: now.toISOString(),
    dueCount: dueTasks.length,
    startedCount: runs.length,
    skipped,
    runs,
  };
}

/**
 * Disparo manual: reivindica a execução e devolve o run `running` na hora; o
 * trabalho segue em background no servidor. Antes a rota esperava o run inteiro
 * e o `ProxyTimeout 300` do Apache devolvia 502 falso acima de 5 min (B4).
 */
export async function startPulseTaskNow(task: PulseTask): Promise<PulseRun> {
  const openai = createOpenAIClient();
  if (!openai) {
    throw new Error("OPENAI_API_KEY nao configurada no servidor.");
  }
  await recoverOrphanedPulseRuns(activeRunIds);
  const { run, profile } = await claimTask(task);
  void completeClaimedRun(task, run, profile, openai)
    .catch((error) => {
      console.error("[pulse] manual run failed", { runId: run.id, taskId: task.id }, error);
    })
    .finally(() => {
      activeRunIds.delete(run.id);
    });
  return run;
}
