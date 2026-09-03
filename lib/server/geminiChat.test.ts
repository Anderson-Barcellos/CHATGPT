import { describe, expect, it } from "vitest";
import type { ChatRequestBody } from "@/lib/server/chatRequest";
import {
  GEMINI_MODEL,
  buildGeminiInteractionParams,
  geminiEventToAssistantStreamEvents,
} from "@/lib/server/geminiChat";

const IMAGE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ";

describe("buildGeminiInteractionParams", () => {
  it("builds a stateless streaming interaction with native search tools", () => {
    const body: ChatRequestBody = {
      model: GEMINI_MODEL,
      input: [
        { role: "user", content: "Oi" },
        {
          role: "assistant",
          content: [
            { type: "input_text", text: "Analisa a imagem" },
            { type: "input_image", image_url: IMAGE_DATA_URL, detail: "auto" },
          ],
        },
      ],
      instructions: "Responda em portugues.",
      maxOutputTokens: 99_999,
      temperature: 0.8,
      topP: 0.95,
      reasoning: { effort: "high", summary: "detailed" },
      stream: true,
    };

    expect(buildGeminiInteractionParams(body)).toEqual({
      model: GEMINI_MODEL,
      input: [
        {
          type: "user_input",
          content: [{ type: "text", text: "Oi" }],
        },
        {
          type: "model_output",
          content: [
            { type: "text", text: "Analisa a imagem" },
            {
              type: "image",
              data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ",
              mime_type: "image/png",
            },
          ],
        },
      ],
      system_instruction: "Responda em portugues.",
      tools: [{ type: "google_search" }, { type: "url_context" }],
      stream: true,
      store: false,
      generation_config: {
        max_output_tokens: 65_536,
        thinking_level: "high",
        thinking_summaries: "auto",
      },
    });
  });

  it.each(["low", "medium", "high"] as const)(
    "maps %s reasoning directly to Gemini thinking",
    (effort) => {
      const params = buildGeminiInteractionParams({
        input: [{ role: "user", content: "Teste" }],
        reasoning: { effort },
      });

      expect(params.generation_config?.thinking_level).toBe(effort);
    }
  );

  it.each(["minimal", "max"] as const)(
    "defaults unsupported %s reasoning to medium",
    (effort) => {
    expect(
      buildGeminiInteractionParams({
        input: [{ role: "user", content: "Teste" }],
        reasoning: { effort },
      }).generation_config?.thinking_level
    ).toBe("medium");
    }
  );
});

describe("geminiEventToAssistantStreamEvents", () => {
  it("translates text, thought summaries and URL citations", () => {
    const activeSteps = new Map<number, string>();

    expect(
      geminiEventToAssistantStreamEvents(
        {
          event_type: "step.delta",
          index: 0,
          delta: { type: "text", text: "Resposta" },
        },
        activeSteps
      )
    ).toEqual([{ type: "response.output_text.delta", delta: "Resposta" }]);

    expect(
      geminiEventToAssistantStreamEvents(
        {
          event_type: "step.delta",
          index: 1,
          delta: {
            type: "thought_summary",
            content: { type: "text", text: "Plano curto" },
          },
        },
        activeSteps
      )
    ).toEqual([
      { type: "response.reasoning_summary_text.delta", delta: "Plano curto" },
    ]);

    expect(
      geminiEventToAssistantStreamEvents(
        {
          event_type: "step.delta",
          index: 2,
          delta: {
            type: "text_annotation_delta",
            annotations: [
              {
                type: "url_citation",
                title: "Google AI",
                url: "https://ai.google.dev/",
              },
            ],
          },
        },
        activeSteps
      )
    ).toEqual([
      {
        type: "response.output_text.annotation.added",
        annotation: {
          type: "url_citation",
          title: "Google AI",
          url: "https://ai.google.dev/",
        },
      },
    ]);
  });

  it("reuses the existing web-search UI state for Google Search and URL Context", () => {
    const activeSteps = new Map<number, string>();

    expect(
      geminiEventToAssistantStreamEvents(
        {
          event_type: "step.start",
          index: 4,
          step: {
            type: "google_search_call",
            id: "search-1",
            arguments: { queries: ["Gemini 3.7 Flash"] },
          },
        },
        activeSteps
      )
    ).toEqual([
      {
        type: "response.output_item.added",
        item: { type: "web_search_call" },
      },
    ]);

    expect(
      geminiEventToAssistantStreamEvents(
        { event_type: "step.stop", index: 4 },
        activeSteps
      )
    ).toEqual([
      {
        type: "response.output_item.done",
        item: { type: "web_search_call" },
      },
    ]);
  });

  it("maps Gemini usage to the current response.completed contract", () => {
    expect(
      geminiEventToAssistantStreamEvents(
        {
          event_type: "interaction.completed",
          interaction: {
            id: "interaction-1",
            status: "completed",
            usage: {
              total_input_tokens: 10,
              total_output_tokens: 20,
              total_cached_tokens: 3,
              total_thought_tokens: 7,
            },
          },
        },
        new Map()
      )
    ).toEqual([
      {
        type: "response.completed",
        response: {
          usage: {
            input_tokens: 10,
            output_tokens: 20,
            input_tokens_details: { cached_tokens: 3 },
            output_tokens_details: { reasoning_tokens: 7 },
          },
        },
      },
    ]);
  });
});
