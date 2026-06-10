import { describe, expect, it } from "vitest";
import {
  DEFAULT_PERSONA,
  hydratePersona,
  normalizePersonaUpdate,
} from "@/lib/persona/persona";

describe("persona helpers", () => {
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
      },
    });

    const update = normalizePersonaUpdate(current, {
      ttsPreferences: {
        model: "gpt-4o-mini-tts",
        voice: "ash",
        speed: 1.15,
        instructions: "Fale com tom natural e calmo.",
        mode: "balanced",
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
