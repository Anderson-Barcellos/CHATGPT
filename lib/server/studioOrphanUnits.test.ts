import { describe, expect, it } from "vitest";
import {
  STUDIO_TRANSIENT_UNIT_PATTERNS,
  stopOrphanedStudioUnits,
} from "@/lib/server/studioOrphanUnits";

describe("stopOrphanedStudioUnits", () => {
  it("stops and resets every transient Studio unit pattern at boot", async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const execImpl = async (command: string, args: string[]) => {
      calls.push({ command, args });
      return { stdout: "", stderr: "" };
    };

    await stopOrphanedStudioUnits(execImpl);

    expect(STUDIO_TRANSIENT_UNIT_PATTERNS).toEqual([
      "gaucho-studio-run-*.service",
      "gaucho-studio-term-*.service",
      "gaucho-studio-kernel-*.service",
    ]);
    expect(calls.map((call) => [call.command, call.args[0]])).toEqual([
      ["systemctl", "stop"],
      ["systemctl", "reset-failed"],
    ]);
    for (const call of calls) {
      expect(call.args.slice(1)).toEqual(STUDIO_TRANSIENT_UNIT_PATTERNS);
    }
  });

  it("never throws when systemctl is unavailable", async () => {
    const execImpl = async () => {
      throw new Error("ENOENT");
    };
    await expect(stopOrphanedStudioUnits(execImpl)).resolves.toBeUndefined();
  });
});
