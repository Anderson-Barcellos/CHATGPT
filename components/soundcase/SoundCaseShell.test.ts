import { describe, expect, it, vi } from "vitest";
import { prepareSoundCaseRealtimeGeneration } from "@/components/soundcase/SoundCaseShell";

describe("SoundCase generation handoff", () => {
  it("stops the previous Realtime session before priming the next user gesture", () => {
    const order: string[] = [];
    const stop = vi.fn(() => order.push("stop"));
    const prime = vi.fn(() => order.push("prime"));

    prepareSoundCaseRealtimeGeneration(stop, prime);

    expect(order).toEqual(["stop", "prime"]);
  });
});
