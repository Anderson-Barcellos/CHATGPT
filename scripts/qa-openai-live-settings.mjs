// Sonda do OpenAI Live no player das mensagens e nas Configurações: dados sintéticos,
// runtime isolado e a rota de leitura interceptada (nenhuma chamada paga).
// Uso: node scripts/qa-openai-live-settings.mjs  (saída em LIVE_QA_OUTPUT)
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
assert.notEqual(repo, '/root/CHATGPT', 'QA exige cópia isolada');
const data = path.join(repo, 'data');
try { await access(data); throw new Error('QA exige data inexistente'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const out = process.env.LIVE_QA_OUTPUT || '/root/.cache/gaucho-live-voice/evidence';
const port = process.env.LIVE_QA_PORT || '3192';
const base = `http://127.0.0.1:${port}/chat`;
const env = { PATH: '/usr/bin:/bin', NODE_ENV: 'production', NEXT_PUBLIC_BASE_PATH: '/chat',
  AUTH_ENABLED: 'true', AUTH_USERNAME: 'synthetic-user', AUTH_PASSWORD: 'synthetic-password',
  JWT_SECRET: 'synthetic-live-settings-secret-not-production', GAUCHO_ISOLATED_RUNTIME: 'true', RATE_LIMIT_ENABLED: 'false' };
const now = '2026-11-09T12:00:00Z';
const conversations = [{ id: 'qa-live', title: 'Leitura sintética', lifecycle: 'active', createdAt: now, updatedAt: now, messages: [
  { id: 'm-user-1', role: 'user', content: 'Lê isso pra mim, tchê.', timestamp: now },
  { id: 'm-assistant-1', role: 'assistant', modelId: 'gpt-6-luna', content: 'Resposta sintética curta para leitura ao vivo.', timestamp: now },
] }];

let server, browser; let ownsData = false; let log = '';
async function until(fn, what) { for (let i = 0; i < 150; i++) { if (await Promise.resolve(fn()).catch(() => false)) return; await new Promise(r => setTimeout(r, 100)); } throw new Error(`Timeout: ${what}`); }
const results = [];
try {
  await mkdir(out, { recursive: true }); await mkdir(data); ownsData = true;
  await writeFile(path.join(data, 'conversations.json'), JSON.stringify(conversations));
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', port], { cwd: repo, env });
  server.stdout.on('data', b => log += b); server.stderr.on('data', b => log += b);
  await until(() => fetch(`${base}/login`).then(r => r.ok), 'boot');
  browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'], headless: true, env });
  for (const [width, height, touch, theme] of [[1440, 900, false, 'dark'], [390, 844, true, 'light']]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, colorScheme: theme, reducedMotion: 'reduce' });
    await context.addInitScript(t => { sessionStorage.setItem('gpt-splash-shown', '1'); localStorage.setItem('theme', t); }, theme);
    assert.equal((await context.request.post(`${base}/api/auth/login`, { data: { username: env.AUTH_USERNAME, password: env.AUTH_PASSWORD } })).status(), 200);
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const liveBodies = [];
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (url.pathname.endsWith('/api/realtime/openai-live-speech')) {
        liveBodies.push(JSON.parse(route.request().postData() || '{}'));
        return route.fulfill({ status: 200, contentType: 'application/octet-stream', body: Buffer.alloc(4800) });
      }
      if (/\/api\/(tts|realtime\/grok-session)/.test(url.pathname)) return route.fulfill({ status: 503, json: { error: 'QA sem áudio pago' } });
      return route.continue();
    });
    await page.goto(base, { waitUntil: 'load' });
    await page.locator('.gc-assistant-bubble').first().waitFor();
    // Configurações: seção do Live com voz e ritmo, trocar para Bossa calmo.
    await page.evaluate(() => window.dispatchEvent(new Event('gaucho:open-settings')));
    const voice = page.getByRole('combobox', { name: 'Voz OpenAI Live' });
    await voice.scrollIntoViewIfNeeded();
    await voice.selectOption('bossa');
    await page.getByRole('combobox', { name: 'Ritmo OpenAI Live' }).selectOption('calmo');
    await page.locator('[data-slot="openai-live-settings"]').screenshot({ path: path.join(out, `settings-${width}.png`) });
    const stored = await page.evaluate(() => localStorage.getItem('gaucho:openai-live:v1'));
    assert.deepEqual(JSON.parse(stored), { voice: 'bossa', pace: 'calmo' });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    // Player das mensagens: as três caixinhas, Live só inicia ao tocar e manda a voz escolhida.
    const bubble = page.locator('.gc-assistant-bubble').first();
    if (touch) await bubble.click(); else await bubble.hover();
    await page.getByRole('button', { name: 'Abrir player de áudio' }).first().click();
    for (const name of ['Escolher Grok TTS com voz Orion', 'Escolher Grok Realtime', 'Escolher OpenAI Live 1.1']) await page.getByRole('button', { name }).waitFor();
    await page.getByRole('button', { name: 'Escolher OpenAI Live 1.1' }).click();
    assert.equal(await page.getByRole('button', { name: 'Escolher OpenAI Live 1.1' }).getAttribute('aria-pressed'), 'true');
    await page.waitForTimeout(400);
    assert.equal(liveBodies.length, 0, 'escolher o motor não pode iniciar leitura');
    await page.screenshot({ path: path.join(out, `player-${width}.png`) });
    await page.getByRole('button', { name: "Tocar", exact: true }).first().click();
    await until(() => liveBodies.length > 0, 'pedido do Live');
    assert.equal(liveBodies[0].voice, 'bossa'); assert.equal(liveBodies[0].pace, 'calmo');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(overflow, false, 'sem rolagem horizontal');
    assert.deepEqual(errors, []);
    results.push({ width, theme, stored: JSON.parse(stored), request: liveBodies[0], overflow });
    await context.close();
  }
  await writeFile(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
  console.log(`${results.length} cenários aprovados: seção nas Configurações, três motores no player, voz enviada só ao tocar.`);
} finally {
  await browser?.close().catch(() => {});
  if (server) { server.kill('SIGTERM'); await new Promise(r => setTimeout(r, 500)); }
  if (ownsData) await rm(data, { recursive: true, force: true });
  if (process.env.LIVE_QA_LOG) console.error(log.slice(-3000));
}
