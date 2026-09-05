// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConversationRailV2 } from "@/components/workspace-v2/ConversationRailV2";
import { MOBILE_BREAKPOINT } from "@/lib/layout/breakpoints";
import { useUIStore } from "@/stores/uiStore";

vi.mock("@/hooks/useConversations", () => ({
  useConversations: () => ({
    conversations: [],
    isLoading: false,
    error: null,
    createConversation: vi.fn(),
    deleteConversation: vi.fn(),
  }),
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function stubMatchMedia(mobile: boolean) {
  window.matchMedia = (query: string) =>
    ({
      matches: mobile && query.includes(`${MOBILE_BREAKPOINT - 1}px`),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

async function settle(ms = 5) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

function soundCaseLink(): HTMLAnchorElement {
  const link = document.querySelector<HTMLAnchorElement>('a[href="/soundcase"]');
  if (!link) throw new Error("SoundCase link not rendered");
  return link;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  useUIStore.getState().closeSoundCasePanel();
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

describe("ConversationRailV2 SoundCase entry", () => {
  it("opens the side panel instead of navigating on mobile", async () => {
    stubMatchMedia(true);
    await act(async () => {
      root!.render(createElement(ConversationRailV2, { onOpenSettings: () => undefined }));
    });
    await settle();

    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    await act(async () => {
      soundCaseLink().dispatchEvent(event);
    });
    await settle();

    expect(event.defaultPrevented).toBe(true);
    expect(useUIStore.getState().soundCasePanelOpen).toBe(true);
  });

  it("keeps route navigation on desktop", async () => {
    stubMatchMedia(false);
    await act(async () => {
      root!.render(createElement(ConversationRailV2, { onOpenSettings: () => undefined }));
    });
    await settle();

    // O React já anexou seu handler no container; este roda depois e evita que o
    // jsdom tente navegar de verdade — o que importa é o painel seguir fechado.
    container!.addEventListener("click", (event) => event.preventDefault());

    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    await act(async () => {
      soundCaseLink().dispatchEvent(event);
    });
    await settle();

    expect(useUIStore.getState().soundCasePanelOpen).toBe(false);
  });
});
