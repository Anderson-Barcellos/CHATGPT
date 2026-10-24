// @vitest-environment jsdom
import { act, useCallback } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useMessageLongPress } from "./useMessageLongPress";

let root: Root;
let container: HTMLDivElement;
const opened = vi.fn();
function Harness() {
  const open = useCallback(() => opened(), []);
  const { pressing, cancel: _cancel, ...events } = useMessageLongPress(true, open);
  void _cancel;
  return <div data-card data-pressing={pressing} {...events}><button>Controle</button><span>Texto</span></div>;
}
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers(); opened.mockClear();
  container = document.createElement("div"); document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<Harness />));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
async function touch(type: string, x = 10, target: Element = container.querySelector("span")!) {
  await act(async () => {
    const event = new Event(type, { bubbles: true });
    Object.defineProperty(event, "touches", { value: type === "touchend" || type === "touchcancel" ? [] : [{ clientX: x, clientY: 10 }] });
    target.dispatchEvent(event);
  });
}
async function wait(ms = 1000) { await act(async () => vi.advanceTimersByTime(ms)); }
it("tolera tremor de 4 px e retorna o feedback ao abrir", async () => {
  await touch("touchstart"); await touch("touchmove", 14);
  expect(container.querySelector("[data-card]")?.getAttribute("data-pressing")).toBe("false");
  await wait(450);
  expect(container.querySelector("[data-card]")?.getAttribute("data-pressing")).toBe("true");
  await wait(); expect(opened).toHaveBeenCalledOnce();
  expect(container.querySelector("[data-card]")?.getAttribute("data-pressing")).toBe("false");
});
it("toque curto e início de rolagem não mostram feedback nem abrem menu", async () => {
  await touch("touchstart"); await wait(300);
  expect(container.querySelector("[data-card]")?.getAttribute("data-pressing")).toBe("false");
  await touch("touchmove", 35); await wait();
  expect(container.querySelector("[data-card]")?.getAttribute("data-pressing")).toBe("false");
  expect(opened).not.toHaveBeenCalled();
});
it("contextmenu do toque não antecipa os 900 ms; clique direito continua disponível", async () => {
  await touch("touchstart"); await wait(500);
  await act(async () => { container.querySelector("span")!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })); });
  expect(opened).not.toHaveBeenCalled();
  await wait(399); expect(opened).not.toHaveBeenCalled();
  await wait(1); expect(opened).toHaveBeenCalledOnce();
  await touch("touchend"); await wait(1500);
  await act(async () => { container.querySelector("span")!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })); });
  expect(opened).toHaveBeenCalledTimes(2);
});
it.each(["touchend", "touchcancel"])("cancela o menu em %s", async type => {
  await touch("touchstart"); await touch(type); await wait(); expect(opened).not.toHaveBeenCalled();
});
it("rolagem cancela e controles internos não iniciam o gesto", async () => {
  await touch("touchstart"); await touch("touchmove", 35); await wait();
  await touch("touchstart", 10, container.querySelector("button")!); await wait();
  expect(opened).not.toHaveBeenCalled();
});
it("desmontar cancela o temporizador", async () => {
  await touch("touchstart"); await act(async () => root.render(null)); await wait();
  expect(opened).not.toHaveBeenCalled();
});
