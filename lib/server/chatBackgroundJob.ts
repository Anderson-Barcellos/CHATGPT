import type OpenAI from "openai";
import type { BackgroundJobStatus, Message, ResponseMode } from "@/types";
import { createMessageArtifact } from "@/lib/artifacts/messageArtifacts";
import { responseToMessagePatch } from "@/lib/chat/responseToMessagePatch";
import { patchConversationMessages } from "@/app/api/conversations/data";

export type BackgroundResponseMode = Extract<
  ResponseMode,
  "document" | "deepsearch_medium" | "deepsearch_high"
>;

export function isBackgroundResponseMode(
  responseMode: unknown
): responseMode is BackgroundResponseMode {
  return (
    responseMode === "document" ||
    responseMode === "deepsearch_medium" ||
    responseMode === "deepsearch_high"
  );
}

export function toBackgroundJobStatus(
  status: OpenAI.Responses.Response["status"]
): BackgroundJobStatus {
  if (status === "queued") return "queued";
  if (status === "in_progress") return "in_progress";
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  return "failed";
}

function patchForDocumentArtifact(message: Message, patch: Partial<Message>) {
  if (
    patch.streamStatus !== "completed" ||
    !isBackgroundResponseMode(message.responseMode) ||
    !patch.content?.trim()
  ) {
    return patch;
  }

  const artifact = createMessageArtifact(patch.content, {
    force: true,
    displayMode: "document",
    citations: patch.citations,
  });

  if (!artifact) return patch;

  return {
    ...patch,
    content: artifact.summary,
    artifact,
  };
}

export async function applyBackgroundResponseToConversation(params: {
  conversationId: string;
  assistantMessageId: string;
  response: OpenAI.Responses.Response;
  provider?: "openai" | "xai";
  /** Verificadas dentro do lock da conversa, depois de qualquer espera por I/O. */
  expectedResponseId?: string;
  shouldApply?: () => boolean;
  streamStatus?: Message["streamStatus"];
  preserveTerminal?: boolean;
}) {
  const { conversationId, assistantMessageId, response, provider } = params;
  const now = new Date().toISOString();
  const status = toBackgroundJobStatus(response.status);
  let updatedMessage: Message | undefined;

  // Mutação dentro do lock do arquivo: o autosave do cliente pode gravar
  // mensagens novas entre a leitura e a escrita (B6).
  await patchConversationMessages(conversationId, (current) => {
    updatedMessage = undefined;
    if (params.shouldApply && !params.shouldApply()) return null;
    const messages = current.map((message) => {
    if (message.id !== assistantMessageId) return message;
    if (params.expectedResponseId && message.backgroundJob?.responseId !== params.expectedResponseId) return message;
    if (params.preserveTerminal && message.backgroundJob &&
      ["completed", "cancelled", "failed"].includes(message.backgroundJob.status)) {
      updatedMessage = message;
      return message;
    }

    const responsePatch =
      status === "completed" || status === "failed" || status === "cancelled"
        ? patchForDocumentArtifact(message, responseToMessagePatch(response))
        : {
            streamStatus: "streaming" as const,
            isSearching: true,
            isGeneratingImage: false,
          };

    updatedMessage = {
      ...message,
      ...responsePatch,
      ...(params.streamStatus ? { streamStatus: params.streamStatus } : {}),
      backgroundJob: {
        ...message.backgroundJob,
        ...(provider ? { provider } : {}),
        responseId: response.id,
        status,
        startedAt: message.backgroundJob?.startedAt ?? now,
        updatedAt: now,
        ...(response.error?.message ? { error: response.error.message } : {}),
        ...(response.status === "incomplete" && !response.error?.message
          ? { error: "A resposta terminou incompleta antes de concluir." }
          : {}),
      },
    };

    return updatedMessage;
    });
    return updatedMessage ? messages : null;
  });

  return updatedMessage ?? null;
}
