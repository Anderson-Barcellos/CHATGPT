import { describe, expect, it } from "vitest";
import {
  createStudioWorkerUsage,
  parseStudioWorkerEvent,
  validateStudioModuleSource,
} from "@/lib/studio/runnerProtocol";

describe("Studio runner protocol", () => {
  it("rejects events that do not carry the private session token", () => {
    const result = parseStudioWorkerEvent(
      { token: "forged", type: "done" },
      "expected",
      createStudioWorkerUsage()
    );

    expect(result).toMatchObject({ ok: false, reason: "invalid_token" });
  });

  it("stops accepting console output after the message budget", () => {
    let usage = createStudioWorkerUsage();
    let lastResult: ReturnType<typeof parseStudioWorkerEvent> | undefined;

    for (let index = 0; index < 201; index += 1) {
      lastResult = parseStudioWorkerEvent(
        { token: "session", type: "console", level: "log", text: "x" },
        "session",
        usage
      );
      if (!lastResult.ok) break;
      usage = lastResult.usage;
    }

    expect(lastResult).toMatchObject({ ok: false, reason: "message_budget" });
  });

  it("explains that relative module imports are outside runner v1", () => {
    expect(
      validateStudioModuleSource('import { soma } from "./soma.js"; soma();')
    ).toContain("imports entre arquivos");
    expect(validateStudioModuleSource('console.log("ok")')).toBeNull();
  });
});
