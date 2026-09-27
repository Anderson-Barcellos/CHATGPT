import { describe, expect, it } from "vitest";
import { resolveDocumentFallbackProfile } from "./documentConfig";

describe("Documento fallback profile", () => {
  it.each(["deepseek-v4-pro", "gemini-3.8-flash"])(
    "troca %s por GPT-6 Luna com reasoning medium",
    (model) => {
      expect(resolveDocumentFallbackProfile(model)).toEqual({
        model: "gpt-6-luna",
        reasoningEffort: "medium",
      });
    }
  );

  it.each(["gpt-6-luna", "gpt-6-sol", "grok-4.7"])("mantém o modelo do chat (%s)", (model) => {
    expect(resolveDocumentFallbackProfile(model)).toBeNull();
  });
});
