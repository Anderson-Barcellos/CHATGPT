import { describe, expect, it } from "vitest";
import {
  DEFAULT_PERSONA,
  hydratePersona,
  normalizePersonaUpdate,
} from "@/lib/persona/persona";

describe("persona helpers", () => {
  it("saves the chat override alongside existing settings and preserves it during other saves", () => {
    const current = hydratePersona({
      ...DEFAULT_PERSONA,
      importedBiography: "Biografia sintética",
      responsePreferences: "Preferência legada",
      customSystemInstructions: "Regra legada",
    });
    const first = normalizePersonaUpdate(current, { chatInstructions: "Bah, que peleia!" });
    if (!first.ok) throw new Error(first.error);
    const reloaded = hydratePersona(first.data);
    const second = normalizePersonaUpdate(reloaded, { contextAboutUser: "Contexto novo" });
    expect(second).toMatchObject({
      ok: true,
      data: {
        chatInstructions: "Bah, que peleia!",
        responsePreferences: "Preferência legada",
        customSystemInstructions: "Regra legada",
        importedBiography: "Biografia sintética",
        contextAboutUser: "Contexto novo",
        ttsPreferences: current.ttsPreferences,
      },
    });
    expect(normalizePersonaUpdate(reloaded, { chatInstructions: [] })).toMatchObject({ ok: false });
  });

  it("rejects a stale edit and accepts an explicit empty prompt for the current revision", () => {
    const current = hydratePersona({ ...DEFAULT_PERSONA, chatInstructions: "Versão salva" });
    expect(normalizePersonaUpdate(current, {
      chatInstructions: "Versão obsoleta",
      previousChatInstructions: null,
    })).toMatchObject({ ok: false, status: 409 });
    expect(normalizePersonaUpdate(current, {
      chatInstructions: "",
      previousChatInstructions: "Versão salva",
    })).toMatchObject({ ok: true, data: { chatInstructions: "" } });
  });

  it("round-trips TTS preferences without dropping voice settings", () => {
    const current = hydratePersona({
      ...DEFAULT_PERSONA,
      contextAboutUser: "Anders",
      ttsPreferences: {
        model: "gpt-4o-mini-tts",
        voice: "marin",
        speed: 1,
        instructions: "",
        mode: "turbo",
        format: "flac",
      },
    });

    const update = normalizePersonaUpdate(current, {
      ttsPreferences: {
        model: "gpt-4o-mini-tts",
        voice: "ash",
        speed: 1.15,
        instructions: "Fale com tom natural e calmo.",
        mode: "balanced",
        format: "wav",
      },
    });

    expect(update.ok).toBe(true);
    if (!update.ok) return;

    const reloaded = hydratePersona(update.data);
    expect(reloaded.contextAboutUser).toBe("Anders");
    expect(reloaded.ttsPreferences).toMatchObject({
      voice: "ash",
      speed: 1.15,
      instructions: "Fale com tom natural e calmo.",
      mode: "balanced",
      format: "wav",
    });
  });

  it("rejects malformed TTS preference payloads", () => {
    const update = normalizePersonaUpdate(DEFAULT_PERSONA, {
      ttsPreferences: "ash",
    });

    expect(update).toEqual({
      ok: false,
      error: "ttsPreferences must be an object",
    });
  });
});
