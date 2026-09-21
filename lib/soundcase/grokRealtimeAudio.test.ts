import { describe, expect, it } from "vitest";
import { decodePcm16 } from "@/lib/soundcase/grokRealtimeAudio";

describe("PCM Grok Realtime", () => {
  it("decodes little-endian PCM16 without exposing a provider format to the UI", () => {
    const bytes = new Uint8Array([0, 128, 0, 0, 255, 127]).buffer;
    expect(Array.from(decodePcm16(bytes))).toEqual([-1, 0, 32767 / 32768]);
  });
});
