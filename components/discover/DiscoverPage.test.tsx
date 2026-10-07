// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiscoverPage } from "./DiscoverPage";

vi.mock("@/components/chat/ChatMarkdown", () => ({ ChatMarkdown: ({ content }: { content: string }) => <div>{content}</div> }));
vi.mock("@/components/navigation/ProductNav", () => ({ ProductNav: () => <nav>Produtos</nav> }));
vi.mock("@/components/chat/MiniAudioPlayer", () => ({
  MiniAudioPlayer: ({ content, messageId, allowRealtime, onClose }: {
    content: string;
    messageId: string;
    allowRealtime?: boolean;
    onClose: () => void;
  }) => (
    <div data-mini-audio-player data-message-id={messageId} data-allow-realtime={String(allowRealtime)}>
      {content}
      <button type="button" onClick={onClose}>Fechar player</button>
    </div>
  ),
}));

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
  const button = Array.from(article(id).querySelectorAll("button")).find((candidate) =>
    /Ler a matéria|Recolher/.test(candidate.textContent ?? "")
  )!;
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
    schedule: { enabled: true }, nextScheduledAt: "2026-10-08T11:00:00.000Z",
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
  it("mantém o escopo Lexend e mostra a atualização automática prevista", async () => {
    await renderPage();

    expect(container.querySelector("[data-discover-scroll-root]")?.className).toContain("gc-chat-ui");
    const schedule = container.querySelector('[role="switch"][aria-label="Atualização automática"]');
    expect(schedule?.getAttribute("aria-checked")).toBe("true");
    expect(container.textContent).toContain("A cada dois dias, às 08h (São Paulo)");
    expect(container.textContent).toContain("Próxima previsão:");
  });

  it("impede uma leitura iniciada durante o PUT de reativar a agenda pausada", async () => {
    let getCount = 0;
    let resolveStaleRead: ((response: Response) => void) | undefined;
    let resolveSchedule: ((response: Response) => void) | undefined;
    const staleRead = new Promise<Response>((resolve) => { resolveStaleRead = resolve; });
    const scheduleUpdate = new Promise<Response>((resolve) => { resolveSchedule = resolve; });
    const enabledState = {
      topics: [], articles: ARTICLES, job: { status: "idle" }, suggestedTopics: [],
      schedule: { enabled: true }, nextScheduledAt: "2026-10-08T11:00:00.000Z",
    };

    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/refresh")) {
        return Promise.resolve(new Response(JSON.stringify({ status: "started" }), {
          status: 202, headers: { "Content-Type": "application/json" },
        }));
      }
      if (url.endsWith("/settings")) return scheduleUpdate;
      getCount += 1;
      if (getCount === 1) {
        return Promise.resolve(new Response(JSON.stringify(enabledState), {
          status: 200, headers: { "Content-Type": "application/json" },
        }));
      }
      return staleRead;
    }));

    await renderPage();
    const schedule = container.querySelector<HTMLButtonElement>('[role="switch"]')!;
    await act(async () => { schedule.click(); await Promise.resolve(); });
    expect(container.textContent).toContain("Salvando preferência…");

    const refresh = Array.from(container.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Buscar novidades")
    )!;
    await act(async () => { refresh.click(); await Promise.resolve(); });

    await act(async () => {
      resolveSchedule!(new Response(JSON.stringify({
        schedule: { enabled: false }, nextScheduledAt: null,
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
      await Promise.resolve();
    });
    expect(schedule.getAttribute("aria-checked")).toBe("false");
    expect(container.textContent).toContain("Pausada até tu reativar.");
    expect(container.textContent).toContain("Atualizando…");

    await act(async () => {
      resolveStaleRead!(new Response(JSON.stringify(enabledState), {
        status: 200, headers: { "Content-Type": "application/json" },
      }));
      await Promise.resolve();
    });
    expect(schedule.getAttribute("aria-checked")).toBe("false");
  });

  it("evita dois pedidos manuais enquanto o primeiro ainda está pendente", async () => {
    let resolveRefresh: ((response: Response) => void) | undefined;
    const refreshResponse = new Promise<Response>((resolve) => { resolveRefresh = resolve; });
    const state = {
      topics: [], articles: ARTICLES, job: { status: "idle" }, suggestedTopics: [],
      schedule: { enabled: true }, nextScheduledAt: "2026-10-08T11:00:00.000Z",
    };
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input).endsWith("/refresh")) return refreshResponse;
      return Promise.resolve(new Response(JSON.stringify(state), {
        status: 200, headers: { "Content-Type": "application/json" },
      }));
    });
    vi.stubGlobal("fetch", fetchMock);

    await renderPage();
    const refresh = Array.from(container.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Buscar novidades")
    )!;
    await act(async () => { refresh.click(); await Promise.resolve(); });
    await act(async () => { refresh.click(); await Promise.resolve(); });

    expect(fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/refresh"))).toHaveLength(1);
    expect(refresh.disabled).toBe(true);

    await act(async () => {
      resolveRefresh!(new Response(JSON.stringify({ status: "running" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }));
      await Promise.resolve();
    });
  });

  it("não trava o interruptor se salvar assuntos durante o PUT da agenda", async () => {
    let resolveSchedule: ((response: Response) => void) | undefined;
    const scheduleUpdate = new Promise<Response>((resolve) => { resolveSchedule = resolve; });
    const enabledState = {
      topics: [], articles: ARTICLES, job: { status: "idle" }, suggestedTopics: ["Agentes"],
      schedule: { enabled: true }, nextScheduledAt: "2026-10-08T11:00:00.000Z",
    };

    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/settings")) return scheduleUpdate;
      if (url.endsWith("/topics")) {
        return Promise.resolve(new Response(JSON.stringify({ topics: ["Agentes"] }), {
          status: 200, headers: { "Content-Type": "application/json" },
        }));
      }
      return Promise.resolve(new Response(JSON.stringify(enabledState), {
        status: 200, headers: { "Content-Type": "application/json" },
      }));
    }));

    await renderPage();
    const schedule = container.querySelector<HTMLButtonElement>('[role="switch"]')!;
    await act(async () => { schedule.click(); await Promise.resolve(); });
    expect(schedule.disabled).toBe(true);

    const topic = Array.from(container.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("+ Agentes")
    )!;
    await act(async () => topic.click());

    await act(async () => {
      resolveSchedule!(new Response(JSON.stringify({
        schedule: { enabled: false }, nextScheduledAt: null,
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
      await Promise.resolve();
    });
    expect(schedule.disabled).toBe(false);
    expect(schedule.getAttribute("aria-checked")).toBe("false");
  });

  it("mantém a agenda anterior e libera o controle quando o PUT falha", async () => {
    let resolveSchedule: ((response: Response) => void) | undefined;
    const scheduleUpdate = new Promise<Response>((resolve) => { resolveSchedule = resolve; });
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      if (String(input).endsWith("/settings")) return scheduleUpdate;
      return Promise.resolve(new Response(JSON.stringify({
        topics: [], articles: ARTICLES, job: { status: "idle" }, suggestedTopics: [],
        schedule: { enabled: true }, nextScheduledAt: "2026-10-08T11:00:00.000Z",
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    }));

    await renderPage();
    const schedule = container.querySelector<HTMLButtonElement>('[role="switch"]')!;
    await act(async () => { schedule.click(); await Promise.resolve(); });
    expect(container.textContent).toContain("Salvando preferência…");

    await act(async () => {
      resolveSchedule!(new Response(JSON.stringify({ message: "Não foi possível salvar." }), {
        status: 500, headers: { "Content-Type": "application/json" },
      }));
      await Promise.resolve();
    });
    expect(schedule.disabled).toBe(false);
    expect(schedule.getAttribute("aria-checked")).toBe("true");
    expect(container.textContent).toContain("Não foi possível salvar.");
  });

  it("tem rolagem própria e leva o card desktop aberto ao destaque", async () => {
    await renderPage();
    expect(container.querySelector("[data-discover-scroll-root]")?.className).toContain("overflow-y-auto");

    await clickRead("segunda");

    expect(article("segunda").className).toContain("md:order-first");
    expect(article("segunda").className).toContain("md:col-span-2");
    expect(article("primeira").className).not.toContain("md:order-first");
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(Array.from(article("segunda").querySelectorAll("button")).find((candidate) =>
      /Ler a matéria|Recolher/.test(candidate.textContent ?? "")
    )?.getAttribute("aria-expanded")).toBe("true");

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
    expect(Array.from(article("segunda").querySelectorAll("button")).find((candidate) =>
      /Ler a matéria|Recolher/.test(candidate.textContent ?? "")
    )?.getAttribute("aria-expanded")).toBe("true");
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("abre um único player TTS por matéria sem incluir resumo ou fontes", async () => {
    await renderPage();
    const firstAudio = Array.from(article("primeira").querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Ouvir matéria")
    )!;
    const secondAudio = Array.from(article("segunda").querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Ouvir matéria")
    )!;

    await act(async () => firstAudio.click());
    const firstPlayer = container.querySelector("[data-mini-audio-player]")!;
    expect(firstPlayer.getAttribute("data-message-id")).toBe("discover-primeira");
    expect(firstPlayer.getAttribute("data-allow-realtime")).toBe("false");
    expect(firstPlayer.textContent).toContain("Matéria 1");
    expect(firstPlayer.textContent).toContain("Conteúdo 1");
    expect(firstPlayer.textContent).not.toContain("Resumo suficientemente claro");
    expect(firstPlayer.textContent).not.toContain("Fonte");

    await act(async () => secondAudio.click());
    expect(container.querySelectorAll("[data-mini-audio-player]")).toHaveLength(1);
    expect(container.querySelector("[data-mini-audio-player]")?.getAttribute("data-message-id")).toBe("discover-segunda");
  });
});
