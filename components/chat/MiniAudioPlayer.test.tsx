import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MiniAudioPlayer } from "@/components/chat/MiniAudioPlayer";

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

describe("MiniAudioPlayer", () => {
  it("opens with TTS selected without starting either engine", () => {
    const markup = renderToStaticMarkup(
      <MiniAudioPlayer
        content="Texto para leitura."
        messageId="assistant-1"
        onClose={() => undefined}
      />
    );

    expect(markup).toContain('data-audio-engine="standard"');
    expect(markup).toContain('aria-label="Escolher TTS padrão"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain("Realtime 2.1");
    expect(markup).toContain('aria-label="Tocar"');
    expect(assistantTts.togglePlay).not.toHaveBeenCalled();
    expect(realtimeTts.start).not.toHaveBeenCalled();
  });
});
