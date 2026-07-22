import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuickActionsBar } from "@/components/chat/QuickActionsBar";

const assistantTts = {
  isOpen: false,
  status: "idle" as const,
  isPlaying: false,
  canPlay: true,
  error: null,
  clipIndex: 0,
  totalClips: 0,
  currentTime: 0,
  duration: 0,
  formattedCurrentTime: "0:00",
  formattedDuration: "0:00",
  progress: 0,
  canDownload: false,
  openAndPlay: vi.fn(),
  togglePlay: vi.fn(),
  stop: vi.fn(),
  seekBy: vi.fn(),
  downloadAudio: vi.fn(),
};

const realtimeTts = {
  status: "idle" as const,
  error: null,
  firstAudioMs: null,
  isActive: false,
  start: vi.fn(),
  stop: vi.fn(),
};

vi.mock("@/hooks/useAssistantTts", () => ({
  useAssistantTts: () => assistantTts,
}));

vi.mock("@/hooks/useRealtimeTtsLab", () => ({
  useRealtimeTtsLab: () => realtimeTts,
}));

vi.mock("@/hooks/useNotes", () => ({
  useNotes: () => ({ appendToNotes: vi.fn() }),
}));

vi.mock("@/hooks/useIsMobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/stores/uiStore", () => ({
  useUIStore: () => ({ setActivePanelTab: vi.fn() }),
}));

describe("QuickActionsBar audio entry point", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows one speaker entry point without a separate Realtime action", () => {
    const markup = renderToStaticMarkup(
      <QuickActionsBar
        content="Resposta pronta para leitura."
        messageId="assistant-1"
        streamStatus="completed"
        alwaysVisible
      />
    );

    expect(markup.match(/title="Abrir player de áudio"/g)).toHaveLength(1);
    expect(markup).not.toContain("Testar Realtime");
    expect(markup).not.toContain("<span>Realtime</span>");
  });
});
