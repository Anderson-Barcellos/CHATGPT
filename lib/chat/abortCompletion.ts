import type { Message } from "@/types";
import {
  assistantStreamStateToMessagePatch,
  finalizeAssistantStreamState,
  type AssistantStreamState,
} from "@/lib/chat/streamMachine";

export const CANCELED_GENERATION_MESSAGE = "Geração cancelada.";
export const INTERRUPTED_GENERATION_MESSAGE = "Resposta interrompida — recarregue para regenerar.";

export function buildAbortedAssistantMessagePatch(
  streamState: AssistantStreamState,
  usesReasoning: boolean
): Partial<Message> {
  const patch = assistantStreamStateToMessagePatch(
    finalizeAssistantStreamState(streamState, "aborted", usesReasoning)
  );

  if (streamState.content.trim().length > 0) {
    return patch;
  }

  return {
    ...patch,
    content: CANCELED_GENERATION_MESSAGE,
  };
}

export function buildInterruptedAssistantMessagePatch(
  streamState: AssistantStreamState,
  usesReasoning: boolean
): Partial<Message> {
  const patch = assistantStreamStateToMessagePatch(
    finalizeAssistantStreamState(streamState, "interrupted", usesReasoning)
  );

  if (streamState.content.trim().length > 0) {
    return patch;
  }

  return {
    ...patch,
    content: INTERRUPTED_GENERATION_MESSAGE,
  };
}
