import { apiUrl } from "@/lib/utils";
import { REALTIME_TRANSCRIPTION_PATH } from "./realtime";

export interface LiveTranscription {
  finish: () => Promise<string | null>;
  cancel: () => void;
}

// A captura e o AudioContext pertencem ao hook. Falhas aqui mantêm o
// MediaRecorder rodando para recuperar o áudio inteiro pelo endpoint HTTP.
export function startLiveTranscription(
  stream: MediaStream,
  context: AudioContext,
  onTranscript: (text: string) => void,
): LiveTranscription {
  let socket: WebSocket | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let worklet: AudioWorkletNode | undefined;
  let ended = false;
  let stopping = false;
  let ready = false;
  let queuedBytes = 0;
  const queue: (string | ArrayBuffer)[] = [];
  let resolveResult!: (text: string | null) => void;
  const result = new Promise<string | null>((resolve) => { resolveResult = resolve; });
  let timer: ReturnType<typeof setTimeout>;
  const settle = (text: string | null) => {
    if (ended) return;
    ended = true;
    clearTimeout(timer);
    if (worklet) worklet.port.onmessage = null;
    source?.disconnect();
    worklet?.disconnect();
    queue.length = 0;
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
    resolveResult(text);
  };
  const send = (data: string | ArrayBuffer) => {
    if (ended) return;
    if (!ready) {
      queuedBytes += typeof data === "string" ? data.length : data.byteLength;
      if (queuedBytes > 1024 * 1024) return settle(null);
      queue.push(data);
      return;
    }
    if (socket?.readyState !== WebSocket.OPEN || socket.bufferedAmount > 1024 * 1024) {
      return settle(null);
    }
    socket.send(data);
  };
  timer = setTimeout(() => settle(null), 20000);
  void (async () => {
    try {
      if (!context.audioWorklet || typeof AudioWorkletNode === "undefined") return settle(null);
      await context.audioWorklet.addModule(apiUrl("/pcm-recorder.js"));
      if (ended || stopping) return settle(null);
      worklet = new AudioWorkletNode(context, "stt-pcm-recorder", {
        numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
      });
      worklet.onprocessorerror = () => settle(null);
      worklet.port.onmessage = ({ data }) => {
        if (ended) return;
        if (data.type === "audio") send(data.buffer);
        else if (data.type === "commit") send(JSON.stringify({ type: "commit" }));
        else if (data.type === "flushed") {
          source?.disconnect();
          worklet?.disconnect();
          send(JSON.stringify({ type: "stop" }));
        }
      };
      source = context.createMediaStreamSource(stream);
      source.connect(worklet);
      worklet.connect(context.destination); // Saída silenciosa mantém o worklet ativo.
      const url = new URL(apiUrl(REALTIME_TRANSCRIPTION_PATH), window.location.href);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(url);
      socket.onerror = () => settle(null);
      socket.onclose = () => settle(null);
      socket.onmessage = ({ data }) => {
        if (ended) return;
        try {
          const event = JSON.parse(data);
          if (!event || typeof event !== "object") return settle(null);
          if (event.type === "ready" && !ready) {
            ready = true;
            if (!stopping) clearTimeout(timer);
            for (const packet of queue) send(packet);
            queue.length = 0;
          } else if (event.type === "transcript" && typeof event.text === "string") {
            onTranscript(event.text);
          } else if (event.type === "done" && stopping && typeof event.text === "string") {
            settle(event.text.trim());
          } else if (event.type === "error") settle(null);
        } catch { settle(null); }
      };
    } catch { settle(null); }
  })();
  return {
    finish() {
      if (!ended && !stopping) {
        stopping = true;
        clearTimeout(timer);
        timer = setTimeout(() => settle(null), 25000);
        if (worklet) worklet.port.postMessage("stop");
        else settle(null);
      }
      return result;
    },
    cancel: () => settle(null),
  };
}
