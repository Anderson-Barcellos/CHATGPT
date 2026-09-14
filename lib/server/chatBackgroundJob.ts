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
}) {
  const { conversationId, assistantMessageId, response } = params;
  const now = new Date().toISOString();
  const status = toBackgroundJobStatus(response.status);
  let updatedMessage: Message | undefined;

  // Mutação dentro do lock do arquivo: o autosave do cliente pode gravar
  // mensagens novas entre a leitura e a escrita (B6).
  await patchConversationMessages(conversationId, (current) => {
    updatedMessage = undefined;
    const messages = current.map((message) => {
    if (message.id !== assistantMessageId) return message;

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
      backgroundJob: {
        ...message.backgroundJob,
        responseId: response.id,
        status,
        startedAt: message.backgroundJob?.startedAt ?? now,
        updatedAt: now,
        ...(response.error?.message ? { error: response.error.message } : {}),
        ...(response.status === "incomplete"
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
