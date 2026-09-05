// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SoundCaseRealtimeBar } from "@/components/soundcase/SoundCaseRealtimeBar";
import {
  SoundCaseRealtimeContext,
  type SoundCaseRealtimeSession,
} from "@/components/soundcase/SoundCaseRealtimeProvider";
import { useUIStore } from "@/stores/uiStore";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function makeSession(overrides: Partial<SoundCaseRealtimeSession> = {}): SoundCaseRealtimeSession {
  return {
    status: "speaking",
    activeSegmentIndex: 0,
    firstAudioMs: null,
    error: null,
    versionId: "v",
    isActive: true,
    prime: vi.fn(),
    start: vi.fn(async () => undefined),
    stop: vi.fn(),
    skipToSegment: vi.fn(async () => undefined),
    ...overrides,
  };
}

async function renderBar(session: SoundCaseRealtimeSession) {
  await act(async () => {
    root!.render(
      createElement(
        SoundCaseRealtimeContext.Provider,
        { value: session },
        createElement(SoundCaseRealtimeBar)
      )
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
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

describe("SoundCaseRealtimeBar", () => {
  it("stays hidden while nothing is playing", async () => {
    await renderBar(makeSession({ status: "idle", isActive: false }));

    expect(container!.querySelector('[data-slot="soundcase-realtime-bar"]')).toBeNull();
  });

  it("stays hidden while the panel itself is open", async () => {
    await act(async () => {
      useUIStore.getState().openSoundCasePanel();
    });
    await renderBar(makeSession());

    expect(container!.querySelector('[data-slot="soundcase-realtime-bar"]')).toBeNull();
  });

  it("shows the persistent control once the panel is closed mid-playback", async () => {
    const session = makeSession();
    await renderBar(session);

    const bar = container!.querySelector('[data-slot="soundcase-realtime-bar"]');
    expect(bar).not.toBeNull();

    const reopen = container!.querySelector<HTMLButtonElement>(
      '[aria-label="Abrir SoundCase"]'
    );
    await act(async () => {
      reopen!.click();
    });
    expect(useUIStore.getState().soundCasePanelOpen).toBe(true);
  });

  it("stops the realtime session from its own button", async () => {
    const session = makeSession();
    await renderBar(session);

    const stopButton = container!.querySelector<HTMLButtonElement>(
      '[aria-label="Parar leitura"]'
    );
    await act(async () => {
      stopButton!.click();
    });

    expect(session.stop).toHaveBeenCalledTimes(1);
  });
});
