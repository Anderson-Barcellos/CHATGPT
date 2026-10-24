import { createServer, get, type IncomingMessage, type Server } from 'http';
import type { AddressInfo } from 'net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';
import { signAuthToken } from './auth';
import { SignJWT } from 'jose';
import { attachRealtimeTranscription, hasSameOrigin } from './realtimeTranscription';
import { REALTIME_TRANSCRIPTION_PATH } from '../transcription/realtime';

const portOf = (server: Server | WebSocketServer) => (server.address() as AddressInfo).port;
const message = (ws: WebSocket, event: object) => ws.send(JSON.stringify(event));

describe('origem atrás do Apache com ProxyPreserveHost', () => {
  it('aceita Host preservado mesmo com X-Forwarded-Host concatenado pelo proxy', () => {
    expect(hasSameOrigin({ headers: {
      host: 'sonaris.us', origin: 'https://sonaris.us', 'x-forwarded-host': 'sonaris.us, sonaris.us',
    } } as unknown as IncomingMessage)).toBe(true);
  });

  it('não deixa X-Forwarded-Host forjado autorizar outra origem', () => {
    expect(hasSameOrigin({ headers: {
      host: 'sonaris.us', origin: 'https://outra.example', 'x-forwarded-host': 'outra.example',
    } } as unknown as IncomingMessage)).toBe(false);
  });
});

