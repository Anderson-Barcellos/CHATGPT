import { extractSsePayloads } from "@/lib/chat/streamMachine";

export class StudioAssistantStreamInterruptedError extends Error {
  readonly partialContent: string;

  constructor(partialContent: string) {
    super("A resposta do Studio foi interrompida antes da confirmação final.");
    this.name = "StudioAssistantStreamInterruptedError";
    this.partialContent = partialContent;
  }
}

export async function consumeStudioAssistantStream(
  stream: ReadableStream<Uint8Array>,
  onContent?: (content: string) => void
): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";
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
          const event = JSON.parse(payload) as {
            type?: string;
            delta?: string;
          };
          if (event.type === "response.completed") {
            terminalReceived = true;
          }
          if (
            event.type === "response.output_text.delta" &&
            typeof event.delta === "string"
          ) {
            accumulated += event.delta;
            onContent?.(accumulated);
          }
        } catch {
          // Eventos não textuais ou incompletos não entram no Studio.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!terminalReceived) {
    throw new StudioAssistantStreamInterruptedError(accumulated);
  }

  return accumulated;
}
