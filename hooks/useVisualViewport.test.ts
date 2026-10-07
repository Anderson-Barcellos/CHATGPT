// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  KEYBOARD_OPEN_ATTR,
  KEYBOARD_THRESHOLD_PX,
  STANDALONE_ATTR,
  STANDALONE_BOTTOM_GAP_VAR,
  VISUAL_VIEWPORT_HEIGHT_VAR,
  VISUAL_VIEWPORT_OFFSET_TOP_VAR,
  applyVisualViewport,
  isKeyboardOpen,
  physicalViewportHeight,
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
  document.documentElement.style.removeProperty(STANDALONE_BOTTOM_GAP_VAR);
  document.documentElement.removeAttribute(STANDALONE_ATTR);
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true, writable: true });
  vi.unstubAllGlobals();
});

function stubStandaloneScreen({ clientHeight }: { clientHeight: number }) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(display-mode: standalone)" }));
  Object.defineProperty(window.screen, "width", { value: 440, configurable: true });
  Object.defineProperty(window.screen, "height", { value: 956, configurable: true });
  Object.defineProperty(window, "innerWidth", { value: 440, configurable: true, writable: true });
  Object.defineProperty(document.documentElement, "clientHeight", { value: clientHeight, configurable: true });
}

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

    // Teclado fechado: o JS devolve a altura ao CSS em vez de travar o valor pós-teclado.
    applyVisualViewport(el, { height: 894, offsetTop: 12.4, innerHeight: 956 });
    expect(el.style.getPropertyValue(VISUAL_VIEWPORT_HEIGHT_VAR)).toBe("");
    expect(el.style.getPropertyValue(VISUAL_VIEWPORT_OFFSET_TOP_VAR)).toBe("");
    expect(el.hasAttribute(KEYBOARD_OPEN_ATTR)).toBe(false);
  });

  it("em standalone grava o atributo e a faixa que o WebKit deixa sem pintar embaixo", () => {
    const el = document.createElement("div");
    applyVisualViewport(el, {
      height: 894, offsetTop: 0, innerHeight: 956, standalone: true, physicalHeight: 956, clientHeight: 894,
    });
    expect(el.hasAttribute(STANDALONE_ATTR)).toBe(true);
    expect(el.style.getPropertyValue(STANDALONE_BOTTOM_GAP_VAR)).toBe("62px");

    applyVisualViewport(el, {
      height: 956, offsetTop: 0, innerHeight: 956, standalone: true, physicalHeight: 956, clientHeight: 956,
    });
    expect(el.style.getPropertyValue(STANDALONE_BOTTOM_GAP_VAR)).toBe("0px");

    applyVisualViewport(el, { height: 956, offsetTop: 0, innerHeight: 956, standalone: false });
    expect(el.hasAttribute(STANDALONE_ATTR)).toBe(false);
    expect(el.style.getPropertyValue(STANDALONE_BOTTOM_GAP_VAR)).toBe("");
  });

  it("limpa tudo quando recebe null", () => {
    const el = document.createElement("div");
    applyVisualViewport(el, { height: 560, offsetTop: 0, innerHeight: 956 });
    applyVisualViewport(el, {
      height: 560, offsetTop: 0, innerHeight: 956, standalone: true, physicalHeight: 956, clientHeight: 894,
    });
    applyVisualViewport(el, null);
    expect(el.style.getPropertyValue(VISUAL_VIEWPORT_HEIGHT_VAR)).toBe("");
    expect(el.style.getPropertyValue(VISUAL_VIEWPORT_OFFSET_TOP_VAR)).toBe("");
    expect(el.hasAttribute(KEYBOARD_OPEN_ATTR)).toBe(false);
    expect(el.hasAttribute(STANDALONE_ATTR)).toBe(false);
    expect(el.style.getPropertyValue(STANDALONE_BOTTOM_GAP_VAR)).toBe("");
  });
});

describe("physicalViewportHeight", () => {
  it("usa o lado maior da tela em retrato e o menor em paisagem (o iOS não gira screen.*)", () => {
    expect(physicalViewportHeight(440, 956, 440, 894)).toBe(956);
    expect(physicalViewportHeight(440, 956, 956, 440)).toBe(440);
  });
});

describe("useVisualViewport", () => {
  it("não toca no documento quando desabilitado", async () => {
    await mount(false);
    await flush();
    expect(document.documentElement.style.getPropertyValue(VISUAL_VIEWPORT_HEIGHT_VAR)).toBe("");
  });

  it("só controla a altura enquanto o teclado está aberto", async () => {
    await mount(true);
    await flush();
    expect(document.documentElement.style.getPropertyValue(VISUAL_VIEWPORT_HEIGHT_VAR)).toBe("");
    expect(document.documentElement.style.getPropertyValue(VISUAL_VIEWPORT_OFFSET_TOP_VAR)).toBe("");
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

    // Teclado fecha com a altura curta do WebKit: nada fica travado no shell.
    viewport.height = 894;
    viewport.offsetTop = 0;
    await act(async () => {
      viewport.dispatchEvent(new Event("resize"));
    });
    await flush();

    expect(document.documentElement.style.getPropertyValue(VISUAL_VIEWPORT_HEIGHT_VAR)).toBe("");
    expect(document.documentElement.style.getPropertyValue(VISUAL_VIEWPORT_OFFSET_TOP_VAR)).toBe("");
    expect(document.documentElement.hasAttribute(KEYBOARD_OPEN_ATTR)).toBe(false);
  });

  it("limpa o pan residual quando o teclado fecha com a janela rolada", async () => {
    await mount(true);
    await flush();
    vi.mocked(window.scrollTo).mockClear();

    Object.defineProperty(window, "scrollY", { value: 40, configurable: true, writable: true });
    await act(async () => {
      viewport.dispatchEvent(new Event("resize"));
    });
    await flush();

    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it("marca standalone e mede a faixa de baixo a partir da tela e do clientHeight", async () => {
    stubStandaloneScreen({ clientHeight: 894 });
    await mount(true);
    await flush();

    expect(document.documentElement.hasAttribute(STANDALONE_ATTR)).toBe(true);
    expect(document.documentElement.style.getPropertyValue(STANDALONE_BOTTOM_GAP_VAR)).toBe("62px");
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
