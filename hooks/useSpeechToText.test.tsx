// @vitest-environment jsdom
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSpeechToText } from "./useSpeechToText";
import { startLiveTranscription } from "@/lib/transcription/realtimeClient";

vi.mock("@/lib/transcription/realtimeClient", () => ({ startLiveTranscription: vi.fn() }));
class Recorder extends EventTarget {
  static last: Recorder;
  static isTypeSupported = () => true;
  state = "inactive";
  mimeType = "audio/webm";
  constructor() { super(); Recorder.last = this; }
  start() { this.state = "recording"; }
  stop() {
    this.state = "inactive";
    queueMicrotask(() => {
      this.dispatchEvent(Object.assign(new Event("dataavailable"), { data: new Blob(["x".repeat(3000)]) }));
      this.dispatchEvent(new Event("stop"));
    });
  }
}
let root: Root;
let element: HTMLDivElement;
let speech: ReturnType<typeof useSpeechToText>;
let preview = vi.fn<(text: string) => void>();
let finish = vi.fn<() => Promise<string | null>>();
let cancel = vi.fn<() => void>();
let stopTrack: ReturnType<typeof vi.fn>;
let getUserMedia: ReturnType<typeof vi.fn>;
let livePreview: (text: string) => void;
let clock: number;
function Harness() {
  const state = useSpeechToText({ onTranscriptPreview: preview });
  useEffect(() => { speech = state; });
  return null;
}
const start = async () => {
  await act(async () => { expect(await speech.startRecording()).toBe(true); });
  clock += 1500;
};
const stop = async () => {
  let text: string | null = null;
  await act(async () => { text = await speech.stopRecording(); });
  return text;
};
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  clock = 10000;
  vi.spyOn(Date, "now").mockImplementation(() => clock);
  preview = vi.fn(); finish = vi.fn().mockResolvedValue("Texto final."); cancel = vi.fn();
  stopTrack = vi.fn();
  getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  vi.stubGlobal("MediaRecorder", Recorder);
  vi.stubGlobal("AudioContext", class {
    resume = vi.fn().mockResolvedValue(undefined);
    close = vi.fn().mockResolvedValue(undefined);
    createMediaStreamSource = () => ({ connect: vi.fn(), disconnect: vi.fn() });
    createAnalyser = () => ({ frequencyBinCount: 8, getByteFrequencyData: vi.fn() });
  });
  vi.stubGlobal("requestAnimationFrame", vi.fn().mockReturnValue(1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: "Áudio inteiro recuperado." }))));
  vi.mocked(startLiveTranscription).mockImplementation((_stream, _context, onPreview) => {
    livePreview = onPreview;
    return { finish, cancel };
  });
  element = document.createElement("div"); document.body.append(element); root = createRoot(element);
  await act(async () => root.render(createElement(Harness)));
});
afterEach(async () => {
  await act(async () => root.unmount()); element.remove();
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks();
});
describe("ditado integrado no hook", () => {
  it("publica texto durante a gravação, finaliza sem HTTP e libera o microfone", async () => {
    await start();
    await act(async () => livePreview("Texto chegando"));
    expect(speech.status).toBe("recording");
    expect(speech.transcriptPreview).toBe("Texto chegando");
    expect(preview).toHaveBeenCalledWith("Texto chegando");
    expect(fetch).not.toHaveBeenCalled();
    expect(await stop()).toBe("Texto final.");
    expect(speech.status).toBe("idle");
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("recupera a gravação inteira quando o Realtime falha, substituindo a prévia", async () => {
    finish.mockResolvedValue(null);
    await start();
    await act(async () => livePreview("Texto parcial"));
    expect(await stop()).toBe("Áudio inteiro recuperado.");
    expect(fetch).toHaveBeenCalledOnce();
    const options = vi.mocked(fetch).mock.calls[0][1]!;
    expect((options.body as FormData).get("file")).toBeInstanceOf(File);
    expect(speech.transcriptPreview).toBe("Áudio inteiro recuperado.");
  });
  it("preserva parcial e sinaliza erro quando os dois caminhos falham", async () => {
    finish.mockResolvedValue(null);
    vi.mocked(fetch).mockRejectedValue(new Error("Falha de rede"));
    await start(); await act(async () => livePreview("Texto preservado"));
    expect(await stop()).toBeNull();
    expect(speech.status).toBe("error");
    expect(speech.transcriptPreview).toBe("Texto preservado");
  });
  it("não aceita HTTP truncado como transcrição completa", async () => {
    finish.mockResolvedValue(null);
    vi.mocked(fetch).mockResolvedValue(new Response('{"type":"delta","delta":"Parcial HTTP"}\n', {
      headers: { "content-type": "application/x-ndjson" },
    }));
    await start(); expect(await stop()).toBeNull();
    expect(speech.status).toBe("error");
    expect(speech.transcriptPreview).toBe("Parcial HTTP");
  });
  it("mantém NDJSON como fallback completo", async () => {
    finish.mockResolvedValue(null);
    vi.mocked(fetch).mockResolvedValue(new Response('{"type":"delta","delta":"Olá"}\n{"type":"done","text":"Olá, mundo."}\n', {
      headers: { "content-type": "application/x-ndjson" },
    }));
    await start(); expect(await stop()).toBe("Olá, mundo.");
    expect(preview).toHaveBeenCalledWith("Olá");
  });
  it("encerra silêncio sem gerar texto nem uma segunda chamada paga", async () => {
    finish.mockResolvedValue(""); await start();
    expect(await stop()).toBeNull(); expect(fetch).not.toHaveBeenCalled();
    expect(speech.status).toBe("error");
  });
  it("não abre dois microfones com cliques concorrentes", async () => {
    await act(async () => { await Promise.all([speech.startRecording(), speech.startRecording()]); });
    expect(getUserMedia).toHaveBeenCalledOnce();
  });
  it("cancela ao ocultar a página e ignora eventos atrasados", async () => {
    await start();
    await act(async () => {
      vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await act(async () => livePreview("Evento atrasado"));
    expect(speech.status).toBe("idle");
    expect(preview).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalled();
  });
  it("não ressuscita uma captura desmontada enquanto a permissão estava aberta", async () => {
    let grant!: (stream: MediaStream) => void;
    getUserMedia.mockReturnValue(new Promise<MediaStream>((resolve) => { grant = resolve; }));
    let started!: Promise<boolean>;
    await act(async () => { started = speech.startRecording(); });
    await act(async () => root.unmount());
    await act(async () => grant({ getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream));
    expect(await started).toBe(false);
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(startLiveTranscription).not.toHaveBeenCalled();
  });
  it("recusa permissão negada sem iniciar o provedor", async () => {
    getUserMedia.mockRejectedValue(new DOMException("negado", "NotAllowedError"));
    await act(async () => { expect(await speech.startRecording()).toBe(false); });
    expect(speech.status).toBe("error");
    expect(startLiveTranscription).not.toHaveBeenCalled();
  });
});
