import { expect, it } from "vitest";
import { inferChatModelProvider } from "./chatModelCatalog";

it.each(["gemini-4-neon", "gemini-4-hydrogen", "gemini-4-argon", "gemini-3.8-flash"])(
  "reconhece %s como modelo de chat do Google",
  (id) => expect(inferChatModelProvider(id)).toBe("google"),
);

it.each([
  "gemini-3.5-transcribe",
  "gemini-nano-banana-2.1",
  "gemini-robotics-er-2-preview",
  "gemini-2.5-computer-use-preview-10-2025",
  "gemini-3.1-pro-preview-customtools",
  "gemini-embedding-001",
  "gemini-2.5-flash-preview-tts",
  "gemini-2.5-flash-image",
  "gemini-live-2.5-flash",
])("recusa %s, que não é modelo de chat", (id) => {
  expect(inferChatModelProvider(id)).toBeUndefined();
});

it("mantém OpenAI e Anthropic como antes", () => {
  expect(inferChatModelProvider("gpt-6.2-sol")).toBe("openai");
  expect(inferChatModelProvider("claude-opus-5-5")).toBe("anthropic");
  expect(inferChatModelProvider("llama-4")).toBeUndefined();
});
