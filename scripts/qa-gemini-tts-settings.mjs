// QA isolado de Configurações, mensagens e reprodução em segundo plano.
// Uso: xvfb-run -a node scripts/qa-gemini-tts-settings.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
assert.notEqual(repo, '/root/CHATGPT', 'QA exige cópia isolada');
const data = path.join(repo, 'data');
try { await access(data); throw new Error('QA exige data inexistente'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const out = process.env.GEMINI_QA_OUTPUT || '/root/.cache/gaucho-gemini-tts/browser';
const port = process.env.GEMINI_QA_PORT || '3192';
const base = `http://127.0.0.1:${port}/chat`;
const env = { PATH: '/usr/bin:/bin', NODE_ENV: 'production', NEXT_PUBLIC_BASE_PATH: '/chat',
  AUTH_ENABLED: 'true', AUTH_USERNAME: 'synthetic-user', AUTH_PASSWORD: 'synthetic-password',
  JWT_SECRET: 'synthetic-live-settings-secret-not-production', GAUCHO_ISOLATED_RUNTIME: 'true', RATE_LIMIT_ENABLED: 'false' };
const realProvider = process.env.GEMINI_QA_PROVIDER === '1';
if (realProvider) {
  assert.ok(process.env.GEMINI_API_KEY?.trim(), 'O smoke real exige chave no ambiente');
  env.GEMINI_API_KEY = process.env.GEMINI_API_KEY;
}
const now = '2026-11-09T12:00:00Z';
const conversations = [{ id: 'qa-live', title: 'Leitura sintética', lifecycle: 'active', createdAt: now, updatedAt: now, messages: [
  { id: 'm-user-1', role: 'user', content: 'Lê isso pra mim, tchê.', timestamp: now },
  { id: 'm-assistant-1', role: 'assistant', modelId: 'gpt-6-luna', content: 'Resposta sintética curta para leitura.', timestamp: now },
] }];
const pulseText = 'A geração sintética do Pulse pode ser ouvida com a Charon.';
const soundCaseText = 'Uma narração sintética do acervo para testar a escuta.';
const projectId = '11111111-1111-4111-8111-111111111111';
const versionId = '22222222-2222-4222-8222-222222222222';
const choice = value => ({ value, source: 'automatic' });
const summary = {
  id: versionId, projectId, title: 'Narração sintética', summary: 'Teste de escuta', status: 'ready',
  wordCount: 10, estimatedDurationSeconds: 4, requestedFormat: 'mp3', audio: { status: 'pending', format: 'mp3' },
  cover: { status: 'pending' }, progress: { phase: 'ready', ratio: 1, completedChunks: 1, totalChunks: 1, updatedAt: now },
  createdAt: now, completedAt: now,
};
const version = {
  ...summary, requestedSettings: { automatic: true, playbackMode: 'realtime', format: 'mp3', ttsProvider: 'grok' },
  effectiveSettings: { format: choice('mp3'), voice: choice('cedar'), speed: choice(1), instructions: choice('Leia o texto.') },
  direction: { title: summary.title, voice: 'cedar', speed: 1, summary: summary.summary, language: 'pt-BR', pronunciations: [], segmentDirections: [] },
};
const project = {
  id: projectId, title: summary.title, draftRevision: 1, activeVersionId: versionId, createdAt: now, updatedAt: now,
  draftText: soundCaseText, draftWordCount: 10, estimatedDurationSeconds: 4, versions: [summary],
};

async function playbackWave() {
  if (process.env.GEMINI_QA_WAV) return readFile(process.env.GEMINI_QA_WAV);
  const header = Buffer.from('524946460000000057415645666d74201000000001000100c05d000080bb0000020010006461746100000000', 'hex');
  const pcm = Buffer.alloc(12 * 48000);
  for (let offset = 0; offset < pcm.length; offset += 2) pcm.writeInt16LE(Math.round(Math.sin(offset / 24) * 300), offset);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

let server, browser; let ownsData = false; let log = '';
async function until(fn, what) { for (let i = 0; i < 150; i++) { if (await Promise.resolve(fn()).catch(() => false)) return; await new Promise(r => setTimeout(r, 100)); } throw new Error(`Timeout: ${what}`); }
const results = [];
try {
  await mkdir(out, { recursive: true }); await mkdir(data); ownsData = true;
  await writeFile(path.join(data, 'conversations.json'), JSON.stringify(conversations));
  await writeFile(path.join(data, 'pulse-runs.json'), JSON.stringify([
    { id: 'qa-run', taskId: 'qa-task', title: 'Rotina sintética', status: 'completed', content: pulseText, citations: [], createdAt: now, updatedAt: now },
  ]));
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', port], { cwd: repo, env });
  server.stdout.on('data', b => log += b); server.stderr.on('data', b => log += b);
  await until(() => fetch(`${base}/login`).then(r => r.ok), 'boot');
  const anonymous = await fetch(`${base}/api/tts/gemini`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"text":"Teste."}' });
  assert.equal(anonymous.status, 401);
  const wav = await playbackWave();
  browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'], headless: false,
    ignoreDefaultArgs: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'],
    env: { PATH: env.PATH, DISPLAY: process.env.DISPLAY, XAUTHORITY: process.env.XAUTHORITY },
  });
  for (const [width, height, touch, theme] of [[1440, 900, false, 'dark'], [390, 844, true, 'light']]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, colorScheme: theme, reducedMotion: 'reduce' });
    await context.addInitScript(t => { sessionStorage.setItem('gpt-splash-shown', '1'); localStorage.setItem('theme', t); }, theme);
    assert.equal((await context.request.post(`${base}/api/auth/login`, { data: { username: env.AUTH_USERNAME, password: env.AUTH_PASSWORD } })).status(), 200);
    if (realProvider && !touch) {
      const generated = await context.request.post(`${base}/api/tts/gemini`, {
        data: { text: 'A varanda ficou quieta depois da chuva. Ainda dava para ouvir os passarinhos.', pace: 'natural', expressiveness: 'equilibrada' },
      });
      assert.equal(generated.status(), 200);
      assert.equal(generated.headers()['content-type'], 'audio/wav');
      assert.equal(generated.headers()['cache-control'], 'private, no-store');
      const bytes = await generated.body();
      assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
      assert.ok(bytes.length > 48000);
      console.log(`Rota autenticada com Google real: ${bytes.length} bytes de WAV.`);
    } else if (!realProvider) {
      assert.equal((await context.request.post(`${base}/api/tts/gemini`, { data: { text: 'Teste.' } })).status(), 503);
    }
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(`${message.location().url}: ${message.text()}`);
    });
    const speechBodies = [];
    await page.addInitScript(() => {
      // A leitura em partes cria o elemento no toque e carrega cada parte depois;
      // o que identifica o áudio do Gemini é tocar um blob.
      const nativePlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function play() {
        if (this.src.startsWith('blob:')) window.geminiQaAudio = this;
        return nativePlay.call(this);
      };
    });
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (url.pathname.endsWith('/api/tts/gemini')) {
        speechBodies.push(JSON.parse(route.request().postData() || '{}'));
        return route.fulfill({ status: 200, contentType: 'audio/wav', body: wav });
      }
      if (url.pathname === '/chat/api/soundcase/grok-realtime/voices') {
        return route.fulfill({ json: { voices: [{ id: 'orion', name: 'Orion' }, { id: 'eve', name: 'Eve' }] } });
      }
      const soundCasePath = url.pathname.replace('/chat/api/soundcase/projects', '');
      if (url.pathname.startsWith('/chat/api/soundcase/projects')) {
        if (soundCasePath === '') return route.fulfill({ json: { projects: [project] } });
        if (soundCasePath === `/${projectId}`) return route.fulfill({ json: { project } });
        if (soundCasePath.endsWith('/source')) return route.fulfill({ json: { text: soundCaseText } });
        if (soundCasePath.endsWith(versionId)) return route.fulfill({ json: { version } });
        if (soundCasePath.endsWith('/versions')) return route.fulfill({ json: { versions: [summary] } });
      }
      if (/\/api\/tts/.test(url.pathname)) return route.fulfill({ status: 503, json: { error: 'QA sem áudio pago' } });
      return route.continue();
    });
    await page.goto(base, { waitUntil: 'load' });
    assert.equal(new URL(page.url()).pathname.replace(/\/$/, ''), '/chat');
    assert.equal(await page.title(), 'GPT - Cliente IA Multi-Modal');
    await page.locator('.gc-assistant-bubble').first().waitFor();
    // Configurações: Charon e Fronteira Técnica fixos; trocar a cadência para calma.
    await page.evaluate(() => window.dispatchEvent(new Event('gaucho:open-settings')));
    const settings = page.locator('[data-slot="gemini-tts-settings"]');
    await settings.getByText('Charon · fixa').scrollIntoViewIfNeeded();
    await settings.getByRole('combobox', { name: 'Cadência Gemini TTS' }).selectOption('calmo');
    await settings.getByRole('combobox', { name: 'Expressividade Gemini TTS' }).selectOption('alta');
    await settings.screenshot({ path: path.join(out, `settings-${width}.png`) });
    const stored = await page.evaluate(() => localStorage.getItem('gaucho:gemini-tts:v1'));
    assert.deepEqual(JSON.parse(stored), { pace: 'calmo', expressiveness: 'alta' });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    // Player das mensagens: duas caixinhas; Gemini só inicia ao tocar e manda a cadência escolhida.
    const bubble = page.locator('.gc-assistant-bubble').first();
    if (touch) await bubble.click(); else await bubble.hover();
    await page.getByRole('button', { name: 'Abrir player de áudio' }).first().click();
    for (const name of ['Escolher Grok TTS com voz Orion', 'Escolher Gemini TTS com voz Charon']) await page.getByRole('button', { name }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Escolher Grok Realtime' }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Escolher OpenAI Live 1.1' }).count(), 0);
    await page.getByRole('button', { name: 'Escolher Gemini TTS com voz Charon' }).click();
    assert.equal(await page.getByRole('button', { name: 'Escolher Gemini TTS com voz Charon' }).getAttribute('aria-pressed'), 'true');
    await page.waitForTimeout(400);
    assert.equal(speechBodies.length, 0, 'escolher o motor não pode iniciar leitura');
    await page.screenshot({ path: path.join(out, `player-${width}.png`) });
    await page.getByRole('button', { name: "Tocar", exact: true }).first().click();
    await until(() => speechBodies.length > 0, 'pedido Gemini');
    assert.deepEqual(speechBodies[0], { pace: 'calmo', expressiveness: 'alta', text: 'Resposta sintética curta para leitura.' });
    const player = page.locator('[data-audio-engine="gemini-tts"]');
    await player.getByRole('button', { name: 'Pausar', exact: true }).waitFor();
    await player.getByRole('link', { name: 'Baixar áudio Gemini WAV' }).waitFor();
    await player.getByRole('button', { name: 'Pausar', exact: true }).click();
    await player.getByText('Leitura pausada').waitFor();
    await player.getByRole('button', { name: 'Tocar', exact: true }).click();
    await player.getByText('Charon está lendo').waitFor();
    assert.equal(speechBodies.length, 1, 'pausar e retomar reaproveita o WAV');

    const [otherTab] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(() => { window.open('about:blank', '_blank'); }),
    ]);
    let hiddenTabPlayback = false;
    try {
      await otherTab.bringToFront();
      await page.waitForFunction(() => document.hidden, undefined, { polling: 100, timeout: 3000 });
      const start = await page.evaluate(() => window.geminiQaAudio.currentTime);
      await page.waitForFunction((time) => document.hidden && window.geminiQaAudio.currentTime >= time + 1 && !window.geminiQaAudio.paused, start, { polling: 100, timeout: 3500 });
      hiddenTabPlayback = true;
    } catch (error) {
      console.log(`Aba oculta não comprovada em ${width}px: ${error.message.split('\n')[0]}`);
    } finally {
      await otherTab.close();
      await page.bringToFront();
    }
    const cdp = await context.newCDPSession(page);
    const { windowId } = await cdp.send('Browser.getWindowForTarget');
    let minimizedPlayback = false;
    try {
      await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'minimized' } });
      const { bounds } = await cdp.send('Browser.getWindowBounds', { windowId });
      if (bounds.windowState === 'minimized') {
        const clock = await page.evaluate(() => window.geminiQaAudio.currentTime);
        await page.waitForFunction((time) => document.hidden && window.geminiQaAudio.currentTime >= time + 1 && !window.geminiQaAudio.paused, clock, { polling: 100, timeout: 3500 });
        minimizedPlayback = true;
      }
    } catch (error) {
      console.log(`Minimização não comprovada em ${width}px: ${error.message.split('\n')[0]}`);
    } finally {
      await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
      await cdp.detach();
      await page.bringToFront();
    }
    await player.getByRole('button', { name: 'Fechar player de áudio' }).click();
    assert.equal(await page.evaluate(() => window.geminiQaAudio.paused), true);

    if (touch) await page.locator('[data-mobile-primary-nav]').getByRole('button', { name: 'Pulse', exact: true }).click();
    else await page.getByRole('button', { name: 'Abrir painel', exact: true }).click();
    const run = page.locator('article[role="button"]').filter({ hasText: 'Rotina sintética' });
    await run.click();
    await run.getByRole('button', { name: 'Abrir player de áudio' }).click();
    await run.getByRole('button', { name: 'Escolher Gemini TTS com voz Charon' }).click();
    await run.getByRole('button', { name: 'Tocar', exact: true }).click();
    await run.getByText('Charon está lendo').waitFor();
    assert.deepEqual(speechBodies[1], { pace: 'calmo', expressiveness: 'alta', text: pulseText });
    await run.getByRole('button', { name: 'Fechar player de áudio' }).click();

    await page.goto(`${base}/soundcase`, { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Configurações do Soundcase', exact: true }).click();
    const engine = page.getByRole('combobox', { name: 'Leitura ao vivo' });
    assert.deepEqual(await engine.locator('option').evaluateAll(options => options.map(option => option.value)), ['openai', 'grok', 'gemini-tts']);
    await engine.selectOption('gemini-tts');
    assert.equal(await page.getByRole('combobox', { name: 'Cadência Gemini TTS' }).inputValue(), 'calmo');
    assert.equal(await page.getByRole('combobox', { name: 'Expressividade Gemini TTS' }).inputValue(), 'alta');
    assert.equal(speechBodies.length, 2);
    await page.getByRole('button', { name: 'Ouvir Narração sintética', exact: true }).click();
    await page.getByRole('button', { name: 'Ouvir com Gemini TTS', exact: true }).click();
    await page.getByText('Leitura em andamento', { exact: true }).waitFor();
    assert.deepEqual(speechBodies[2], { pace: 'calmo', expressiveness: 'alta', text: soundCaseText });
    await page.getByRole('button', { name: 'Parar leitura Realtime', exact: true }).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(overflow, false, 'sem rolagem horizontal');
    assert.deepEqual(errors, []);
    assert.equal(await page.locator('nextjs-portal').count(), 0);
    results.push({ width, theme, stored: JSON.parse(stored), requests: speechBodies, overflow, hiddenTabPlayback, minimizedPlayback });
    await context.close();
  }
  await writeFile(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
  console.log(`${results.length} cenários aprovados: preferências, início manual, pausa, retomada, Pulse e SoundCase.`);
  console.log(`Áudio em aba oculta: ${results.filter(result => result.hiddenTabPlayback).length}/${results.length}. Janela minimizada: ${results.filter(result => result.minimizedPlayback).length}/${results.length}.`);
} finally {
  await browser?.close().catch(() => {});
  if (server) { server.kill('SIGTERM'); await new Promise(r => setTimeout(r, 500)); }
  if (ownsData) await rm(data, { recursive: true, force: true });
  if (process.env.GEMINI_QA_LOG) console.error(log.slice(-3000));
}
