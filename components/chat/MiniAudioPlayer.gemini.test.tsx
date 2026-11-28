// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MiniAudioPlayer } from "@/components/chat/MiniAudioPlayer";

const assistantTts = {
  isOpen: false, status: "idle" as const, isPlaying: false, canPlay: true, error: null, clipIndex: 0, totalClips: 0,
  currentTime: 0, duration: 0, formattedCurrentTime: "0:00", formattedDuration: "0:00", progress: 0, canDownload: false,
  openAndPlay: vi.fn(), togglePlay: vi.fn(), stop: vi.fn(), seekBy: vi.fn(), downloadAudio: vi.fn(),
};

const reading = {
  status: "speaking", error: null as string | null, generationError: null as string | null, firstAudioMs: 900,
  clipIndex: 1, totalClips: 5, generatedClips: 3, currentTime: 75, duration: 250, durationEstimated: true,
  bufferedTime: 150, audioUrl: null as string | null, isActive: true, canResume: false,
  start: vi.fn(), stop: vi.fn(), stopPlayback: vi.fn(), toggle: vi.fn(), seekBy: vi.fn(),
};
let gemini = { ...reading };

vi.mock("@/hooks/useAssistantTts", () => ({ useAssistantTts: () => assistantTts }));
vi.mock("@/hooks/useGeminiTtsSpeech", () => ({ useGeminiTtsSpeech: () => gemini }));

let root: Root | null = null;
let host: HTMLDivElement;
const onClose = vi.fn();
const button = (label: string) => host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
const click = (label: string) => act(async () => button(label)!.click());

async function openGemini(state: Partial<typeof reading> = {}) {
  gemini = { ...reading, ...state };
  await act(async () => root!.render(createElement(MiniAudioPlayer, { content: "Texto para leitura.", messageId: "assistant-1", onClose })));
  await click("Escolher Gemini TTS com voz Charon");
  // Trocar de motor para o que estava tocando; o que interessa é o que acontece depois.
  vi.clearAllMocks();
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  host.remove();
  root = null;
});

describe("MiniAudioPlayer com Gemini TTS", () => {
  it("mostra tempo, progresso e o que ainda está sendo gerado", async () => {
    await openGemini();

    expect(host.textContent).toContain("1:15");
    expect(host.textContent).toContain("~4:10");
    expect(host.textContent).toContain("Charon está lendo · parte 2/5 · gerando 3/5");
    expect(host.querySelector<HTMLElement>('[data-slot="gemini-progress"]')!.style.width).toBe("30%");
    expect(host.querySelector<HTMLElement>('[data-slot="gemini-buffered"]')!.style.width).toBe("60%");
  });

  it("volta e avança 15 segundos", async () => {
    await openGemini();
    await click("Voltar 15s");
    await click("Avançar 15s");

    expect(gemini.seekBy.mock.calls).toEqual([[-15], [15]]);
  });

  it("para a escuta sem descartar a geração; fechar descarta", async () => {
    await openGemini();
    await click("Parar");
    expect(gemini.stopPlayback).toHaveBeenCalledTimes(1);
    expect(gemini.stop).not.toHaveBeenCalled();

    await click("Fechar player de áudio");
    expect(gemini.stop).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("deixa salvar só depois da geração completa", async () => {
    await openGemini();
    expect(button("Salvar WAV após a geração completa")!.disabled).toBe(true);
    expect(host.querySelector("a[download]")).toBeNull();

    await act(async () => root!.unmount());
    root = createRoot(host);
    await openGemini({ status: "paused", generatedClips: 5, durationEstimated: false, audioUrl: "blob:leitura", isActive: false, canResume: true });
    const link = host.querySelector<HTMLAnchorElement>("a[download]")!;
    expect(link.getAttribute("aria-label")).toBe("Baixar áudio Gemini WAV");
    expect(link.getAttribute("href")).toBe("blob:leitura");
    expect(host.textContent).toContain("4:10");
    expect(host.textContent).not.toContain("~4:10");
  });

  it("mostra a falha de geração quando a escuta está parada", async () => {
    await openGemini({ status: "paused", isActive: false, canResume: true, generationError: "O limite do Gemini TTS foi atingido. Tente em instantes." });

    expect(host.textContent).toContain("Geração interrompida · O limite do Gemini TTS foi atingido. Tente em instantes.");
  });
});
