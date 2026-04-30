import { create } from "zustand";
import type { ActivePanelTab, ActiveSelection, AppMode, CanvasOverlayState, MessageArtifact } from "@/types";

interface ArtifactState {
  artifactOpen: boolean;
  activeArtifact: MessageArtifact | null;
  artifactMessageId: string | null;
}

interface UIState extends ArtifactState {
  activeMode: AppMode;
  imageSize: string;
  imageQuality: string;
  activePanelTab: ActivePanelTab;
  canvasPosition: { x: number; y: number };
  canvasDimensions: { w: number; h: number };
  canvasMaximized: boolean;
  activeSelection: ActiveSelection | null;
  setActiveMode: (mode: AppMode) => void;
  setImageSize: (size: string) => void;
  setImageQuality: (quality: string) => void;
  setActivePanelTab: (tab: ActivePanelTab) => void;
  setCanvasPosition: (pos: { x: number; y: number }) => void;
  setCanvasDimensions: (dim: { w: number; h: number }) => void;
  setCanvasMaximized: (maximized: boolean) => void;
  setActiveSelection: (selection: ActiveSelection | null) => void;
  openArtifact: (artifact: MessageArtifact, messageId?: string) => void;
  closeArtifact: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeMode: "chat",
  imageSize: "auto",
  imageQuality: "high",
  artifactOpen: false,
  activeArtifact: null,
  artifactMessageId: null,
  activePanelTab: "activity",
  canvasPosition: { x: 80, y: 80 },
  canvasDimensions: { w: 700, h: 520 },
  canvasMaximized: false,
  activeSelection: null,
  setActiveMode: (mode) => set({ activeMode: mode }),
  setImageSize: (size) => set({ imageSize: size }),
  setImageQuality: (quality) => set({ imageQuality: quality }),
  setActivePanelTab: (tab) => set({ activePanelTab: tab }),
  setCanvasPosition: (pos) => set({ canvasPosition: pos }),
  setCanvasDimensions: (dim) => set({ canvasDimensions: dim }),
  setCanvasMaximized: (maximized) => set({ canvasMaximized: maximized }),
  setActiveSelection: (selection) => set({ activeSelection: selection }),
  openArtifact: (artifact, messageId) =>
    set({
      artifactOpen: true,
      activeArtifact: artifact,
      artifactMessageId: messageId || null,
    }),
  closeArtifact: () =>
    set({ artifactOpen: false, activeArtifact: null, artifactMessageId: null }),
}));
