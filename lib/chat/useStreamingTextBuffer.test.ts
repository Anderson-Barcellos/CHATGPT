import { describe, expect, it } from "vitest";
import {
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
    expect(getStreamingBufferStepDelay(500)).toBe(14);
    expect(getStreamingBufferStepDelay(300)).toBe(18);
    expect(getStreamingBufferStepDelay(180)).toBe(22);
    expect(getStreamingBufferStepDelay(100)).toBe(28);
    expect(getStreamingBufferStepDelay(40)).toBe(36);
    expect(getStreamingBufferStepDelay(10)).toBe(48);
    expect(getStreamingBufferStepDelay(0)).toBe(48);
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
