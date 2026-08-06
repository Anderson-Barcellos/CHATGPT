import { afterEach, describe, expect, it, vi } from "vitest";
import { runCompiledStudioModule } from "@/lib/studio/runner";

class FakeWorker {
  static latest: FakeWorker | null = null;
  readonly listeners = new Map<string, Array<(event: unknown) => void>>();
  terminated = false;

  constructor() {
    FakeWorker.latest = this;
  }

  addEventListener(type: string, listener: (event: unknown) => void) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  postMessage() {}

  terminate() {
    this.terminated = true;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  FakeWorker.latest = null;
});

describe("Studio local runner", () => {
  it("rejects relative imports with the v1 limitation instead of a blob error", async () => {
    const result = await runCompiledStudioModule(
      'import { soma } from "./soma.js"; soma();'
    );

    expect(result.status).toBe("failed");
    expect(result.entries[0]?.text).toContain("imports entre arquivos");
  });

  it("terminates the worker when the caller aborts", async () => {
    vi.stubGlobal("window", globalThis);
    vi.stubGlobal("Worker", FakeWorker);
    const controller = new AbortController();

    const resultPromise = runCompiledStudioModule("console.log('ok')", {
      signal: controller.signal,
      timeoutMs: 5_000,
    });
    controller.abort();

    await expect(resultPromise).resolves.toMatchObject({ status: "aborted" });
    expect(FakeWorker.latest?.terminated).toBe(true);
  });
});
