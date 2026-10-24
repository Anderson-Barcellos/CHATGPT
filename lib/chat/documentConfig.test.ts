import { describe, expect, it } from "vitest";
import { resolveDocumentFallbackProfile } from "./documentConfig";

describe("Documento fallback profile", () => {
  it.each(["deepseek-flash", "gemini-3.8-flash", "claude-sonnet-5-5", "claude-opus-5-5"])(
    "troca %s por GPT-6 Luna com reasoning medium",
    (model) => {
      expect(resolveDocumentFallbackProfile(model)).toEqual({
        model: "gpt-6-luna",
        reasoningEffort: "medium",
      });
    }
  );

  it.each(["gpt-6-luna", "gpt-6.1-sol", "gpt-5.6-sol"])("mantém o modelo do chat (%s)", (model) => {
    expect(resolveDocumentFallbackProfile(model)).toBeNull();
  });
});
