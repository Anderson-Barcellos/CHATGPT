import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readWithOpenAILive } from "./openaiLiveSpeech";

const fake = vi.hoisted(() => ({ socket: undefined as SimulatedSocket | undefined }));

class SimulatedSocket extends EventEmitter {
  static OPEN = 1;
  static CONNECTING = 0;
  readyState = SimulatedSocket.OPEN;
  bufferedAmount = 0;
  sent: Array<{ type: string }> = [];
  close = vi.fn();
  send(raw: string) { this.sent.push(JSON.parse(raw)); }
  reply(value: object) { this.emit("message", Buffer.from(JSON.stringify(value))); }
}

vi.mock("ws", () => ({
  WebSocket: Object.assign(function () {
    fake.socket = new SimulatedSocket();
    return fake.socket;
  }, { OPEN: 1, CONNECTING: 0 }),
}));

describe("leitura Live com áudio verificado", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  function begin(signal = new AbortController().signal) {
    const reading = readWithOpenAILive("Rim direito com 1,2 cm.", "sintetica", signal);
    const socket = fake.socket!;
    socket.emit("open");
    socket.reply({ type: "session.started" });
    const pcm = Buffer.from([0, 8, 0, 8]);
    socket.reply({ type: "session.output_audio.delta", delta: pcm.toString("base64") });
    return { reading, socket, pcm };
  }

  function caption(socket: SimulatedSocket, delta: string, id = "a", start = 100) {
    socket.reply({ type: "session.output_transcript.delta", event_id: id, start_ms: start, delta });
  }

  it("só entrega PCM quando a transcrição é fiel e o encerramento está confirmado", async () => {
    const { reading, socket, pcm } = begin();
    const done = vi.fn();
    void reading.then(done);
    caption(socket, " com 1,2 cm.", "b", 200);
    caption(socket, "Rim direito", "a", 100);
    caption(socket, "evento duplicado", "a", 100);
    await vi.advanceTimersByTimeAsync(1_100);
    expect(socket.sent.at(-1)).toEqual({ type: "session.close" });
    expect(done).not.toHaveBeenCalled();
    socket.reply({ type: "session.closed", reason: "close_requested" });
    expect(await reading).toEqual(pcm);
  });

  it.each(["Rim esquerdo com 1,2 cm.", "Rim direito com 12 cm."])("recusa a fala alterada %s", async (spoken) => {
    const { reading, socket } = begin();
    const rejected = expect(reading).rejects.toThrow("mudou o texto");
    caption(socket, spoken);
    await vi.advanceTimersByTimeAsync(1_100);
    await rejected;
    expect(socket.close).toHaveBeenCalledOnce();
  });

  it("rejeita palavras extras recebidas durante o encerramento", async () => {
    const { reading, socket } = begin();
    const rejected = expect(reading).rejects.toThrow();
    caption(socket, "Rim direito com 1,2 cm.");
    await vi.advanceTimersByTimeAsync(1_100);
    caption(socket, " Comentário extra.", "b", 200);
    socket.reply({ type: "session.closed", reason: "close_requested" });
    await rejected;
  });

  it("cancela o provedor e deixa de enviar áudio de entrada", async () => {
    const controller = new AbortController();
    const { reading, socket } = begin(controller.signal);
    const rejected = expect(reading).rejects.toThrow("cancelada");
    controller.abort();
    const events = socket.sent.length;
    await vi.advanceTimersByTimeAsync(60_000);
    await rejected;
    expect(socket.sent).toHaveLength(events);
    expect(socket.close).toHaveBeenCalledOnce();
  });

  it("abre a sessão com a voz e o ritmo escolhidos", async () => {
    const controller = new AbortController();
    const reading = readWithOpenAILive("Texto curto.", "sintetica", controller.signal, { voice: "bossa", pace: "calmo" });
    const socket = fake.socket!;
    socket.emit("open");
    const start = socket.sent[0] as unknown as { session: { audio: { output: { voice: string } }; instructions: string } };
    expect(start.session.audio.output.voice).toBe("bossa");
    expect(start.session.instructions).toMatch(/devagar/i);
    const rejected = expect(reading).rejects.toThrow("cancelada");
    controller.abort();
    await rejected;
  });

  it("mantém Marin quando nenhum ajuste chega", async () => {
    const controller = new AbortController();
    const reading = readWithOpenAILive("Texto curto.", "sintetica", controller.signal);
    const socket = fake.socket!;
    socket.emit("open");
    const start = socket.sent[0] as unknown as { session: { audio: { output: { voice: string } } } };
    expect(start.session.audio.output.voice).toBe("marin");
    const rejected = expect(reading).rejects.toThrow("cancelada");
    controller.abort();
    await rejected;
  });
});
