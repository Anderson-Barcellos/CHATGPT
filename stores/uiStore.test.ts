import { beforeEach, describe, expect, it } from "vitest";
import { useUIStore } from "@/stores/uiStore";

describe("uiStore context panel", () => {
  beforeEach(() => {
    useUIStore.setState({
      activePanelTab: "activity",
      contextPanelOpen: false,
    });
  });

  it("opens the panel and selects the requested tab atomically", () => {
    useUIStore.getState().openContextPanel("notes");

    expect(useUIStore.getState().contextPanelOpen).toBe(true);
    expect(useUIStore.getState().activePanelTab).toBe("notes");
  });

  it("preserves the active tab when opening without an override", () => {
    useUIStore.setState({ activePanelTab: "pulse" });
    useUIStore.getState().openContextPanel();

    expect(useUIStore.getState().contextPanelOpen).toBe(true);
    expect(useUIStore.getState().activePanelTab).toBe("pulse");
  });

  it("closes without changing the selected tab", () => {
    useUIStore.setState({ activePanelTab: "notes", contextPanelOpen: true });
    useUIStore.getState().closeContextPanel();

    expect(useUIStore.getState().contextPanelOpen).toBe(false);
    expect(useUIStore.getState().activePanelTab).toBe("notes");
  });
});

describe("Descobrir no painel operacional", () => {
  it("seleciona notícias ao abrir o painel e preserva a aba ao fechar", () => {
    useUIStore.setState({ activePanelTab: "notes", contextPanelOpen: false });
    useUIStore.getState().openContextPanel("discover");
    expect(useUIStore.getState().activePanelTab).toBe("discover");
    expect(useUIStore.getState().contextPanelOpen).toBe(true);
    useUIStore.getState().closeContextPanel();
    expect(useUIStore.getState().contextPanelOpen).toBe(false);
    expect(useUIStore.getState().activePanelTab).toBe("discover");
  });
});
