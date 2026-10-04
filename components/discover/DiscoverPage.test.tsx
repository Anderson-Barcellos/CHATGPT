// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiscoverPage } from "./DiscoverPage";

vi.mock("@/components/chat/ChatMarkdown", () => ({ ChatMarkdown: ({ content }: { content: string }) => <div>{content}</div> }));
vi.mock("@/components/navigation/ProductNav", () => ({ ProductNav: () => <nav>Produtos</nav> }));

const ARTICLES = ["primeira", "segunda", "terceira"].map((id, index) => ({
  id,
  title: `Matéria ${index + 1}`,
  summary: `Resumo suficientemente claro da matéria ${index + 1}.`,
  content: `Conteúdo ${index + 1}`,
  topic: "IA",
  publishedAt: "2026-10-03T10:00:00.000Z",
  createdAt: "2026-10-04T10:00:00.000Z",
  sources: [{ title: "Fonte", url: `https://example.org/${id}` }],
}));

let root: Root;
let container: HTMLDivElement;
let mobile = false;
let reducedMotion = false;
let animationFrames: FrameRequestCallback[];
const scrollIntoView = vi.fn();

async function renderPage(): Promise<void> {
  await act(async () => {
    root.render(<DiscoverPage />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function article(id: string): HTMLElement {
  return container.querySelector(`[data-discover-article="${id}"]`)!;
}

async function clickRead(id: string): Promise<void> {
  const button = article(id).querySelector("button")!;
  await act(async () => { button.click(); });
  await act(async () => { animationFrames.splice(0).forEach((callback) => callback(0)); });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mobile = false;
  reducedMotion = false;
  animationFrames = [];
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    topics: [], articles: ARTICLES, job: { status: "idle" }, suggestedTopics: [],
  }), { status: 200, headers: { "Content-Type": "application/json" } })));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { animationFrames.push(callback); return animationFrames.length; });
  Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn((query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? reducedMotion : mobile,
    media: query,
    onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })) });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });
  scrollIntoView.mockClear();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("Descobrir IA", () => {
  it("tem rolagem própria e leva o card desktop aberto ao destaque", async () => {
    await renderPage();
    expect(container.querySelector("[data-discover-scroll-root]")?.className).toContain("overflow-y-auto");

    await clickRead("segunda");

    expect(article("segunda").className).toContain("md:order-first");
    expect(article("segunda").className).toContain("md:col-span-2");
    expect(article("primeira").className).not.toContain("md:order-first");
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(article("segunda").querySelector("button")?.getAttribute("aria-expanded")).toBe("true");

    await clickRead("segunda");
    expect(article("segunda").className).not.toContain("md:order-first");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("usa movimento imediato quando a preferência reduz animações", async () => {
    reducedMotion = true;
    await renderPage();
    await clickRead("terceira");
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
  });

  it("expande no lugar e não força rolagem em mobile", async () => {
    mobile = true;
    await renderPage();
    await clickRead("segunda");
    expect(article("segunda").querySelector("button")?.getAttribute("aria-expanded")).toBe("true");
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
