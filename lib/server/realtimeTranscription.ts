import type { IncomingMessage, Server } from 'http';
import type { Duplex } from 'stream';
import { WebSocket, WebSocketServer } from 'ws';
import { AUTH_COOKIE_NAME, isAuthConfigurationValid, isAuthEnabled, verifyAuthToken } from './auth';
import { REALTIME_TRANSCRIPTION_PATH, RealtimeTranscript, realtimeSessionUpdate } from '../transcription/realtime';

interface RealtimeOptions {
  apiKey?: string;
  // Injeção usada pelos testes: a URL de produção nunca vem do cliente.
  connect?: (apiKey: string) => WebSocket;
  connectTimeoutMs?: number;
  finishTimeoutMs?: number;
  maxSessionMs?: number;
}

const MAX_BUFFERED_BYTES = 1024 * 1024;
const MIN_COMMIT_BYTES = 4800; // 100 ms, PCM16 mono a 24 kHz.

const rejectUpgrade = (socket: Duplex, status: number, message: string) => {
  const body = JSON.stringify({ error: message });
  socket.end(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
};

export const hasSameOrigin = (req: IncomingMessage): boolean => {
  try {
    // Apache (ProxyPreserveHost On) e Vite preservam o Host público.
    // ProxyAddHeaders pode concatenar X-Forwarded-Host; ele não é fonte de confiança.
    const host = req.headers.host;
    const origin = new URL(req.headers.origin ?? '');
    return ['https:', 'http:'].includes(origin.protocol) && origin.host === host;
  } catch {
    return false;
  }
};

export const attachRealtimeTranscription = (server: Server, {
  apiKey = process.env.OPENAI_API_KEY,
  connect = (key) => new WebSocket('wss://api.openai.com/v1/realtime?intent=transcription', {
    headers: { Authorization: `Bearer ${key}` },
    maxPayload: MAX_BUFFERED_BYTES,
    handshakeTimeout: 15000,
  }),
  connectTimeoutMs = 15000,
  finishTimeoutMs = 20000,
  maxSessionMs = 15 * 60 * 1000,
}: RealtimeOptions = {}) => {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024, perMessageDeflate: false });
  let active = 0;

  server.on('upgrade', async (req, socket, head) => {
    socket.on('error', () => {});
    const path = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}${REALTIME_TRANSCRIPTION_PATH}`;
    if (req.url?.split('?')[0] !== path) return rejectUpgrade(socket, 404, 'Not Found');
    if (!hasSameOrigin(req)) return rejectUpgrade(socket, 403, 'Forbidden');
    if (!isAuthConfigurationValid() || !isAuthEnabled()) return rejectUpgrade(socket, 503, 'Service Unavailable');
    const token = req.headers.cookie?.split(';').map((part) => part.trim())
      .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`))?.slice(AUTH_COOKIE_NAME.length + 1);
    if (!token || !await verifyAuthToken(token)) return rejectUpgrade(socket, 401, 'Unauthorized');
    if (!apiKey?.trim()) return rejectUpgrade(socket, 503, 'Service Unavailable');
    if (socket.destroyed) return;
    if (active >= 2) return rejectUpgrade(socket, 429, 'Too Many Requests');
    wss.handleUpgrade(req, socket, head, (client) => {
      // Handshakes recusados pelo ws não podem consumir as vagas do usuário.
      active += 1;
      let upstream: WebSocket;
      try {
        upstream = connect(apiKey);
      } catch {
        active -= 1;
        client.close(1011, 'Falha ao conectar à OpenAI.');
        return;
      }
      const transcript = new RealtimeTranscript();
      let ready = false;
      let stopping = false;
      let ended = false;
      let uncommittedBytes = 0;
      let sentCommits = 0;
      const completed = new Set<string>();
      let finishTimer: ReturnType<typeof setTimeout> | undefined;

      const send = (event: object) => {
        if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(event));
      };
      const fail = (message: string) => {
        if (ended) return;
        ended = true;
        send({ type: 'error', message, text: transcript.text });
        client.close(1011);
        upstream.close();
      };
      const sendUpstream = (event: object) => {
        if (upstream.readyState !== WebSocket.OPEN) return fail('A conexão com a OpenAI foi interrompida.');
        if (upstream.bufferedAmount > MAX_BUFFERED_BYTES || client.bufferedAmount > MAX_BUFFERED_BYTES) {
          return fail('A conexão está lenta demais para o ditado ao vivo. O texto recebido foi preservado.');
        }
        upstream.send(JSON.stringify(event));
      };
      const maybeFinish = () => {
        if (!stopping || ended || completed.size < sentCommits) return;
        ended = true;
        send({ type: 'done', text: transcript.text });
        client.close(1000);
        upstream.close();
      };
      const commit = () => {
        if (uncommittedBytes < MIN_COMMIT_BYTES) return;
        sentCommits += 1;
        uncommittedBytes = 0;
        sendUpstream({ type: 'input_audio_buffer.commit' });
      };
      const connectTimer = setTimeout(() => fail('A OpenAI demorou para iniciar o ditado. Tente novamente.'), connectTimeoutMs);
      const sessionTimer = setTimeout(() => fail('O ditado atingiu o limite de 15 minutos. Inicie outro trecho para continuar.'), maxSessionMs);
      // Verifica expiração da sessão também durante conexões longas.
      const heartbeat = setInterval(() => {
        void verifyAuthToken(token).then((session) => {
          if (!session) fail('Sua sessão expirou. Entre de novo para continuar.');
        });
        if (client.readyState === WebSocket.OPEN) client.ping();
      }, 30000);
      client.on('close', () => {
        active -= 1;
        ended = true;
        clearTimeout(connectTimer);
        clearTimeout(sessionTimer);
        clearTimeout(finishTimer);
        clearInterval(heartbeat);
        if (upstream.readyState === WebSocket.CONNECTING) upstream.terminate();
        else upstream.close();
      });
      client.on('error', () => fail('A conexão do ditado foi interrompida.'));
      upstream.on('open', () => sendUpstream(realtimeSessionUpdate()));
      upstream.on('error', () => fail('Não foi possível conectar à transcrição OpenAI. Tente novamente.'));
      upstream.on('close', () => {
        if (!ended) fail('A OpenAI encerrou a conexão. O texto recebido foi preservado.');
      });
      upstream.on('message', (data) => {
        if (ended) return;
        let event: Record<string, unknown>;
        try { event = JSON.parse(data.toString()); } catch { return fail('Resposta inválida da transcrição OpenAI.'); }
        if (!event || typeof event !== 'object') return fail('Resposta inválida da transcrição OpenAI.');
        if (event.type === 'session.updated') {
          ready = true;
          clearTimeout(connectTimer);
          send({ type: 'ready' });
        } else if (event.type === 'error' || event.type === 'conversation.item.input_audio_transcription.failed') {
          // Não encaminhar o erro bruto do provedor (pode incluir dados do pedido).
          fail('A OpenAI não conseguiu transcrever este trecho. O texto já recebido foi preservado.');
        } else if (transcript.update(event)) {
          if (event.type === 'conversation.item.input_audio_transcription.completed' && typeof event.item_id === 'string') completed.add(event.item_id);
          send({ type: 'transcript', text: transcript.text });
          maybeFinish();
        }
      });
      client.on('message', (data, binary) => {
        if (ended || stopping) return;
        if (!ready) return fail('O ditado ainda não está conectado. Tente novamente.');
        if (binary) {
          const audio = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
          if (!audio.length || audio.length % 2) return fail('Áudio PCM inválido.');
          uncommittedBytes += audio.length;
          sendUpstream({ type: 'input_audio_buffer.append', audio: audio.toString('base64') });
          return;
        }
        let event: { type?: string };
        try { event = JSON.parse(data.toString()); } catch { return fail('Mensagem de ditado inválida.'); }
        if (!event || typeof event !== 'object') return fail('Mensagem de ditado inválida.');
        if (event.type === 'commit') commit();
        else if (event.type === 'stop') {
          stopping = true;
          commit();
          finishTimer = setTimeout(() => fail('A transcrição final demorou demais. O texto recebido foi preservado.'), finishTimeoutMs);
          maybeFinish();
        } else fail('Comando de ditado inválido.');
      });
    });
  });

  server.on('close', () => {
    for (const client of wss.clients) client.terminate();
    wss.close();
  });
  return wss;
};
