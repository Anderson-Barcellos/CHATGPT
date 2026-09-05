import { describe, expect, it } from "vitest";
import {
  DEFAULT_CHAT_MODEL,
  MEMORY_TOOL_NAMES,
  buildResponseCreateParams,
  resolveRequestedModel,
} from "./chatRequest";

function toolTypesFor(responseMode: "default" | "document" | "deepsearch_medium" | "deepsearch_high" | "quiz") {
  const params = buildResponseCreateParams({
    input: [{ role: "user", content: "Teste" }],
    responseMode,
  });

  return (params.tools ?? []).map((tool) => tool.type);
}

describe("buildResponseCreateParams", () => {
  it("uses GPT-5.6 Luna as the API default", () => {
    expect(DEFAULT_CHAT_MODEL).toBe("gpt-5.6-luna");
    expect(buildResponseCreateParams({ input: [{ role: "user", content: "Oi" }] }).model)
      .toBe("gpt-5.6-luna");
  });

  it("passes GPT-5.6 Pro mode and max effort to the Responses API", () => {
    const params = buildResponseCreateParams({
      input: [{ role: "user", content: "Teste" }],
      model: "gpt-5.6-sol",
      reasoning: { mode: "pro", effort: "max", summary: "detailed" },
    });

    expect(params.reasoning).toEqual({
      mode: "pro",
      effort: "max",
      summary: "detailed",
    });
  });

  it("strips unsupported Pro mode and max effort from older models", () => {
    const params = buildResponseCreateParams({
      input: [{ role: "user", content: "Teste" }],
      model: "gpt-5.4",
      reasoning: { mode: "pro", effort: "max", summary: "detailed" },
    });

    expect(params.reasoning).toEqual({ summary: "detailed" });
  });
  it("keeps image generation available in default chat mode", () => {
    expect(toolTypesFor("default")).toContain("image_generation");
  });

  it("only requests partial images for streaming responses", () => {
    const streamingParams = buildResponseCreateParams({
      input: [{ role: "user", content: "Gera uma imagem" }],
      responseMode: "default",
      stream: true,
    });
    const nonStreamingParams = buildResponseCreateParams({
      input: [{ role: "user", content: "Gera uma imagem" }],
      responseMode: "default",
      stream: false,
    });

    const streamingImageTool = streamingParams.tools?.find(
      (tool) => tool.type === "image_generation"
    );
    const nonStreamingImageTool = nonStreamingParams.tools?.find(
      (tool) => tool.type === "image_generation"
    );

    expect(streamingImageTool).toMatchObject({ partial_images: 2 });
    expect(nonStreamingImageTool).not.toHaveProperty("partial_images");
  });

  it("exposes memory function tools only in default chat mode", () => {
    const params = buildResponseCreateParams({
      input: [{ role: "user", content: "Lembra disso pra mim." }],
      responseMode: "default",
    });

    const functionToolNames = (params.tools ?? [])
      .filter((tool) => tool.type === "function")
      .map((tool) => tool.name);

    expect(functionToolNames).toEqual([
      MEMORY_TOOL_NAMES.remember,
      MEMORY_TOOL_NAMES.search,
    ]);
  });

  it.each(["document", "deepsearch_medium", "deepsearch_high"] as const)(
    "does not expose image generation in %s mode",
    (responseMode) => {
      const toolTypes = toolTypesFor(responseMode);

      expect(toolTypes).not.toContain("image_generation");
      expect(toolTypes).toContain("web_search_preview");
      expect(toolTypes).not.toContain("function");
    }
  );

  it("removes all tools in quiz mode", () => {
    expect(toolTypesFor("quiz")).toEqual([]);
  });

  it("maps chat latest aliases to the supported Chat Latest model", () => {
    expect(resolveRequestedModel("gpt-chat-latest")).toBe("chat-latest");
    expect(resolveRequestedModel("gpt-5-chat-latest")).toBe("chat-latest");
    expect(resolveRequestedModel("chat-latest")).toBe("chat-latest");
  });

  it("allows DeepSeek V4 Pro as a selectable chat model", () => {
    expect(resolveRequestedModel("deepseek-v4-pro")).toBe("deepseek-v4-pro");
  });

  it("allows GPT-5.6 Terra as a selectable chat model", () => {
    expect(resolveRequestedModel("gpt-5.6-terra")).toBe("gpt-5.6-terra");
  });

  it("forces GPT-6 Astra reasoning and verbosity to medium", () => {
    const params = buildResponseCreateParams({
      input: [{ role: "user", content: "Teste" }],
      model: "gpt-6-astra",
      reasoning: { effort: "max", summary: "detailed" },
      verbosity: "high",
    });

    expect(params.reasoning).toEqual({ effort: "medium", summary: "detailed" });
    expect(params.text).toMatchObject({ verbosity: "medium" });
  });

  it("applies GPT-6 Astra fixed controls when the client omits them", () => {
    const params = buildResponseCreateParams({
      input: [{ role: "user", content: "Teste" }],
      model: "gpt-6-astra",
    });

    expect(params.reasoning).toEqual({ effort: "medium" });
    expect(params.text).toMatchObject({ verbosity: "medium" });
  });

  it("maps the previous Gemini Flash id to Gemini 3.8 Flash", () => {
    expect(resolveRequestedModel("gemini-3.7-flash")).toBe("gemini-3.8-flash");
  });
});
