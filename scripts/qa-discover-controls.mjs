// QA isolado: somente fixtures próprias, sem providers ou workspace Studio real.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, readFile, access, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
assert.notEqual(repo, '/root/CHATGPT', 'Nunca executar QA no checkout vivo');
const data = path.join(repo, 'data');
try { await access(data); throw new Error('QA exige data inexistente'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const output = process.env.DISCOVER_QA_OUTPUT || '/root/.cache/gaucho-discover-controls-evidence';
let temporary;
let server;
let browser;
let log = '';
let ownsData = false;
try {
await mkdir(output, { recursive: true });
temporary = await mkdtemp(path.join(os.tmpdir(), 'discover-controls-'));
await mkdir(data);
ownsData = true;
const articles = [1, 2].map(n => ({ id: `synthetic-${n}`, title: `Notícia sintética ${n}`,
  summary: 'Resumo sintético que não deve ser narrado.', content: `Conteúdo completo da matéria ${n}. Uma explicação curta para testar a leitura por voz.`,
  topic: 'Pesquisa em IA', publishedAt: '2026-10-07T12:00:00Z', createdAt: '2026-10-07T12:00:00Z',
  sources: [{ title: 'Fonte sintética', url: 'https://example.org/fonte' }] }));
await writeFile(path.join(data, 'discover.json'), JSON.stringify({ topics: [], articles, job: { status: 'idle' } }));
const port = process.env.DISCOVER_QA_PORT || '3147';
const base = `http://127.0.0.1:${port}/chat`;
const env = { PATH: '/usr/bin:/bin', NODE_ENV: 'production', NEXT_PUBLIC_BASE_PATH: '/chat',
  AUTH_ENABLED: 'true', AUTH_USERNAME: 'synthetic-user', AUTH_PASSWORD: 'synthetic-password',
  JWT_SECRET: 'synthetic-discover-qa-secret-not-production', DISCOVER_RUNNER_TOKEN: 'synthetic-runner',
  GAUCHO_ISOLATED_RUNTIME: 'true', RATE_LIMIT_ENABLED: 'false',
  XDG_CONFIG_HOME: path.join(temporary, 'config'), XDG_CACHE_HOME: path.join(temporary, 'cache') };
const probe = createServer();
probe.listen(Number(port), '127.0.0.1'); await once(probe, 'listening');
await new Promise(resolve => probe.close(resolve));
server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', port],
  { cwd: repo, env, stdio: ['ignore', 'pipe', 'pipe'] });
server.stdout.on('data', b => { log += b; }); server.stderr.on('data', b => { log += b; });
const checks = [];
async function until(fn, label) {
  for (let i = 0; i < 150; i++) { if (await fn()) return; await new Promise(r => setTimeout(r, 200)); }
  throw new Error(`Timeout: ${label}`);
}
// WAV PCM sintético de 3 s, aceito pelo decoder de áudio do navegador.
const audio = Buffer.alloc(44 + 24000 * 2 * 3);
audio.write('RIFF'); audio.writeUInt32LE(audio.length - 8, 4); audio.write('WAVEfmt ', 8);
audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22);
audio.writeUInt32LE(24000, 24); audio.writeUInt32LE(48000, 28); audio.writeUInt16LE(2, 32);
audio.writeUInt16LE(16, 34); audio.write('data', 36); audio.writeUInt32LE(audio.length - 44, 40);
  await until(async () => { try { return (await fetch(`${base}/api/health/live`)).status === 200; } catch { return false; } }, 'boot isolado');
  assert.equal((await fetch(`${base}/api/discover/settings`, { method: 'PUT', body: JSON.stringify({ enabled: false }) })).status, 401);
  browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, env, args: ['--no-sandbox'] });
  for (const width of [1440, 390, 320]) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 960 }, colorScheme: theme });
      await context.addInitScript(t => { localStorage.setItem('theme', t); sessionStorage.setItem('gpt-splash-shown', 'true'); }, theme);
      const login = await context.request.post(`${base}/api/auth/login`, { data: { username: env.AUTH_USERNAME, password: env.AUTH_PASSWORD } });
      assert.equal(login.status(), 200);
      const enabled = await context.request.put(`${base}/api/discover/settings`, { data: { enabled: true } });
      assert.equal(enabled.status(), 200);
      assert.deepEqual((await enabled.json()).schedule, { enabled: true });
      const page = await context.newPage();
      const errors = []; const consoleErrors = []; const spoken = []; const external = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
      await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== new URL(base).origin) { external.push(url.origin); return route.abort(); }
        if (url.pathname === '/chat/api/tts/xai') {
          spoken.push(route.request().postDataJSON());
          return route.fulfill({ status: 200, contentType: 'audio/wav', body: audio });
        }
        if (url.pathname.includes('/api/realtime/')) throw new Error('Realtime não deve ser chamado');
        if (url.pathname === '/chat/api/discover/refresh') return route.fulfill({ json: { status: 'running' } });
        if (url.pathname.includes('/api/studio/')) return route.fulfill({ json: { enabled: true, unlocked: false } });
        return route.continue();
      });
      await page.goto(`${base}/discover`, { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: 'O que está acontecendo em IA' }).waitFor();
      assert.ok(await page.title());
      const toggle = page.getByRole('switch', { name: 'Atualização automática' });
      await toggle.click();
      await until(async () => await toggle.getAttribute('aria-checked') === 'false', 'pausa salva');
      const paused = await context.request.post(`${base}/api/discover/run-due`, { headers: { Authorization: 'Bearer synthetic-runner' } });
      assert.equal((await paused.json()).status, 'paused');
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal(await toggle.getAttribute('aria-checked'), 'false');
      assert.equal(await page.getByRole('button', { name: 'Buscar novidades', exact: true }).isEnabled(), true);
      await page.getByRole('button', { name: 'Buscar novidades', exact: true }).click();
      await toggle.click();
      await until(async () => await toggle.getAttribute('aria-checked') === 'true', 'retomada salva');
      const listen = page.getByRole('button', { name: /Ouvir matéria/ });
      await listen.first().click();
      assert.equal(spoken.length, 0);
      assert.equal(await page.getByRole('button', { name: 'Escolher Grok Realtime' }).count(), 0);
      await page.getByRole('button', { name: 'Tocar', exact: true }).click();
      await until(async () => spoken.length > 0, 'TTS solicitado');
      assert.ok(JSON.stringify(spoken).includes('Notícia sintética 1'));
      assert.ok(!JSON.stringify(spoken).includes('Resumo sintético'));
      assert.ok(!JSON.stringify(spoken).includes('example.org/fonte'));
      await page.getByRole('button', { name: 'Pausar', exact: true }).click();
      await page.getByRole('button', { name: 'Tocar', exact: true }).click();
      if ((width === 1440 && theme === 'dark') || (width === 320 && theme === 'light')) {
        await page.locator('[data-discover-article="synthetic-1"]').screenshot({ path: path.join(output, `tts-${width}-${theme}.png`) });
      }
      await listen.nth(1).click();
      assert.equal(await page.locator('[data-audio-engine]').count(), 1);
      await page.getByRole('button', { name: 'Fechar player de áudio' }).click();
      assert.equal(await page.locator('[data-audio-engine]').count(), 0);
      await page.getByRole('button', { name: 'Ler a matéria', exact: true }).first().click();
      assert.equal(await page.getByRole('button', { name: 'Recolher', exact: true }).count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const clipped = await page.locator('header a, [aria-label="Atualização automática"] button').evaluateAll(nodes => nodes.filter(node => {
        const box = node.getBoundingClientRect();
        return box.width > 0 && (box.left < -1 || box.right > innerWidth + 1);
      }).map(node => node.getAttribute('aria-label') || node.textContent));
      assert.deepEqual(clipped, [], 'Controles não podem ser escondidos pelo overflow-x-hidden');
      await page.locator('[data-discover-scroll-root]').evaluate(node => node.scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({ path: path.join(output, `discover-${width}-${theme}.png`), fullPage: true });
      const studio = page.getByRole('navigation', { name: 'Produtos Gaucho' }).getByRole('link', { name: 'Studio', exact: true });
      await studio.focus(); await page.keyboard.press('Enter');
      await page.waitForURL('**/chat/studio');
      await page.waitForLoadState('networkidle');
      await page.getByText('O workspace Python está bloqueado.', { exact: true }).waitFor();
      assert.equal(await page.locator('nav[aria-label="Produtos Gaucho"] a[aria-label="Studio"]').first().getAttribute('aria-current'), 'page');
      assert.deepEqual(errors, []);
      assert.deepEqual(consoleErrors, []);
      assert.deepEqual(external, []);
      checks.push(`${width}px/${theme}: pausa persistida, runner bloqueado, manual, retomada, TTS sob demanda, player único, expansão, Studio teclado, sem overflow/pageerror`);
      await context.close();
    }
  }
  const persisted = JSON.parse(await readFile(path.join(data, 'discover.json'), 'utf8'));
  assert.deepEqual(persisted.articles, articles);
  checks.push('matérias sintéticas preservadas integralmente');
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ passed: checks.length, checks }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
} finally {
  await browser?.close().catch(() => undefined);
  if (server && server.exitCode === null && server.signalCode === null) {
    const exited = once(server, 'exit'); server.kill('SIGTERM');
    const timer = setTimeout(() => server.kill('SIGKILL'), 4000);
    try { await exited; } finally { clearTimeout(timer); }
  }
  try { await writeFile(path.join(output, 'server.log'), log); }
  finally {
    if (ownsData) await rm(data, { recursive: true, force: true });
    if (temporary) await rm(temporary, { recursive: true, force: true });
  }
}
