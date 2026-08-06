import { describe, expect, it } from "vitest";
import {
  consumeStudioAssistantStream,
  StudioAssistantStreamInterruptedError,
} from "@/lib/studio/assistantStream";

function streamFrom(chunks: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

describe("Studio assistant SSE", () => {
  it("requires the explicit DONE terminal before completing", async () => {
    const stream = streamFrom([
      'data: {"type":"response.output_text.delta","delta":"parcial"}\n\n',
    ]);

    await expect(consumeStudioAssistantStream(stream)).rejects.toMatchObject({
      name: "StudioAssistantStreamInterruptedError",
      partialContent: "parcial",
    });
  });

  it("returns accumulated text only after DONE", async () => {
    const deltas: string[] = [];
    const stream = streamFrom([
      'data: {"type":"response.output_text.delta","delta":"res"}\n\n',
      'data: {"type":"response.output_text.delta","delta":"posta"}\n\n',
      "data: [DONE]\n\n",
    ]);

    await expect(
      consumeStudioAssistantStream(stream, (content) => deltas.push(content))
    ).resolves.toBe("resposta");
    expect(deltas).toEqual(["res", "resposta"]);
    expect(StudioAssistantStreamInterruptedError).toBeTypeOf("function");
  });
});
