// @vitest-environment jsdom
import { act, Component, createElement, useEffect, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SoundCaseRealtimeProvider,
  useSoundCaseRealtimeSession,
} from "@/components/soundcase/SoundCaseRealtimeProvider";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function settle(ms = 5) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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

describe("SoundCaseRealtimeProvider", () => {
  it("keeps the same realtime session when a consumer unmounts and remounts", async () => {
    const seen: unknown[] = [];

    function Consumer() {
      const session = useSoundCaseRealtimeSession();
      useEffect(() => {
        seen.push(session.stop);
      }, [session.stop]);
      return null;
    }

    function Host({ visible }: { visible: boolean }) {
      return createElement(
        SoundCaseRealtimeProvider,
        null,
        visible ? createElement(Consumer) : null
      );
    }

    await act(async () => {
      root!.render(createElement(Host, { visible: true }));
    });
    await settle();

    await act(async () => {
      root!.render(createElement(Host, { visible: false }));
    });
    await settle();

    await act(async () => {
      root!.render(createElement(Host, { visible: true }));
    });
    await settle();

    expect(seen).toHaveLength(2);
    // Mesma identidade => o hook viveu no provider, não no consumidor desmontado.
    expect(seen[0]).toBe(seen[1]);
  });

  it("fails loudly when a consumer renders outside the provider", async () => {
    function Orphan() {
      useSoundCaseRealtimeSession();
      return null;
    }

    const errors: unknown[] = [];

    class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
      state = { failed: false };
      static getDerivedStateFromError() {
        return { failed: true };
      }
      componentDidCatch(error: unknown) {
        errors.push(error);
      }
      render() {
        return this.state.failed ? null : this.props.children;
      }
    }

    // React re-lança o erro do boundary no console; silenciar mantém o output do teste limpo.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await act(async () => {
      root!.render(createElement(Boundary, null, createElement(Orphan)));
    });
    consoleError.mockRestore();

    expect(errors).toHaveLength(1);
    expect(String(errors[0])).toContain("SoundCaseRealtimeProvider");
  });
});
