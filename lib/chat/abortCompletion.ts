import type { Message } from "@/types";
import {
  assistantStreamStateToMessagePatch,
  finalizeAssistantStreamState,
  type AssistantStreamState,
} from "@/lib/chat/streamMachine";

export const CANCELED_GENERATION_MESSAGE = "Geração cancelada.";

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
