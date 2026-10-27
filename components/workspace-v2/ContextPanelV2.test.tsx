// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ContextPanelV2 } from "./ContextPanelV2";
import { useUIStore } from "@/stores/uiStore";

const lifecycle = vi.hoisted(() => ({ mount: vi.fn(), unmount: vi.fn() }));
vi.mock("next/dynamic", () => ({ default: () => function Feed() {
  useEffect(() => { lifecycle.mount(); return lifecycle.unmount; }, []);
  return <div data-test-feed>Notícias e player</div>;
} }));
vi.mock("@/components/workspace-v2/PulsePanelV2", () => ({
  PulseActivityPanelV2: () => <p>Gerações Pulse</p>, PulsePanelV2: () => <p>Rotinas</p>,
}));
vi.mock("@/components/workspace-v2/WorkspaceCapturesPanelV2", () => ({ WorkspaceCapturesPanelV2: () => <p>Notas</p> }));
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  lifecycle.mount.mockClear(); lifecycle.unmount.mockClear();
  useUIStore.setState({ activePanelTab: "activity", contextPanelOpen: false });
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

it("carrega notícias somente ao selecionar a aba e desmonta ao voltar ao Pulse", async () => {
  await act(async () => root.render(<ContextPanelV2 />));
  expect(Array.from(container.querySelectorAll('[role="tab"]')).map(node => node.textContent)).toEqual(["Pulse", "Descobrir", "Notas", "Rotinas"]);
  expect(lifecycle.mount).not.toHaveBeenCalled();
  await act(async () => useUIStore.getState().openContextPanel("discover"));
  expect(container.querySelector('[aria-label="Descobrir IA"]')?.getAttribute("aria-selected")).toBe("true");
  expect(container.querySelector("[data-test-feed]")).not.toBeNull();
  await act(async () => root.render(<ContextPanelV2 />));
  expect(lifecycle.mount).toHaveBeenCalledOnce();
  expect(lifecycle.unmount).not.toHaveBeenCalled();
  await act(async () => useUIStore.getState().setActivePanelTab("activity"));
  expect(lifecycle.unmount).toHaveBeenCalledOnce();
  expect(container.textContent).toContain("Gerações Pulse");
});
