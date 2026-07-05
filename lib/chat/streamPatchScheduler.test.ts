import { describe, expect, it, vi } from "vitest";
import { createStreamPatchScheduler } from "@/lib/chat/streamPatchScheduler";
import type { Message } from "@/types";

describe("createStreamPatchScheduler", () => {
  it("coalesces multiple scheduled patches into one update per frame", () => {
    const updateMessage = vi.fn();
    const frameCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallbacks.push(callback);
      return 1;
    });
    const cancelAnimationFrame = vi.fn();
    const scheduler = createStreamPatchScheduler({
      updateMessage,
      requestAnimationFrame,
      cancelAnimationFrame,
    });

    scheduler.schedule("assistant-1", { content: "Oi" });
    scheduler.schedule("assistant-1", { content: "Oi, Anders" });

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(updateMessage).not.toHaveBeenCalled();

    frameCallbacks[0](16);

    expect(updateMessage).toHaveBeenCalledTimes(1);
    expect(updateMessage).toHaveBeenCalledWith("assistant-1", {
      content: "Oi, Anders",
    });
  });

  it("flushes the latest pending patch synchronously", () => {
    const updateMessage = vi.fn();
    const frameCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallbacks.push(callback);
      return 7;
    });
    const cancelAnimationFrame = vi.fn();
    const scheduler = createStreamPatchScheduler({
      updateMessage,
      requestAnimationFrame,
      cancelAnimationFrame,
    });

    scheduler.schedule("assistant-1", { content: "parcial" });
    scheduler.flush();

    expect(cancelAnimationFrame).toHaveBeenCalledWith(7);
    expect(updateMessage).toHaveBeenCalledTimes(1);
    expect(updateMessage).toHaveBeenCalledWith("assistant-1", {
      content: "parcial",
    });
    expect(frameCallbacks).toHaveLength(1);

    frameCallbacks[0](32);

    expect(updateMessage).toHaveBeenCalledTimes(1);
  });

  it("cancels pending work without applying the patch", () => {
    const updateMessage = vi.fn();
    const scheduler = createStreamPatchScheduler({
      updateMessage,
      requestAnimationFrame: () => 3,
      cancelAnimationFrame: vi.fn(),
    });

    scheduler.schedule("assistant-1", {
      streamStatus: "streaming",
    } satisfies Partial<Message>);
    scheduler.cancel();

    expect(updateMessage).not.toHaveBeenCalled();
  });
});
