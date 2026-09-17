import {
  createInitialAssistantStreamState,
  extractSsePayloads,
  finalizeAssistantStreamState,
  reduceAssistantStreamEvent,
  type AssistantStreamEvent,
  type AssistantStreamState,
} from "@/lib/chat/streamMachine";

export type StudioAssistantStreamUpdate = Pick<
  AssistantStreamState,
  "content" | "citations" | "isSearching" | "didSearch"
>;

function toStudioUpdate(
  state: AssistantStreamState
): StudioAssistantStreamUpdate {
  return {
    content: state.content,
    citations: state.citations,
    isSearching: state.isSearching,
    didSearch: state.didSearch,
  };
}

export class StudioAssistantStreamInterruptedError extends Error {
  readonly partialContent: string;
  readonly partialUpdate: StudioAssistantStreamUpdate;

  constructor(partialUpdate: StudioAssistantStreamUpdate) {
    super("A resposta do Studio foi interrompida antes da confirmação final.");
    this.name = "StudioAssistantStreamInterruptedError";
    this.partialContent = partialUpdate.content;
    this.partialUpdate = partialUpdate;
  }
}

export async function consumeStudioAssistantStream(
  stream: ReadableStream<Uint8Array>,
  onUpdate?: (update: StudioAssistantStreamUpdate) => void
): Promise<StudioAssistantStreamUpdate> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let state = createInitialAssistantStreamState(false);
  let terminalReceived = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const extraction = extractSsePayloads(buffer);
      buffer = extraction.buffer;

      for (const payload of extraction.payloads) {
        if (payload === "[DONE]") {
          terminalReceived = true;
          continue;
        }

        try {
          const event = JSON.parse(payload) as AssistantStreamEvent;
          if (event.type === "response.completed") {
            terminalReceived = true;
          }
          const nextState = reduceAssistantStreamEvent(state, event);
          if (nextState !== state) {
            state = nextState;
            onUpdate?.(toStudioUpdate(state));
          }
        } catch {
          // Um evento SSE malformado não deve derrubar o restante do stream.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!terminalReceived) {
    throw new StudioAssistantStreamInterruptedError(toStudioUpdate(state));
  }

  state = finalizeAssistantStreamState(state, "completed", false);
  const completed = toStudioUpdate(state);
  onUpdate?.(completed);
  return completed;
}