describe('WebSocket integrado: navegador → STT → provedor', () => {
  let server: Server;
  let provider: WebSocketServer;
  let bridge: WebSocketServer;
  let peer: WebSocket;
  let upstreamEvents: Array<Record<string, unknown>>;
  let cookie: string;
  let autoReady: boolean;
  const clients: WebSocket[] = [];

  beforeEach(async () => {
    vi.stubEnv('AUTH_ENABLED', 'true');
    vi.stubEnv('AUTH_USERNAME', 'teste');
    vi.stubEnv('AUTH_PASSWORD', 'senha-sintetica');
    vi.stubEnv('JWT_SECRET', 'segredo-sintetico-exclusivo-dos-testes-123456');
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '');
    autoReady = true;
    upstreamEvents = [];
    provider = new WebSocketServer({ port: 0, host: '127.0.0.1' });
    await new Promise<void>((resolve) => provider.once('listening', resolve));
    provider.on('connection', (ws) => {
      peer = ws;
      ws.on('message', (data) => {
        const event = JSON.parse(data.toString());
        upstreamEvents.push(event);
        if (event.type === 'session.update' && autoReady) message(ws, { type: 'session.updated' });
      });
    });
    server = createServer();
    bridge = attachRealtimeTranscription(server, {
      apiKey: 'chave-sintetica',
      connect: () => new WebSocket(`ws://127.0.0.1:${portOf(provider)}`),
      connectTimeoutMs: 1000, finishTimeoutMs: 1000,
    });
    server.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    cookie = `auth-token=${await signAuthToken()}`;
  });

  afterEach(async () => {
    for (const ws of clients.splice(0)) ws.terminate();
    for (const ws of bridge.clients) ws.terminate();
    for (const ws of provider.clients) ws.terminate();
    await Promise.all([
      new Promise<void>((resolve) => server.close(() => resolve())),
      new Promise<void>((resolve) => provider.close(() => resolve())),
    ]);
    vi.unstubAllEnvs();
  });

  const openClient = async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${portOf(server)}${REALTIME_TRANSCRIPTION_PATH}`, {
      headers: { Cookie: cookie, Origin: `http://127.0.0.1:${portOf(server)}` },
    });
    clients.push(ws);
    const events: Array<Record<string, unknown>> = [];
    ws.on('message', (data) => events.push(JSON.parse(data.toString())));
    ws.on('error', () => {});
    await new Promise<void>((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
    const waitFor = async (type: string) => {
      await vi.waitFor(() => expect(events.some((event) => event.type === type)).toBe(true), { timeout: 2500 });
      return events.find((event) => event.type === type)!;
    };
    return { ws, events, waitFor };
  };

  const rejectedStatus = (headers: Record<string, string>, path = REALTIME_TRANSCRIPTION_PATH) => new Promise<number>((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${portOf(server)}${path}`, { headers });
    clients.push(ws);
    ws.on('error', () => {});
    ws.on('unexpected-response', (_req, res) => { res.resume(); ws.terminate(); resolve(res.statusCode!); });
  });

  it('exige cookie válido, origem exata e rota reconhecida antes de abrir o provedor', async () => {
    const origin = `http://127.0.0.1:${portOf(server)}`;
    expect(await rejectedStatus({ Origin: origin })).toBe(401);
    expect(await rejectedStatus({ Origin: origin, Cookie: 'auth-token=invalida' })).toBe(401);
    expect(await rejectedStatus({ Origin: 'https://outro.example', Cookie: cookie })).toBe(403);
    expect(await rejectedStatus({ Cookie: cookie })).toBe(403);
    expect(await rejectedStatus({ Origin: origin, Cookie: cookie }, '/stt/api/outra')).toBe(404);
    expect(upstreamEvents).toEqual([]);
  });

  it('recusa sessão expirada', async () => {
    cookie = `auth-token=${await new SignJWT({ authenticated: true })
      .setProtectedHeader({ alg: 'HS256' }).setExpirationTime('0s')
      .sign(new TextEncoder().encode(process.env.JWT_SECRET))}`;
    expect(await rejectedStatus({ Origin: `http://127.0.0.1:${portOf(server)}`, Cookie: cookie })).toBe(401);
  });

  it('não abre a ponte com auth desativada ou configuração incompleta', async () => {
    const headers = { Origin: `http://127.0.0.1:${portOf(server)}`, Cookie: cookie };
    vi.stubEnv('AUTH_ENABLED', 'false');
    expect(await rejectedStatus(headers)).toBe(503);
    vi.stubEnv('AUTH_ENABLED', 'true');
    vi.stubEnv('JWT_SECRET', '');
    expect(await rejectedStatus(headers)).toBe(503);
    expect(upstreamEvents).toEqual([]);
  });

  it('respeita o prefixo público configurado', async () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/chat');
    expect(await rejectedStatus({ Origin: `http://127.0.0.1:${portOf(server)}`, Cookie: cookie })).toBe(404);
    const ws = new WebSocket(`ws://127.0.0.1:${portOf(server)}/chat${REALTIME_TRANSCRIPTION_PATH}`, {
      headers: { Origin: `http://127.0.0.1:${portOf(server)}`, Cookie: cookie },
    });
    clients.push(ws);
    await new Promise<void>((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
    expect(ws.readyState).toBe(WebSocket.OPEN);
  });

  it('configura o modelo no servidor e transmite PCM sem expor a chave', async () => {
    const client = await openClient();
    await client.waitFor('ready');
    expect(upstreamEvents[0]).toMatchObject({ type: 'session.update', session: { type: 'transcription' } });
    client.ws.send(Buffer.alloc(4800, 1));
    await vi.waitFor(() => expect(upstreamEvents).toHaveLength(2));
    expect(upstreamEvents[1]).toEqual({ type: 'input_audio_buffer.append', audio: Buffer.alloc(4800, 1).toString('base64') });
    expect(JSON.stringify(client.events)).not.toContain('chave-sintetica');
  });

  it('mostra deltas e espera todos os trechos ao parar, mesmo com finais fora de ordem', async () => {
    const client = await openClient();
    await client.waitFor('ready');
    client.ws.send(Buffer.alloc(4800));
    message(client.ws, { type: 'commit' });
    client.ws.send(Buffer.alloc(4800));
    message(client.ws, { type: 'stop' });
    await vi.waitFor(() => expect(upstreamEvents.filter((event) => event.type === 'input_audio_buffer.commit')).toHaveLength(2));
    message(peer, { type: 'input_audio_buffer.committed', item_id: 'a', previous_item_id: null });
    message(peer, { type: 'input_audio_buffer.committed', item_id: 'b', previous_item_id: 'a' });
    message(peer, { type: 'conversation.item.input_audio_transcription.delta', item_id: 'a', delta: 'Fígado normal.' });
    await vi.waitFor(() => expect(client.events.some((event) => event.text === 'Fígado normal.')).toBe(true));
    message(peer, { type: 'conversation.item.input_audio_transcription.completed', item_id: 'b', transcript: 'Rins normais.' });
    await vi.waitFor(() => expect(client.events.some((event) => event.text === 'Fígado normal. Rins normais.')).toBe(true));
    expect(client.events.some((event) => event.type === 'done')).toBe(false);
    message(peer, { type: 'conversation.item.input_audio_transcription.completed', item_id: 'a', transcript: 'Fígado sem alterações.' });
    expect(await client.waitFor('done')).toEqual({ type: 'done', text: 'Fígado sem alterações. Rins normais.' });
  });

  it('para sem fala sem enviar commit vazio', async () => {
    const client = await openClient();
    await client.waitFor('ready');
    message(client.ws, { type: 'stop' });
    expect(await client.waitFor('done')).toEqual({ type: 'done', text: '' });
    expect(upstreamEvents.filter((event) => event.type === 'input_audio_buffer.commit')).toHaveLength(0);
  });

  it.each(['null', '{', '{"type":"session.update","session":{"model":"arbitrario"}}'])('rejeita comando inválido %s', async (invalid) => {
    const client = await openClient();
    await client.waitFor('ready');
    client.ws.send(invalid);
    await client.waitFor('error');
    expect(upstreamEvents).toHaveLength(1);
  });

  it('rejeita áudio com amostra PCM incompleta', async () => {
    const client = await openClient();
    await client.waitFor('ready');
    client.ws.send(Buffer.alloc(3));
    expect((await client.waitFor('error')).message).toContain('PCM inválido');
  });

  it('preserva o parcial na falha sem transmitir o erro bruto do provedor', async () => {
    const client = await openClient();
    await client.waitFor('ready');
    message(peer, { type: 'conversation.item.input_audio_transcription.delta', item_id: 'a', delta: 'Cisto de 1,2 cm.' });
    message(peer, { type: 'error', error: { message: 'conteudo-interno-proibido' } });
    const error = await client.waitFor('error');
    expect(error.text).toBe('Cisto de 1,2 cm.');
    expect(JSON.stringify(error)).not.toContain('conteudo-interno-proibido');
  });

  it('avisa quando o provedor fecha durante o ditado', async () => {
    const client = await openClient();
    await client.waitFor('ready');
    peer.close();
    expect((await client.waitFor('error')).message).toContain('encerrou');
  });

  it('encerra o upstream quando o navegador desconecta', async () => {
    const client = await openClient();
    await client.waitFor('ready');
    client.ws.close();
    await vi.waitFor(() => expect(provider.clients.size).toBe(0));
  });

  it('limita conexões simultâneas', async () => {
    const a = await openClient();
    await a.waitFor('ready');
    const b = await openClient();
    await b.waitFor('ready');
    expect(await rejectedStatus({ Origin: `http://127.0.0.1:${portOf(server)}`, Cookie: cookie })).toBe(429);
  });

  it('handshake inválido não consome vagas de conexão', async () => {
    const invalidHandshake = () => new Promise<number>((resolve, reject) => {
      const request = get({
        hostname: '127.0.0.1', port: portOf(server), path: REALTIME_TRANSCRIPTION_PATH,
        headers: {
          Origin: `http://127.0.0.1:${portOf(server)}`, Cookie: cookie,
          Connection: 'Upgrade', Upgrade: 'websocket',
          'Sec-WebSocket-Key': 'invalida', 'Sec-WebSocket-Version': '13',
        },
      }, (response) => { response.resume(); resolve(response.statusCode!); });
      request.on('error', reject);
    });
    expect(await invalidHandshake()).toBe(400);
    expect(await invalidHandshake()).toBe(400);
    const client = await openClient();
    await client.waitFor('ready');
  });

  it('limita a espera pela conexão do modelo', async () => {
    autoReady = false;
    const client = await openClient();
    expect((await client.waitFor('error')).message).toContain('demorou para iniciar');
  });

  it('limita a espera pela transcrição final', async () => {
    const client = await openClient();
    await client.waitFor('ready');
    client.ws.send(Buffer.alloc(4800));
    message(client.ws, { type: 'stop' });
    expect((await client.waitFor('error')).message).toContain('final demorou');
  });
});
