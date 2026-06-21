import { describe, expect, it } from "vitest";
import { MEMORY_TOOL_NAMES, buildResponseCreateParams } from "./chatRequest";

function toolTypesFor(responseMode: "default" | "document" | "deepsearch_medium" | "deepsearch_high" | "quiz") {
  const params = buildResponseCreateParams({
    input: [{ role: "user", content: "Teste" }],
    responseMode,
  });

  return (params.tools ?? []).map((tool) => tool.type);
}

describe("buildResponseCreateParams", () => {
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
});
