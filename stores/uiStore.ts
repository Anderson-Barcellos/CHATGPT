import { create } from "zustand";
import { AppMode, ArtifactContentType } from "@/types";

interface ArtifactState {
  artifactOpen: boolean;
  artifactContent: string;
  artifactType: ArtifactContentType;
  artifactTitle: string;
}

interface UIState extends ArtifactState {
  activeMode: AppMode;
  imageSize: string;
  imageQuality: string;
  setActiveMode: (mode: AppMode) => void;
  setImageSize: (size: string) => void;
  setImageQuality: (quality: string) => void;
  openArtifact: (content: string, type: ArtifactContentType, title?: string) => void;
  closeArtifact: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeMode: "chat",
  imageSize: "auto",
  imageQuality: "high",
  artifactOpen: false,
  artifactContent: "",
  artifactType: "markdown",
  artifactTitle: "",
  setActiveMode: (mode) => set({ activeMode: mode }),
  setImageSize: (size) => set({ imageSize: size }),
  setImageQuality: (quality) => set({ imageQuality: quality }),
  openArtifact: (content, type, title) =>
    set({ artifactOpen: true, artifactContent: content, artifactType: type, artifactTitle: title || "" }),
  closeArtifact: () =>
    set({ artifactOpen: false, artifactContent: "", artifactType: "markdown", artifactTitle: "" }),
}));
