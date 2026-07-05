import type { Message } from "@/types";

type UpdateMessage = (id: string, updates: Partial<Message>) => void;

interface StreamPatchSchedulerOptions {
  updateMessage: UpdateMessage;
  requestAnimationFrame?: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame?: (handle: number) => void;
}

export interface StreamPatchScheduler {
  schedule: (id: string, patch: Partial<Message>) => void;
  flush: () => void;
  cancel: () => void;
}

export function createStreamPatchScheduler({
  updateMessage,
  requestAnimationFrame = (callback) =>
    typeof window === "undefined"
      ? (setTimeout(() => callback(Date.now()), 0) as unknown as number)
      : window.requestAnimationFrame(callback),
  cancelAnimationFrame = (handle) => {
    if (typeof window === "undefined") {
      clearTimeout(handle);
      return;
    }
    window.cancelAnimationFrame(handle);
  },
}: StreamPatchSchedulerOptions): StreamPatchScheduler {
  let pendingId: string | null = null;
  let pendingPatch: Partial<Message> | null = null;
  let frameId: number | null = null;

  const applyPending = () => {
    if (!pendingId || !pendingPatch) return;

    const id = pendingId;
    const patch = pendingPatch;
    pendingId = null;
    pendingPatch = null;
    updateMessage(id, patch);
  };

  const cancelFrame = () => {
    if (frameId === null) return;
    cancelAnimationFrame(frameId);
    frameId = null;
  };

  return {
    schedule(id, patch) {
      pendingId = id;
      pendingPatch = patch;

      if (frameId !== null) return;

      frameId = requestAnimationFrame(() => {
        frameId = null;
        applyPending();
      });
    },
    flush() {
      cancelFrame();
      applyPending();
    },
    cancel() {
      cancelFrame();
      pendingId = null;
      pendingPatch = null;
    },
  };
}
