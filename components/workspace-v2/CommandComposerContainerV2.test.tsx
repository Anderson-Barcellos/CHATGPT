// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandComposerContainerV2 } from "@/components/workspace-v2/CommandComposerContainerV2";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function settle(ms = 5) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  if (typeof window.matchMedia !== "function") {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList;
  }
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

describe("CommandComposerContainerV2 quick actions", () => {
  it("sends the quick-action text through the current sendMessage (B3)", async () => {
    const sendMessage = vi.fn(async (_content: string) => true);
    await act(async () => {
      root!.render(
        createElement(CommandComposerContainerV2, {
          sendMessage,
          stopGeneration: () => undefined,
          isLoading: false,
          error: null,
        })
      );
    });
    await settle();

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("gaucho:send-message", { detail: { text: "Continue." } })
      );
    });
    await settle(20);

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage.mock.calls[0][0]).toBe("Continue.");
  });
});
