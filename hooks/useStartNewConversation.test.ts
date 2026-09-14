// @vitest-environment jsdom
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatStore } from "@/stores/chatStore";

const mocks = vi.hoisted(() => ({
  createConversation: vi.fn(async () => "created"),
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

vi.mock("@/hooks/useConversations", () => ({
  useConversations: () => ({
    conversations: [],
    isLoading: false,
    error: null,
    createConversation: mocks.createConversation,
    deleteConversation: vi.fn(),
  }),
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));

import { useStartNewConversation } from "@/hooks/useStartNewConversation";

type Start = ReturnType<typeof useStartNewConversation>;

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let latest: Start | null = null;

function Harness({ onApi }: { onApi: (start: Start) => void }) {
  const start = useStartNewConversation();
  useEffect(() => {
    onApi(start);
  });
  return null;
}

async function mountHook() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      createElement(Harness, {
        onApi: (start: Start) => {
          latest = start;
        },
      })
    );
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.createConversation.mockClear();
  mocks.toast.info.mockClear();
  useChatStore.setState({ activeConversationId: "A", messages: [], isStreaming: false });
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
  latest = null;
});

describe("useStartNewConversation", () => {
  it("creates a conversation and activates it instead of dropping to the recovery screen", async () => {
    await mountHook();
    let id: string | null = null;
    await act(async () => {
      id = await latest!();
    });
    expect(id).toBe("created");
    expect(mocks.createConversation).toHaveBeenCalledWith("Nova conversa");
    expect(useChatStore.getState().activeConversationId).toBe("created");
  });

  it("refuses while a stream is running and keeps the active conversation", async () => {
    useChatStore.setState({ isStreaming: true });
    await mountHook();
    let id: string | null = "unset";
    await act(async () => {
      id = await latest!();
    });
    expect(id).toBeNull();
    expect(mocks.createConversation).not.toHaveBeenCalled();
    expect(mocks.toast.info).toHaveBeenCalled();
    expect(useChatStore.getState().activeConversationId).toBe("A");
  });
});
