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

describe("Descobrir independente do Pulse", () => {
  it("abre, amplia e fecha sem alterar o painel operacional", () => {
    useUIStore.setState({ discoverPanelOpen: false, discoverExpanded: false, activePanelTab: "notes", contextPanelOpen: true });
    useUIStore.getState().openDiscoverPanel();
    useUIStore.getState().setDiscoverExpanded(true);
    expect(useUIStore.getState().discoverPanelOpen).toBe(true);
    expect(useUIStore.getState().discoverExpanded).toBe(true);
    useUIStore.getState().closeDiscoverPanel();
    expect(useUIStore.getState().discoverPanelOpen).toBe(false);
    expect(useUIStore.getState().discoverExpanded).toBe(false);
    expect(useUIStore.getState().activePanelTab).toBe("notes");
    expect(useUIStore.getState().contextPanelOpen).toBe(true);
  });
});
