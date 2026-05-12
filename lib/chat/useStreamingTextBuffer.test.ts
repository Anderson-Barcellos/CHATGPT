import { describe, expect, it } from "vitest";
import {
  computeInitialDisplayed,
  getStreamingBufferStepDelay,
  getStreamingBufferStepSize,
} from "@/lib/chat/useStreamingTextBuffer";

describe("streaming buffer timing", () => {
  it("matches the STT step-size thresholds", () => {
    expect(getStreamingBufferStepSize(500)).toBe(20);
    expect(getStreamingBufferStepSize(300)).toBe(12);
    expect(getStreamingBufferStepSize(180)).toBe(7);
    expect(getStreamingBufferStepSize(100)).toBe(4);
    expect(getStreamingBufferStepSize(40)).toBe(2);
    expect(getStreamingBufferStepSize(10)).toBe(1);
    expect(getStreamingBufferStepSize(0)).toBe(1);
  });

  it("matches the STT step-delay thresholds", () => {
    expect(getStreamingBufferStepDelay(500)).toBe(18);
    expect(getStreamingBufferStepDelay(300)).toBe(22);
    expect(getStreamingBufferStepDelay(180)).toBe(28);
    expect(getStreamingBufferStepDelay(100)).toBe(34);
    expect(getStreamingBufferStepDelay(40)).toBe(42);
    expect(getStreamingBufferStepDelay(10)).toBe(56);
    expect(getStreamingBufferStepDelay(0)).toBe(56);
  });

  it("keeps bigger chunks paired with shorter delays", () => {
    const regimes = [500, 300, 180, 100, 40, 10];
    const sizes = regimes.map(getStreamingBufferStepSize);
    const delays = regimes.map(getStreamingBufferStepDelay);

    for (let i = 0; i < sizes.length - 1; i += 1) {
      expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i + 1]);
      expect(delays[i]).toBeLessThanOrEqual(delays[i + 1]);
    }
  });
});

describe("computeInitialDisplayed", () => {
  it("returns empty string while stream is in progress", () => {
    expect(computeInitialDisplayed("Hello", "streaming")).toBe("");
  });

  it("returns full content for terminal stream states", () => {
    expect(computeInitialDisplayed("Hello", "completed")).toBe("Hello");
    expect(computeInitialDisplayed("Hello", "interrupted")).toBe("Hello");
    expect(computeInitialDisplayed("Hello", "aborted")).toBe("Hello");
    expect(computeInitialDisplayed("Hello", "failed")).toBe("Hello");
  });

  it("returns full content when stream status is undefined", () => {
    expect(computeInitialDisplayed("Hello", undefined)).toBe("Hello");
  });

  it("documents the buffer-restart hazard: a remount mid-stream resets the buffer", () => {
    // Cenário do bug: o componente já estava streaming "Hello world.",
    // mas remonta por mudança estrutural na árvore JSX (ex: richContent
    // flippa de false→true em MessageContent). Como streamStatus ainda
    // é "streaming", o buffer reinicializa em "" mesmo com content cheio.
    //
    // Por isso o consumer precisa garantir identidade estável do
    // componente via key prop (ver MessageContent.tsx → renderMessageText).
    const fullContent = "Hello world. This response was already mid-stream.";
    expect(computeInitialDisplayed(fullContent, "streaming")).toBe("");
  });
});
