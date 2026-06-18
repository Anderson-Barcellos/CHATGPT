import { create } from "zustand";
import type { ActivePanelTab, ActiveSelection, AppMode, MessageArtifact } from "@/types";

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
  activeSelection: ActiveSelection | null;
  setActiveMode: (mode: AppMode) => void;
  setImageSize: (size: string) => void;
  setImageQuality: (quality: string) => void;
  setActivePanelTab: (tab: ActivePanelTab) => void;
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
  activePanelTab: "notes",
  activeSelection: null,
  setActiveMode: (mode) => set({ activeMode: mode }),
  setImageSize: (size) => set({ imageSize: size }),
  setImageQuality: (quality) => set({ imageQuality: quality }),
  setActivePanelTab: (tab) => set({ activePanelTab: tab }),
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
