// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandComposerContainerV2 } from "@/components/workspace-v2/CommandComposerContainerV2";
import { useSettingsStore } from "@/stores/settingsStore";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function settle(ms = 5) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  if (typeof window.matchMedia !== "function") {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList;
  }
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

describe("CommandComposerContainerV2 quick actions", () => {
  it("lista Claude no seletor aberto, sem Astra ou Gemini, e mantém anexos de imagem", async () => {
    await act(async () => {
      root!.render(
        createElement(CommandComposerContainerV2, {
          sendMessage: async () => false,
          stopGeneration: () => undefined,
          isLoading: false,
          error: null,
        })
      );
    });

    const modelTrigger = container!.querySelector<HTMLButtonElement>(
      '[aria-label="Selecionar modelo"]'
    );
    expect(modelTrigger).not.toBeNull();

    await act(async () => {
      modelTrigger!.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      modelTrigger!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle();

    expect(document.body.textContent).toContain("Claude Sonnet 5.5");
    expect(document.body.textContent).toContain("Claude Opus 5.5");
    expect(document.body.textContent).not.toContain("GPT-6 Astra");
    expect(document.body.textContent).not.toContain("Gemini 3.8 Flash");
    expect(container!.querySelector('input[type="file"]')?.getAttribute("accept")).toContain(
      "image/jpeg"
    );
  });

  it("mostra Luna medium no Documento com Claude sem alterar a preferência salva", async () => {
    useSettingsStore.getState().updateParameters({
      model: "claude-sonnet-5-5",
      reasoningEffort: "high",
    });

    await act(async () => {
      root!.render(
        createElement(CommandComposerContainerV2, {
          sendMessage: async () => false,
          stopGeneration: () => undefined,
          isLoading: false,
          error: null,
          responseMode: "document",
        })
      );
    });

    const modelTrigger = container!.querySelector<HTMLButtonElement>(
      '[aria-label="Selecionar modelo"]'
    );
    const reasoningTrigger = container!.querySelector<HTMLButtonElement>(
      '[aria-label="Ajustar nível de raciocínio"]'
    );

    expect(modelTrigger?.textContent).toContain("GPT-6 Luna");
    expect(modelTrigger?.getAttribute("title")).toContain(
      "Documento usa GPT-6 Luna com Raciocínio médio."
    );
    expect(reasoningTrigger?.hasAttribute("disabled")).toBe(true);
    expect(useSettingsStore.getState().parameters).toMatchObject({
      model: "claude-sonnet-5-5",
      reasoningEffort: "high",
    });
  });

  it("sends the quick-action text through the current sendMessage (B3)", async () => {
    const sendMessage = vi.fn(async (_content: string) => true);
    await act(async () => {
      root!.render(
        createElement(CommandComposerContainerV2, {
          sendMessage,
          stopGeneration: () => undefined,
          isLoading: false,
          error: null,
        })
      );
    });
    await settle();

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("gaucho:send-message", { detail: { text: "Continue." } })
      );
    });
    await settle(20);

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage.mock.calls[0][0]).toBe("Continue.");
  });
});
