import { describe, expect, it } from "vitest";
import {
  DEFAULT_OPENAI_LIVE_SETTINGS,
  normalizeOpenAILiveSettings,
  OPENAI_LIVE_VOICES,
  openAILivePaceInstruction,
} from "@/lib/tts/openaiLiveSpeech";

describe("ajustes da leitura OpenAI Live", () => {
  it("oferece Marin como padrão e as vozes brasileiras documentadas", () => {
    expect(DEFAULT_OPENAI_LIVE_SETTINGS).toEqual({ voice: "marin", pace: "natural" });
    expect(OPENAI_LIVE_VOICES.map(({ id }) => id)).toEqual(["marin", "bossa", "tempo"]);
  });

  it("aceita só voz e ritmo conhecidos, voltando ao padrão no resto", () => {
    expect(normalizeOpenAILiveSettings({ voice: "bossa", pace: "calmo" })).toEqual({ voice: "bossa", pace: "calmo" });
    expect(normalizeOpenAILiveSettings({ voice: "voz-inventada", pace: "turbo" })).toEqual(DEFAULT_OPENAI_LIVE_SETTINGS);
    expect(normalizeOpenAILiveSettings("lixo")).toEqual(DEFAULT_OPENAI_LIVE_SETTINGS);
    expect(normalizeOpenAILiveSettings(null)).toEqual(DEFAULT_OPENAI_LIVE_SETTINGS);
  });

  it("traduz o ritmo em pedido de leitura sem mexer no ritmo natural", () => {
    expect(openAILivePaceInstruction("natural")).toBe("");
    expect(openAILivePaceInstruction("calmo")).toMatch(/devagar/i);
    expect(openAILivePaceInstruction("agil")).toMatch(/rápido/i);
  });
});
