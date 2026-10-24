// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { MessageBubble } from "./MessageBubble";
import type { Message } from "@/types";

vi.mock("@/hooks/useNotes", () => ({ useNotes: () => ({ appendToNotes: vi.fn() }) }));
vi.mock("@/hooks/useIsMobile", () => ({ useIsMobile: () => true }));
vi.mock("./MessageContent", () => ({ MessageContent: () => <p>Mensagem sintética</p> }));
vi.mock("./ReasoningPanel", () => ({ ReasoningPanel: () => null }));
vi.mock("./QuickActionsBar", () => ({ QuickActionsBar: () => null }));
const message: Message = { id: "synthetic", role: "user", content: "Texto preservado", timestamp: new Date() };
let root: Root;
let container: HTMLDivElement;
let save: ReturnType<typeof vi.fn<(id: string, content: string) => Promise<boolean>>>;
async function render(disabled = false) { await act(async () => root.render(<MessageBubble message={message} onEdit={save} editDisabled={disabled} />)); }
async function openEditor() {
  await act(async () => container.querySelector("[data-slot='card']")!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true })));
  const item = [...document.querySelectorAll<HTMLElement>("[role='menuitem']")].find(el => el.textContent?.includes("Editar"))!;
  await act(async () => item.click());
}
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => setTimeout(() => fn(0), 0));
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
  save = vi.fn().mockResolvedValue(true);
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  await render();
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
it("preserva editor e texto quando geração começa durante a edição", async () => {
  await openEditor(); await render(true);
  expect(container.querySelector("textarea")?.value).toBe(message.content);
  const send = [...container.querySelectorAll("button")].find(el => el.textContent?.includes("Enviar"))!;
  expect(send.disabled).toBe(true); await act(async () => send.click());
  expect(save).not.toHaveBeenCalled();
  expect(container.textContent).toContain("Aguarde a resposta terminar");
});
it("preserva rascunho quando o callback rejeita o envio", async () => {
  save.mockResolvedValue(false); await openEditor();
  await act(async () => [...container.querySelectorAll("button")].find(el => el.textContent?.includes("Enviar"))!.click());
  expect(container.querySelector("textarea")?.value).toBe(message.content);
  expect(container.querySelector("[role='alert']")).not.toBeNull();
});
it("Enter no celular não envia nem fecha o editor", async () => {
  await openEditor();
  await act(async () => container.querySelector("textarea")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
  expect(save).not.toHaveBeenCalled(); expect(container.querySelector("textarea")).not.toBeNull();
});
it("envio aceito fecha o editor", async () => {
  await openEditor();
  await act(async () => [...container.querySelectorAll("button")].find(el => el.textContent?.includes("Enviar"))!.click());
  expect(save).toHaveBeenCalledWith(message.id, message.content);
  expect(container.querySelector("textarea")).toBeNull();
});

it("falha do callback mantém texto e permite nova tentativa", async () => {
  save.mockRejectedValue(new Error("Falha sintética")); await openEditor();
  await act(async () => [...container.querySelectorAll("button")].find(el => el.textContent?.includes("Enviar"))!.click());
  expect(container.querySelector("textarea")?.value).toBe(message.content);
  expect(container.querySelector("[role='alert']")?.textContent).toContain("tentar novamente");
});
