// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  KEYBOARD_OPEN_ATTR,
  KEYBOARD_THRESHOLD_PX,
  VISUAL_VIEWPORT_HEIGHT_VAR,
  VISUAL_VIEWPORT_OFFSET_TOP_VAR,
  applyVisualViewport,
  isKeyboardOpen,
  useVisualViewport,
} from "@/hooks/useVisualViewport";

class FakeVisualViewport extends EventTarget {
  height = 956;
  offsetTop = 0;
  width = 440;
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let viewport: FakeVisualViewport;

function Harness({ enabled }: { enabled: boolean }) {
  useVisualViewport(enabled);
  return null;
}

async function mount(enabled: boolean) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(createElement(Harness, { enabled }));
  });
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  viewport = new FakeVisualViewport();
  Object.defineProperty(window, "visualViewport", { value: viewport, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 956, configurable: true, writable: true });
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number);
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});

afterEach(async () => {
  if (root) {
    await act(async () => {
      root!.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
  document.documentElement.style.removeProperty(VISUAL_VIEWPORT_HEIGHT_VAR);
  document.documentElement.style.removeProperty(VISUAL_VIEWPORT_OFFSET_TOP_VAR);
  document.documentElement.removeAttribute(KEYBOARD_OPEN_ATTR);
  vi.unstubAllGlobals();
});

describe("isKeyboardOpen", () => {
  it("detecta teclado quando o visualViewport encolhe além do limiar", () => {
    expect(isKeyboardOpen({ height: 956, offsetTop: 0, innerHeight: 956 })).toBe(false);
    expect(isKeyboardOpen({ height: 956 - KEYBOARD_THRESHOLD_PX, offsetTop: 0, innerHeight: 956 })).toBe(false);
    expect(isKeyboardOpen({ height: 560, offsetTop: 0, innerHeight: 956 })).toBe(true);
  });
});

describe("applyVisualViewport", () => {
  it("grava a altura como variável CSS e marca teclado aberto no root", () => {
    const el = document.createElement("div");
    applyVisualViewport(el, { height: 560.4, offsetTop: 0, innerHeight: 956 });
    expect(el.style.getPropertyValue(VISUAL_VIEWPORT_HEIGHT_VAR)).toBe("560px");
    expect(el.style.getPropertyValue(VISUAL_VIEWPORT_OFFSET_TOP_VAR)).toBe("0px");
    expect(el.getAttribute(KEYBOARD_OPEN_ATTR)).toBe("true");

    applyVisualViewport(el, { height: 956, offsetTop: 12.4, innerHeight: 956 });
    expect(el.style.getPropertyValue(VISUAL_VIEWPORT_HEIGHT_VAR)).toBe("956px");
    expect(el.style.getPropertyValue(VISUAL_VIEWPORT_OFFSET_TOP_VAR)).toBe("12px");
    expect(el.hasAttribute(KEYBOARD_OPEN_ATTR)).toBe(false);
  });

  it("limpa tudo quando recebe null", () => {
    const el = document.createElement("div");
    applyVisualViewport(el, { height: 560, offsetTop: 0, innerHeight: 956 });
    applyVisualViewport(el, null);
    expect(el.style.getPropertyValue(VISUAL_VIEWPORT_HEIGHT_VAR)).toBe("");
    expect(el.style.getPropertyValue(VISUAL_VIEWPORT_OFFSET_TOP_VAR)).toBe("");
    expect(el.hasAttribute(KEYBOARD_OPEN_ATTR)).toBe(false);
  });
});

describe("useVisualViewport", () => {
  it("não toca no documento quando desabilitado", async () => {
    await mount(false);
    await flush();
    expect(document.documentElement.style.getPropertyValue(VISUAL_VIEWPORT_HEIGHT_VAR)).toBe("");
  });

  it("sincroniza a altura no mount e reage ao resize do visualViewport", async () => {
    await mount(true);
    await flush();
    expect(document.documentElement.style.getPropertyValue(VISUAL_VIEWPORT_HEIGHT_VAR)).toBe("956px");
    expect(document.documentElement.style.getPropertyValue(VISUAL_VIEWPORT_OFFSET_TOP_VAR)).toBe("0px");
    expect(document.documentElement.hasAttribute(KEYBOARD_OPEN_ATTR)).toBe(false);

    viewport.height = 560;
    viewport.offsetTop = 120;
    await act(async () => {
      viewport.dispatchEvent(new Event("resize"));
    });
    await flush();

    expect(document.documentElement.style.getPropertyValue(VISUAL_VIEWPORT_HEIGHT_VAR)).toBe("560px");
    expect(document.documentElement.style.getPropertyValue(VISUAL_VIEWPORT_OFFSET_TOP_VAR)).toBe("120px");
    expect(document.documentElement.getAttribute(KEYBOARD_OPEN_ATTR)).toBe("true");
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it("remove a variável e o atributo ao desmontar", async () => {
    await mount(true);
    await flush();
    await act(async () => {
      root!.unmount();
    });
    root = null;
    expect(document.documentElement.style.getPropertyValue(VISUAL_VIEWPORT_HEIGHT_VAR)).toBe("");
    expect(document.documentElement.style.getPropertyValue(VISUAL_VIEWPORT_OFFSET_TOP_VAR)).toBe("");
    expect(document.documentElement.hasAttribute(KEYBOARD_OPEN_ATTR)).toBe(false);
  });
});
