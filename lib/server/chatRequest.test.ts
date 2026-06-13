import { describe, expect, it } from "vitest";
import { buildResponseCreateParams } from "./chatRequest";

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

  it.each(["document", "deepsearch_medium", "deepsearch_high"] as const)(
    "does not expose image generation in %s mode",
    (responseMode) => {
      const toolTypes = toolTypesFor(responseMode);

      expect(toolTypes).not.toContain("image_generation");
      expect(toolTypes).toContain("web_search_preview");
    }
  );

  it("removes all tools in quiz mode", () => {
    expect(toolTypesFor("quiz")).toEqual([]);
  });
});
