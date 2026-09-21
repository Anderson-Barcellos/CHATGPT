import type OpenAI from "openai";
import type { ChatRequestBody } from "@/lib/server/chatRequest";
import { buildXAIResponseCreateParams, createXAIClient } from "@/lib/server/xaiChat";
import { applyBackgroundResponseToConversation, toBackgroundJobStatus } from "@/lib/server/chatBackgroundJob";
import { getConversation } from "@/app/api/conversations/data";
import { getBackgroundJobByResponseId, updateBackgroundJobByResponseId } from "@/lib/server/chatBackgroundJobStore";

type Binding = { responseId: string; conversationId: string; assistantMessageId: string };
type Runtime = { controllers: Map<string, AbortController>; transitions: Map<string, Promise<unknown>> };
const runtimeKey = "__gauchoChatXaiBackgroundRuntimeV2";
const runtime = ((globalThis as typeof globalThis & { [runtimeKey]?: Runtime })[runtimeKey] ??= {
  controllers: new Map(), transitions: new Map(),
});
const MAX_REQUEST_MS = 15 * 60_000;

/** Serializa transições do mesmo job, sem segurar lock de arquivo durante a rede. */
async function transition<T>(id: string, action: () => Promise<T>): Promise<T> {
  const previous = runtime.transitions.get(id) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(action);
  runtime.transitions.set(id, current);
  try { return await current; }
  finally { if (runtime.transitions.get(id) === current) runtime.transitions.delete(id); }
}

async function boundJob(binding: Binding) {
  const job = await getBackgroundJobByResponseId(binding.responseId);
  return job?.provider === "xai" && job.conversationId === binding.conversationId &&
    job.assistantMessageId === binding.assistantMessageId ? job : null;
}

async function currentMessage(binding: Binding) {
  const conversation = await getConversation(binding.conversationId);
  return conversation?.messages.find((message) => message.id === binding.assistantMessageId &&
    message.backgroundJob?.responseId === binding.responseId) ?? null;
}

function terminal(id: string, status: "cancelled" | "failed" | "incomplete", error?: string) {
  return { id, status, error: error ? { message: error } : null, output: [] } as unknown as OpenAI.Responses.Response;
}

function safeFailure(error: unknown): string {
  const value = error as { status?: number; name?: string } | null;
  if (value?.name === "TimeoutError" || value?.name === "APIConnectionTimeoutError") return "A geração Grok excedeu o tempo limite. Tente novamente explicitamente.";
  if (value?.status === 401 || value?.status === 403) return "A credencial xAI não possui acesso a esta geração.";
  if (value?.status === 429) return "A xAI atingiu o limite de uso. Aguarde antes de tentar novamente.";
  return "A geração Grok falhou. Tente novamente explicitamente.";
}

async function finish(binding: Binding, response: OpenAI.Responses.Response, controller?: AbortController, interrupted = false) {
  return transition(binding.responseId, async () => {
    const job = await boundJob(binding);
    if (!job) return null;
    if (job.status !== "queued" && job.status !== "in_progress") return currentMessage(binding);
    if (controller?.signal.aborted) return null;
    // A conversa pode ter sido salva antes de uma falha ao atualizar o índice.
    const persisted = await currentMessage(binding);
    if (persisted?.backgroundJob && ["completed", "cancelled", "failed"].includes(persisted.backgroundJob.status)) {
      await updateBackgroundJobByResponseId(binding.responseId, {
        status: persisted.backgroundJob.status,
        error: persisted.backgroundJob.error,
        lastSyncedAt: new Date().toISOString(),
      });
      return persisted;
    }
    const message = await applyBackgroundResponseToConversation({
      ...binding, response: { ...response, id: binding.responseId }, provider: "xai",
      expectedResponseId: binding.responseId,
      preserveTerminal: true,
      shouldApply: () => !controller?.signal.aborted,
      ...(interrupted ? { streamStatus: "interrupted" as const } : {}),
    });
    // Cancelamento pode ocorrer enquanto o lock da conversa estava ocupado.
    if (controller?.signal.aborted) return null;
    await updateBackgroundJobByResponseId(binding.responseId, {
      status: message?.backgroundJob?.status ?? (message ? toBackgroundJobStatus(response.status) : "failed"),
      lastSyncedAt: new Date().toISOString(),
      error: message ? response.error?.message : "Mensagem vinculada não encontrada.",
    });
    return message;
  });
}

/** Job já persistido. O executor não depende do request do navegador. */
export function startXAIBackgroundJob(params: Binding & { body: ChatRequestBody }): Promise<void> {
  if (runtime.controllers.has(params.responseId)) return Promise.resolve();
  const controller = new AbortController();
  runtime.controllers.set(params.responseId, controller);
  return (async () => {
    try {
      const ready = await transition(params.responseId, async () => {
        const job = await boundJob(params);
        if (!job || controller.signal.aborted || !["queued", "in_progress"].includes(job.status)) return false;
        await updateBackgroundJobByResponseId(params.responseId, { status: "in_progress" });
        return true;
      });
      if (!ready || controller.signal.aborted) return;
      let response: OpenAI.Responses.Response;
      try {
        const client = createXAIClient();
        if (!client) throw new Error("xai_key_missing");
        response = await client.responses.create(
          { ...buildXAIResponseCreateParams(params.body), stream: false } as OpenAI.Responses.ResponseCreateParamsNonStreaming,
          { signal: controller.signal, timeout: MAX_REQUEST_MS, maxRetries: 0 },
        );
      } catch (error) {
        if (controller.signal.aborted) return;
        response = terminal(params.responseId, "failed", safeFailure(error));
      }
      await finish(params, response, controller);
    } finally {
      if (runtime.controllers.get(params.responseId) === controller) runtime.controllers.delete(params.responseId);
    }
  })().catch(() => {
    // Erro de persistência não pode virar unhandled rejection do processo Next.
    console.error("[chat/xai-background] Falha ao persistir estado terminal", { responseId: params.responseId });
  });
}

export async function cancelXAIBackgroundJob(binding: Binding) {
  // Aborta antes de esperar o lock: finish verifica a cerca dentro da conversa.
  runtime.controllers.get(binding.responseId)?.abort();
  return finish(binding, terminal(binding.responseId, "cancelled"));
}

export function isXAIBackgroundJobActive(responseId: string): boolean {
  return runtime.controllers.has(responseId);
}

export async function recoverInterruptedXAIBackgroundJob(binding: Binding) {
  if (isXAIBackgroundJobActive(binding.responseId)) return currentMessage(binding);
  return finish(binding, terminal(binding.responseId, "incomplete",
    "Execução Grok interrompida por reinício do servidor; não foi repetida automaticamente."), undefined, true);
}
