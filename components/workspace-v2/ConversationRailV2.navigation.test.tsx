// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConversationRailV2 } from "@/components/workspace-v2/ConversationRailV2";
import { useChatStore } from "@/stores/chatStore";

const conversation = {
  id: "active-conversation",
  title: "Conversa ativa",
  messages: [],
  createdAt: new Date("2026-09-11T12:00:00.000Z"),
  updatedAt: new Date("2026-09-11T12:00:00.000Z"),
};

vi.mock("@/hooks/useConversations", () => ({
  useConversations: () => ({
    conversations: [conversation],
    isLoading: false,
    error: null,
    createConversation: vi.fn(),
    deleteConversation: vi.fn(),
  }),
}));

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = (query: string) =>
    ({
      matches: query.includes("767px"),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
  useChatStore.setState({ activeConversationId: conversation.id, isStreaming: false });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("ConversationRailV2 mobile navigation", () => {
  it("closes the rail when the active conversation is selected again", async () => {
    const onClose = vi.fn();
    await act(async () => {
      root.render(<ConversationRailV2 onOpenSettings={() => undefined} onClose={onClose} />);
    });

    const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes(conversation.title)
    );
    expect(button).toBeDefined();

    await act(async () => button!.click());

    expect(onClose).toHaveBeenCalledOnce();
  });
});
