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
      partialUpdate: { content: "parcial", isSearching: false },
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
      consumeStudioAssistantStream(stream, (update) => deltas.push(update.content))
    ).resolves.toMatchObject({ content: "resposta", isSearching: false });
    expect(deltas).toEqual(["res", "resposta", "resposta"]);
    expect(StudioAssistantStreamInterruptedError).toBeTypeOf("function");
  });

  it("preserves web-search progress and citation annotations", async () => {
    const updates: Array<{
      searching: boolean;
      citations: number;
      content: string;
    }> = [];
    const stream = streamFrom([
      'data: {"type":"response.web_search_call.searching"}\n\n',
      'data: {"type":"response.output_text.delta","delta":"Resposta (fonte.test)"}\n\n',
      'data: {"type":"response.output_text.annotation.added","annotation":{"type":"url_citation","title":"Fonte confiável","url":"https://fonte.test/artigo"}}\n\n',
      'data: {"type":"response.web_search_call.completed"}\n\n',
      "data: [DONE]\n\n",
    ]);

    const result = await consumeStudioAssistantStream(stream, (update) => {
      updates.push({
        searching: update.isSearching,
        citations: update.citations.length,
        content: update.content,
      });
    });

    expect(updates).toContainEqual({
      searching: true,
      citations: 0,
      content: "",
    });
    expect(result).toEqual({
      content: "Resposta (fonte.test)",
      citations: [
        { title: "Fonte confiável", url: "https://fonte.test/artigo" },
      ],
      isSearching: false,
      didSearch: true,
    });
  });
});
