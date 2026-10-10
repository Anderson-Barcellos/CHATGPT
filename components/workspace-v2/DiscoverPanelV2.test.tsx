// @vitest-environment jsdom
import { act, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DiscoverPanelV2 } from "./DiscoverPanelV2";
import { useUIStore } from "@/stores/uiStore";

const lifecycle = vi.hoisted(() => ({ mount: vi.fn(), unmount: vi.fn() }));
vi.mock("next/dynamic", () => ({ default: () => function Feed() {
  const [opened, setOpened] = useState(false);
  useEffect(() => { lifecycle.mount(); return lifecycle.unmount; }, []);
  return <div data-discover-scroll-root><button onClick={() => setOpened(true)}>Ler matéria</button>{opened && <p>Matéria aberta</p>}</div>;
} }));

let root: Root;
let container: HTMLDivElement;
let mobile = false;
beforeEach(() => {
  lifecycle.mount.mockClear(); lifecycle.unmount.mockClear(); mobile = false;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = vi.fn((media) => ({ matches: mobile, media, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
  useUIStore.setState({ discoverPanelOpen: true, discoverExpanded: false });
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
function Harness() {
  const open = useUIStore((state) => state.discoverPanelOpen);
  return <div>{open && <DiscoverPanelV2 />}<section data-background><textarea defaultValue="Rascunho preservado" /></section></div>;
}
function button(label: string) { return container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!; }

it("mantém a matéria e o chat montados ao ampliar/reduzir; fechar desmonta o player/feed", async () => {
  await act(async () => root.render(<Harness />));
  const original = container.querySelector("textarea");
  const feed = container.querySelector("[data-discover-scroll-root]");
  await act(async () => container.querySelector<HTMLButtonElement>("[data-discover-scroll-root] button")!.click());
  await act(async () => button("Ampliar leitura").click());
  expect(container.querySelector('[role="dialog"]')?.getAttribute("aria-modal")).toBe("true");
  expect((container.querySelector("[data-background]") as HTMLElement).inert).toBe(true);
  expect(container.querySelector("[data-discover-scroll-root]")).toBe(feed);
  expect(container.textContent).toContain("Matéria aberta");
  await act(async () => button("Reduzir leitura").click());
  expect(container.querySelector('[role="dialog"]')).toBeNull();
  expect(container.querySelector("textarea")).toBe(original);
  expect(original?.value).toBe("Rascunho preservado");
  expect(lifecycle.mount).toHaveBeenCalledOnce();
  expect(lifecycle.unmount).not.toHaveBeenCalled();
  await act(async () => button("Voltar às conversas").click());
  expect(lifecycle.unmount).toHaveBeenCalledOnce();
  expect(container.querySelector("textarea")).toBe(original);
});

it("usa tela cheia em viewport compacta e fecha por Escape", async () => {
  mobile = true;
  await act(async () => root.render(<Harness />));
  expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  expect(button("Ampliar leitura")).toBeNull();
  expect(document.activeElement).toBe(button("Voltar ao chat"));
  const workspaceShortcut = vi.fn();
  window.addEventListener("keydown", workspaceShortcut);
  await act(async () => button("Voltar ao chat").dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })));
  expect(workspaceShortcut).not.toHaveBeenCalled();
  window.removeEventListener("keydown", workspaceShortcut);
  await act(async () => button("Voltar ao chat").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(useUIStore.getState().discoverPanelOpen).toBe(false);
  expect(container.querySelector('[role="dialog"]')).toBeNull();
});
