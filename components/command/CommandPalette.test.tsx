// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandPalette } from "@/components/command/CommandPalette";

const mocks = vi.hoisted(() => ({ push: vi.fn(), setOpen: vi.fn(), openContextPanel: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("cmdk", () => {
  const Command = Object.assign(
    ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    {
      Input: () => <input />,
      List: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Empty: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Group: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
      Item: ({ children, onSelect }: { children: React.ReactNode; onSelect?: () => void }) => (
        <button type="button" onClick={onSelect}>{children}</button>
      ),
    }
  );
  return { Command };
});

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/command/CommandPaletteProvider", () => ({
  useCommandPaletteContext: () => ({ open: true, setOpen: mocks.setOpen }),
}));

vi.mock("@/hooks/useStartNewConversation", () => ({
  useStartNewConversation: () => vi.fn(),
}));

vi.mock("@/stores/settingsStore", () => ({
  useSettingsStore: () => ({
    parameters: { model: "gpt-6-luna", reasoningEffort: "medium" },
    updateParameters: vi.fn(),
  }),
}));

vi.mock("@/stores/uiStore", () => ({
  useUIStore: (selector: (state: { openContextPanel: (tab: string) => void }) => unknown) =>
    selector({ openContextPanel: mocks.openContextPanel }),
}));

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.push.mockReset();
  mocks.setOpen.mockReset();
  mocks.openContextPanel.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("CommandPalette", () => {
  it("abre Descobrir dentro do chat sem navegar", async () => {
    await act(async () => root.render(<CommandPalette />));
    const discover = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Descobrir IA"));
    await act(async () => discover!.click());
    expect(mocks.openContextPanel).toHaveBeenCalledWith("discover");
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.setOpen).toHaveBeenCalledWith(false);
  });
  it("restaura o atalho do Studio sem remover Descobrir IA ou SoundCase", async () => {
    await act(async () => root.render(<CommandPalette />));

    expect(container.textContent).toContain("Abrir SoundCase");
    expect(container.textContent).toContain("Descobrir IA");
    const studio = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Abrir Studio")
    );
    expect(studio).toBeDefined();

    await act(async () => studio!.click());
    expect(mocks.push).toHaveBeenCalledWith("/studio");
    expect(mocks.setOpen).toHaveBeenCalledWith(false);
  });
});
