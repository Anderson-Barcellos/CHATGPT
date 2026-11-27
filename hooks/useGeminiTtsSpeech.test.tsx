// @vitest-environment jsdom
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { useGeminiTtsSpeech } from "@/hooks/useGeminiTtsSpeech";

vi.mock("@/lib/tts/browserAudio", () => ({
  primeBrowserAudio: vi.fn(),
  describeAudioPlayError: vi.fn(() => "Áudio bloqueado"),
}));

type Pending = { text: string; signal: AbortSignal; resolve: (response: unknown) => void };

let root: Root | null = null;
let latest: ReturnType<typeof useGeminiTtsSpeech> | null = null;
let pending: Pending[] = [];
let created: Blob[] = [];
let playSpy: MockInstance<() => Promise<void>>;
const longText = "O Doppler mede a velocidade do fluxo pelo desvio de frequência do eco. ".repeat(36).trim();

function Probe() {
  const speech = useGeminiTtsSpeech();
  useEffect(() => { latest = speech; });
  return null;
}

function wavResponse(samples: number) {
  return { ok: true, blob: async () => new Blob([new Uint8Array(44 + samples * 2)], { type: "audio/wav" }) };
}

const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
const answer = async (index: number, response: unknown) => { pending[index].resolve(response); await flush(); };
const audio = () => playSpy.mock.contexts.at(-1) as HTMLAudioElement;
const emit = (type: string) => act(async () => { audio().dispatchEvent(new Event(type)); });

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  pending = [];
  created = [];
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  playSpy = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = vi.fn((blob: Blob) => { created.push(blob); return `blob:clip-${created.length}`; });
    static revokeObjectURL = vi.fn();
  });
  vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise((resolve) => {
    pending.push({ text: (JSON.parse(String(init.body)) as { text: string }).text, signal: init.signal!, resolve });
  })));
  await act(async () => root!.render(createElement(Probe)));
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  latest = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("leitura Gemini em partes", () => {
  it("toca a primeira parte curta enquanto as seguintes ainda são geradas", async () => {
    await act(async () => { void latest!.start({ text: longText }); });
    await flush();

    expect(pending).toHaveLength(2);
    expect(pending[0].text.length).toBeLessThanOrEqual(320);
    expect(longText.startsWith(pending[0].text)).toBe(true);
    expect(latest!.status).toBe("connecting");
    expect(latest!.totalClips).toBeGreaterThan(2);

    await answer(0, wavResponse(10));
    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(audio().src).toBe("blob:clip-1");
    await emit("playing");
    expect(latest!.status).toBe("speaking");
    expect(latest!.clipIndex).toBe(0);
    expect(latest!.firstAudioMs).not.toBeNull();
    expect(latest!.audioUrl).toBeNull();
    expect(pending.length).toBeGreaterThan(2);
  });

  it("emenda as partes na ordem e libera o WAV completo no fim", async () => {
    await act(async () => { void latest!.start({ text: longText }); });
    await flush();
    await answer(0, wavResponse(10));
    await emit("playing");

    // A parte 2 ainda não chegou quando a 1 termina: o player espera sem perder o fio.
    await emit("ended");
    expect(latest!.status).toBe("connecting");
    expect(latest!.clipIndex).toBe(1);
    await answer(1, wavResponse(20));
    expect(audio().src).toBe("blob:clip-2");
    await emit("playing");
    expect(latest!.status).toBe("speaking");

    for (let index = 2; index < pending.length; index += 1) await answer(index, wavResponse(30));
    const total = latest!.totalClips;
    expect(pending).toHaveLength(total);
    expect(pending.map((item) => item.text).join(" ")).toBe(longText);
    expect(created).toHaveLength(total + 1);
    expect(created.at(-1)!.size).toBe(44 + (10 + 20 + 30 * (total - 2)) * 2);
    expect(latest!.audioUrl).toBe(`blob:clip-${total + 1}`);

    for (let index = 2; index < total; index += 1) {
      await emit("ended");
      expect(audio().src).toBe(`blob:clip-${index + 1}`);
    }
    await emit("ended");
    expect(latest!.status).toBe("completed");

    // Retomar depois do fim recomeça da primeira parte.
    await act(async () => latest!.toggle());
    expect(audio().src).toBe("blob:clip-1");
    expect(latest!.clipIndex).toBe(0);
  });

  it("mantém o que já toca quando uma parte adiante falha e avisa ao chegar nela", async () => {
    await act(async () => { void latest!.start({ text: longText }); });
    await flush();
    await answer(0, wavResponse(10));
    await emit("playing");
    await answer(1, { ok: false, json: async () => ({ error: "O limite do Gemini TTS foi atingido. Tente em instantes." }) });

    expect(latest!.status).toBe("speaking");
    await emit("ended");
    expect(latest!.status).toBe("error");
    expect(latest!.error).toMatch(/limite do Gemini TTS/);
  });

  it("recarrega a parte quando o destrave de áudio interrompe a reprodução", async () => {
    // O destrave termina depois que a parte chegou e limpa o elemento, como no Chrome real.
    playSpy.mockImplementationOnce(function (this: HTMLAudioElement) {
      this.removeAttribute("src");
      return Promise.reject(new DOMException("The play() request was interrupted by a new load request.", "AbortError"));
    });
    await act(async () => { void latest!.start({ text: "Bah, que tarde linda." }); });
    await flush();
    await answer(0, wavResponse(5));
    expect(playSpy).toHaveBeenCalledTimes(2);
    expect(audio().src).toBe("blob:clip-1");
    expect(latest!.error).toBeNull();
    expect(latest!.status).not.toBe("error");
  });

  it("não trata como falha a pausa feita enquanto a parte ainda carregava", async () => {
    playSpy.mockRejectedValueOnce(new DOMException("The play() request was interrupted by a call to pause().", "AbortError"));
    await act(async () => { void latest!.start({ text: "Bah, que tarde linda." }); });
    await flush();
    await answer(0, wavResponse(5));
    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(latest!.error).toBeNull();
    expect(latest!.status).not.toBe("error");
  });

  it("registra a leitura na Media Session para a tela de bloqueio controlar e solta ao parar", async () => {
    const handlers = new Map<string, (() => void) | null>();
    const session = { metadata: null as unknown, playbackState: "none", setActionHandler: vi.fn((action: string, handler: (() => void) | null) => { handlers.set(action, handler); }) };
    vi.stubGlobal("MediaMetadata", class { constructor(public init: { title: string; artist: string }) {} });
    Object.defineProperty(navigator, "mediaSession", { value: session, configurable: true });
    try {
      await act(async () => { void latest!.start({ text: "Bah, que tarde linda." }); });
      await flush();
      await answer(0, wavResponse(5));
      await emit("playing");
      expect((session.metadata as { init: { title: string; artist: string } }).init).toEqual({ title: "Leitura em voz alta", artist: "Gemini TTS · Charon" });
      expect(session.playbackState).toBe("playing");
      const pause = vi.mocked(HTMLMediaElement.prototype.pause);
      pause.mockClear();
      await act(async () => handlers.get("pause")!());
      expect(pause).toHaveBeenCalledTimes(1);
      await emit("pause");
      expect(session.playbackState).toBe("paused");
      await act(async () => latest!.stop());
      expect(session.metadata).toBeNull();
      expect(handlers.get("play")).toBeNull();
      expect(handlers.get("pause")).toBeNull();
    } finally {
      Reflect.deleteProperty(navigator, "mediaSession");
    }
  });

  it("cancela as gerações em andamento ao parar", async () => {
    await act(async () => { void latest!.start({ text: longText }); });
    await flush();
    await act(async () => latest!.stop());
    expect(pending.every((item) => item.signal.aborted)).toBe(true);
    expect(latest!.status).toBe("idle");
  });

  it("lê texto curto em um pedido só", async () => {
    await act(async () => { void latest!.start({ text: "Bah, que tarde linda." }); });
    await flush();
    expect(pending).toHaveLength(1);
    await answer(0, wavResponse(5));
    expect(latest!.totalClips).toBe(1);
    expect(latest!.audioUrl).toBe("blob:clip-1");
    expect(created).toHaveLength(1);
  });
});
