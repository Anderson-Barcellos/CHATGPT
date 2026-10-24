import type OpenAI from "openai";
import { applyBackgroundResponseToConversation, toBackgroundJobStatus } from "@/lib/server/chatBackgroundJob";
import { getConversation } from "@/app/api/conversations/data";
import { getBackgroundJobByResponseId, updateBackgroundJobByResponseId } from "@/lib/server/chatBackgroundJobStore";

// O Grok saiu do chat em 2026-10-13: nenhum job xAI novo nasce. Este módulo só
// finaliza os jobs que ficaram persistidos (cancelamento e recuperação).

type Binding = { responseId: string; conversationId: string; assistantMessageId: string };
const runtimeKey = "__gauchoChatXaiBackgroundTransitionsV3";
const transitions = ((globalThis as typeof globalThis & { [runtimeKey]?: Map<string, Promise<unknown>> })[runtimeKey] ??= new Map());

/** Serializa transições do mesmo job, sem segurar lock de arquivo durante a rede. */
async function transition<T>(id: string, action: () => Promise<T>): Promise<T> {
  const previous = transitions.get(id) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(action);
  transitions.set(id, current);
  try { return await current; }
  finally { if (transitions.get(id) === current) transitions.delete(id); }
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

function terminal(id: string, status: "cancelled" | "incomplete", error?: string) {
  return { id, status, error: error ? { message: error } : null, output: [] } as unknown as OpenAI.Responses.Response;
}

async function finish(binding: Binding, response: OpenAI.Responses.Response, interrupted = false) {
  return transition(binding.responseId, async () => {
    const job = await boundJob(binding);
    if (!job) return null;
    if (job.status !== "queued" && job.status !== "in_progress") return currentMessage(binding);
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
      ...(interrupted ? { streamStatus: "interrupted" as const } : {}),
    });
    await updateBackgroundJobByResponseId(binding.responseId, {
      status: message?.backgroundJob?.status ?? (message ? toBackgroundJobStatus(response.status) : "failed"),
      lastSyncedAt: new Date().toISOString(),
      error: message ? response.error?.message : "Mensagem vinculada não encontrada.",
    });
    return message;
  });
}

export async function cancelXAIBackgroundJob(binding: Binding) {
  return finish(binding, terminal(binding.responseId, "cancelled"));
}

export async function recoverInterruptedXAIBackgroundJob(binding: Binding) {
  return finish(binding, terminal(binding.responseId, "incomplete",
    "Execução Grok interrompida por reinício do servidor; não foi repetida automaticamente."), true);
}
