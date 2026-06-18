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
      delta: "Ola (example.com)",
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
      type: "response.reasoning_text.delta",
      delta: "Pensando",
    });
    state = reduceAssistantStreamEvent(state, {
      type: "response.reasoning_summary_text.delta",
      delta: "Resumo",
    });
    state = reduceAssistantStreamEvent(state, {
      type: "response.reasoning_summary_text.done",
      text: "Resumo final",
    });
    state = reduceAssistantStreamEvent(state, {
      type: "response.reasoning_summary_part.added",
      part: { type: "summary_text", text: "Resumo inicial ignorado" },
    });
    state = reduceAssistantStreamEvent(state, {
      type: "response.reasoning_summary_part.done",
      part: { type: "summary_text", text: "Resumo final" },
    });
    state = reduceAssistantStreamEvent(state, {
      type: "response.reasoning_text.done",
      text: "Pensando final",
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

    expect(state.content).toBe("Ola (example.com)");
    expect(state.reasoningText).toBe("Pensando final");
    expect(state.reasoningSummary).toBe("Resumo final");
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
      content: "Ola [1]",
      imageBase64: "final-image",
      imageMimeType: "image/png",
      reasoningText: "Pensando final",
      reasoningSummary: "Resumo final",
      reasoningStatus: "complete",
      streamStatus: "completed",
      isSearching: false,
      isGeneratingImage: false,
    });
  });

  it("captures a reasoning summary that arrives only as a done event", () => {
    let state = createInitialAssistantStreamState(true);

    state = reduceAssistantStreamEvent(state, {
      type: "response.reasoning_summary_text.done",
      text: "Resumo completo sem delta",
    });
    state = finalizeAssistantStreamState(state, "completed", true);

    expect(assistantStreamStateToMessagePatch(state)).toMatchObject({
      reasoningSummary: "Resumo completo sem delta",
      reasoningStatus: "complete",
    });
  });

  it("captures a reasoning summary that arrives only as a completed part", () => {
    let state = createInitialAssistantStreamState(true);

    state = reduceAssistantStreamEvent(state, {
      type: "response.reasoning_summary_part.done",
      part: { type: "summary_text", text: "Resumo por parte finalizada" },
    });
    state = finalizeAssistantStreamState(state, "completed", true);

    expect(assistantStreamStateToMessagePatch(state)).toMatchObject({
      reasoningSummary: "Resumo por parte finalizada",
      reasoningStatus: "complete",
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
