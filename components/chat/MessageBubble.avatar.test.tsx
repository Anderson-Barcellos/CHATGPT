// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MessageBubble } from "./MessageBubble";
import type { Message } from "@/types";

vi.mock("@/hooks/useNotes", () => ({ useNotes: () => ({ appendToNotes: vi.fn() }) }));
vi.mock("@/hooks/useIsMobile", () => ({ useIsMobile: () => false }));
vi.mock("./MessageContent", () => ({ MessageContent: () => <p>Resposta sintética</p> }));
vi.mock("./ReasoningPanel", () => ({ ReasoningPanel: () => null }));
vi.mock("./QuickActionsBar", () => ({ QuickActionsBar: () => null }));

let root: Root;
let container: HTMLDivElement;
const assistant = (modelId?: string): Message => ({ id: `a-${modelId ?? "legado"}`, role: "assistant", content: "Resposta sintética", timestamp: new Date(), modelId });
const avatar = () => container.querySelector<HTMLElement>(".gc-message-avatar")!;
async function render(message: Message) { await act(async () => root.render(<MessageBubble message={message} />)); }

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

it.each([
  ["claude-sonnet-5-5", "Claude"],
  ["claude-opus-5-5", "Claude"],
  ["deepseek-flash", "DeepSeek"],
  [undefined, "OpenAI"],
])("modelo %s mostra o logo SVG %s no avatar", async (modelId, label) => {
  await render(assistant(modelId));
  const svg = avatar().querySelector("svg");
  expect(svg?.getAttribute("aria-label")).toBe(label);
  expect(svg?.getAttribute("fill")).toBe("currentColor");
});

it("Gemini continua com a inicial tipográfica", async () => {
  await render(assistant("gemini-3.8-flash"));
  expect(avatar().querySelector("svg")).toBeNull();
  expect(avatar().textContent).toContain("G");
});
