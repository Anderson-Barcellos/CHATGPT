import { describe, expect, it } from "vitest";
import {
  assistantStreamStateToMessagePatch,
  createInitialAssistantStreamState,
  extractSsePayloads,
  finalizeAssistantStreamState,
  reduceAssistantStreamEvent,
} from "@/lib/chat/streamMachine";

describe("stream machine", () => {
  it("reduces text, citations, reasoning and tool state consistently", () => {
    let state = createInitialAssistantStreamState(true);

    state = reduceAssistantStreamEvent(state, {
      type: "response.output_text.delta",
      delta: "Ola",
    });
    state = reduceAssistantStreamEvent(state, {
      type: "response.output_text.annotation.added",
      annotation: {
        type: "url_citation",
        title: "Fonte",
        url: "https://example.com",
      },
    });
    state = reduceAssistantStreamEvent(state, {
      type: "response.output_text.annotation.added",
      annotation: {
        type: "url_citation",
        title: "Fonte duplicada",
        url: "https://example.com",
      },
    });
    state = reduceAssistantStreamEvent(state, {
      type: "response.reasoning_summary_text.delta",
      delta: "Resumo",
    });
    state = reduceAssistantStreamEvent(state, {
      type: "response.output_item.added",
      item: { type: "web_search_call" },
    });
    state = reduceAssistantStreamEvent(state, {
      type: "response.output_item.added",
      item: { type: "image_generation_call" },
    });
    state = reduceAssistantStreamEvent(state, {
      type: "response.image_generation_call.partial_image",
      partial_image_b64: "base64-preview",
    });

    expect(state.content).toBe("Ola");
    expect(state.reasoningSummary).toBe("Resumo");
    expect(state.reasoningStatus).toBe("thinking");
    expect(state.citations).toEqual([
      { title: "Fonte", url: "https://example.com" },
    ]);
    expect(state.isSearching).toBe(true);
    expect(state.isGeneratingImage).toBe(true);
    expect(state.imageBase64).toBe("base64-preview");

    state = reduceAssistantStreamEvent(state, {
      type: "response.output_item.done",
      item: { type: "web_search_call" },
    });
    state = reduceAssistantStreamEvent(state, {
      type: "response.output_item.done",
      item: { type: "image_generation_call", result: "final-image" },
    });
    state = finalizeAssistantStreamState(state, "completed", true);

    expect(state.isSearching).toBe(false);
    expect(state.isGeneratingImage).toBe(false);
    expect(state.reasoningStatus).toBe("complete");
    expect(assistantStreamStateToMessagePatch(state)).toMatchObject({
      content: "Ola",
      imageBase64: "final-image",
      imageMimeType: "image/png",
      reasoningSummary: "Resumo",
      reasoningStatus: "complete",
      streamStatus: "completed",
      isSearching: false,
      isGeneratingImage: false,
    });
  });

  it("extracts SSE payloads and preserves incomplete trailing buffer", () => {
    const payloadA = JSON.stringify({
      type: "response.output_text.delta",
      delta: "A",
    });
    const payloadB = JSON.stringify({
      type: "response.output_text.delta",
      delta: "B",
    });

    const extraction = extractSsePayloads(
      `data: ${payloadA}\n\ndata: ${payloadB}\n\ndata: {"type":"partial"`
    );

    expect(extraction.payloads).toEqual([payloadA, payloadB]);
    expect(extraction.buffer).toBe('data: {"type":"partial"');
  });
});
