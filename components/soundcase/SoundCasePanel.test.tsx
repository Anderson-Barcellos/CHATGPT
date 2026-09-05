// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SoundCasePanel } from "@/components/soundcase/SoundCasePanel";
import { SoundCaseRealtimeProvider } from "@/components/soundcase/SoundCaseRealtimeProvider";
import { useUIStore } from "@/stores/uiStore";

const panelTree = () =>
  createElement(SoundCaseRealtimeProvider, null, createElement(SoundCasePanel));

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
  vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
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
  vi.unstubAllGlobals();
});

describe("SoundCasePanel", () => {
  it("stays unmounted while the panel is closed", async () => {
    await act(async () => {
      root!.render(panelTree());
    });
    await settle();

    expect(document.querySelector('[aria-label="Fechar SoundCase"]')).toBeNull();
  });

  it("opens as a right-side sheet and closes through its own header button", async () => {
    await act(async () => {
      root!.render(panelTree());
    });
    await settle();

    await act(async () => {
      useUIStore.getState().openSoundCasePanel();
    });
    await settle();

    const closeButton = document.querySelector<HTMLButtonElement>(
      '[aria-label="Fechar SoundCase"]'
    );
    expect(closeButton).not.toBeNull();

    const content = document.querySelector('[data-slot="sheet-content"]');
    expect(content?.className).toContain("gc-safe-top");

    await act(async () => {
      closeButton!.click();
    });
    await settle();

    expect(useUIStore.getState().soundCasePanelOpen).toBe(false);
  });
});
