// Fluxo integrado com dados próprios; nunca aponta para a produção ou providers.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, access, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
assert.notEqual(repo, '/root/CHATGPT', 'QA exige worktree isolada');
const data = path.join(repo, 'data');
try { await access(data); throw new Error('QA exige data inexistente'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const output = process.env.DISCOVER_QA_OUTPUT || '/root/.cache/gaucho-discover-sidebar-evidence';
const port = process.env.DISCOVER_QA_PORT || '3148';
const base = `http://127.0.0.1:${port}/chat`;
let server, browser, temporary, activePage, ownsData = false, log = '';
const checks = [];
const articles = [1, 2, 3].map(n => ({ id: `synthetic-${n}`, title: `Notícia sintética ${n}: avanços e contexto da inteligência artificial`,
  summary: 'Um resumo sintético para conferir leitura, navegação e conforto no painel.',
  content: Array.from({ length: 12 }, (_, i) => `Parágrafo ${i + 1}. ${'Este conteúdo sintético permite verificar a leitura contínua de uma notícia extensa, com contexto e explicações, sem acessar dados pessoais. '.repeat(5)}`).join('\n\n'),
  topic: 'Pesquisa em IA', publishedAt: '2026-10-10T12:00:00Z', createdAt: '2026-10-10T12:00:00Z',
  sources: [{ title: 'Fonte sintética', url: 'https://example.org/fonte' }] }));
const audio = Buffer.alloc(44 + 24000 * 2 * 3);
audio.write('RIFF'); audio.writeUInt32LE(audio.length - 8, 4); audio.write('WAVEfmt ', 8);
audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22);
audio.writeUInt32LE(24000, 24); audio.writeUInt32LE(48000, 28); audio.writeUInt16LE(2, 32);
audio.writeUInt16LE(16, 34); audio.write('data', 36); audio.writeUInt32LE(audio.length - 44, 40);
async function until(fn, message) {
  for (let i = 0; i < 150; i++) { if (await fn()) return; await new Promise(resolve => setTimeout(resolve, 100)); }
  throw new Error(`Timeout: ${message}`);
}
try {
  await mkdir(output, { recursive: true });
  temporary = await mkdtemp(path.join(os.tmpdir(), 'discover-sidebar-'));
  await mkdir(data); ownsData = true;
  await writeFile(path.join(data, 'discover.json'), JSON.stringify({ topics: ['Ciência'], articles, job: { status: 'idle' } }));
  await writeFile(path.join(data, 'conversations.json'), JSON.stringify([{ id: 'qa-conversation', title: 'Conversa sintética preservada', messages: [], createdAt: '2026-10-10T12:00:00Z', updatedAt: '2026-10-10T12:00:00Z' }]));
  const env = { PATH: '/usr/bin:/bin', NODE_ENV: 'production', NEXT_PUBLIC_BASE_PATH: '/chat',
    AUTH_ENABLED: 'true', AUTH_USERNAME: 'synthetic-user', AUTH_PASSWORD: 'synthetic-password',
    JWT_SECRET: 'synthetic-sidebar-secret-not-production', GAUCHO_ISOLATED_RUNTIME: 'true', RATE_LIMIT_ENABLED: 'false',
    XDG_CONFIG_HOME: path.join(temporary, 'config'), XDG_CACHE_HOME: path.join(temporary, 'cache') };
  const probe = createServer();
  probe.listen(Number(port), '127.0.0.1'); await once(probe, 'listening');
  await new Promise(resolve => probe.close(resolve));
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', port], { cwd: repo, env });
  server.stdout.on('data', chunk => { log += chunk; }); server.stderr.on('data', chunk => { log += chunk; });
  await until(async () => { if (server.exitCode !== null) throw new Error('Servidor encerrou; ver server-sidebar.log'); return fetch(`${base}/login`).then(r => r.ok).catch(() => false); }, 'boot');
  browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'], env });
  for (const [width, height, touch, theme] of [[1440, 1000, false, 'dark'], [1280, 900, false, 'light'], [820, 1180, true, 'light'], [390, 844, true, 'dark'], [320, 740, true, 'light'], [1100, 440, true, 'dark']]) {
    if (process.env.DISCOVER_QA_WIDTH && width !== Number(process.env.DISCOVER_QA_WIDTH)) continue;
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, colorScheme: theme, reducedMotion: 'reduce' });
    await context.addInitScript(theme => { sessionStorage.setItem('gpt-splash-shown', '1'); localStorage.setItem('theme', theme); }, theme);
    assert.equal((await context.request.post(`${base}/api/auth/login`, { data: { username: env.AUTH_USERNAME, password: env.AUTH_PASSWORD } })).status(), 200);
    const page = await context.newPage(); activePage = page; const errors = [], external = [], spoken = []; let reads = 0;
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin) { external.push(url.origin); return route.abort(); }
      if (url.pathname === '/chat/api/discover') reads++;
      if (url.pathname === '/chat/api/tts/xai') { spoken.push(route.request().postDataJSON()); return route.fulfill({ contentType: 'audio/wav', body: audio }); }
      if (url.pathname.includes('/api/realtime/')) throw new Error('Realtime proibido no feed');
      if (url.pathname === '/chat/api/discover/refresh') return route.fulfill({ json: { status: 'running' } });
      return route.continue();
    });
    await page.goto(base, { waitUntil: 'networkidle' });
    assert.ok(await page.title()); assert.equal(new URL(page.url()).pathname, '/chat');
    const composer = page.locator('textarea').first(); await composer.waitFor();
    await composer.fill('Rascunho preservado durante a leitura');
    await composer.evaluate(node => { window.__qaComposer = node; });
    if (width === 1280) {
      await page.getByRole('button', { name: 'Abrir painel', exact: true }).click();
      await page.locator('[data-workspace-region="context"]').evaluate(async node => {
        window.__qaPulse = node;
        // A referência de largura deve ser medida após a animação do Pulse.
        await Promise.all(node.getAnimations().map(animation => animation.finished));
      });
    }
    const chatWidthBefore = await page.locator('[data-workspace-region="chat"]').evaluate(node => node.getBoundingClientRect().width);
    const compact = width < 1024 || (touch && height <= 500);
    // A paisagem curta usa navegação mobile mesmo quando lg torna o rail visível.
    let entry = page.locator('a[href="/chat/discover"]:visible').first();
    if (!await entry.count()) {
      await page.getByRole('button', { name: 'Abrir conversas', exact: true }).filter({ visible: true }).first().click();
      entry = page.locator('a[href="/chat/discover"]:visible').first();
    }
    await entry.click();
    const panel = page.locator('[data-workspace-region="discover"]');
    await panel.getByRole('heading', { name: articles[0].title, exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/chat');
    assert.equal(await panel.getAttribute('data-discover-fullscreen'), String(compact));
    assert.equal(await page.locator('[data-workspace-region="chat"]').evaluate(node => node.getBoundingClientRect().width), chatWidthBefore, 'Painel sobreposto não divide espaço com o chat');
    assert.equal(await page.locator('[data-discover-scroll-root]').count(), 1);
    assert.equal(spoken.length, 0);
    if (width === 1440 || width === 320) {
      await page.screenshot({ path: path.join(output, `feed-top-${width}-${theme}.png`) });
      await panel.getByRole('button', { name: 'Preferências do feed' }).click();
      const schedule = panel.getByRole('switch', { name: 'Atualização automática' });
      await schedule.click(); await until(async () => await schedule.getAttribute('aria-checked') === 'false', 'pausa no painel');
      await panel.getByRole('button', { name: 'Buscar novidades', exact: true }).click();
      await schedule.click(); await until(async () => await schedule.getAttribute('aria-checked') === 'true', 'retomada no painel');
      await panel.getByRole('textbox', { name: 'Novo assunto' }).fill('QA lateral');
      await panel.getByRole('button', { name: 'Adicionar assunto' }).click();
      const topic = panel.getByTitle('Remover QA lateral'); await topic.waitFor();
      if (width === 320) await page.screenshot({ path: path.join(output, 'preferences-320-light.png') });
      await topic.click(); await topic.waitFor({ state: 'detached' });
      await panel.getByRole('button', { name: 'Preferências do feed' }).click();
    }
    await panel.getByRole('button', { name: 'Ler a matéria', exact: true }).first().click();
    await panel.getByRole('button', { name: 'Ouvir matéria', exact: true }).first().click();
    assert.equal(spoken.length, 0);
    await panel.getByRole('button', { name: 'Tocar', exact: true }).click();
    await until(() => spoken.length > 0, 'áudio');
    await panel.getByRole('button', { name: 'Pausar', exact: true }).click();
    await panel.locator('[data-discover-scroll-root]').evaluate(node => { window.__qaScroll = node; node.scrollTop = 1000; });
    const countBefore = reads, audioBefore = spoken.length;
    if (!compact) {
      await page.screenshot({ path: path.join(output, `sidebar-${width}-${theme}.png`) });
      await panel.getByRole('button', { name: 'Ampliar leitura' }).click();
      assert.equal(await panel.getAttribute('role'), 'dialog');
      assert.equal(await panel.getAttribute('aria-modal'), 'true');
      assert.ok(await page.evaluate(() => document.querySelector('[data-workspace-region="chat"]').closest('[inert]') !== null));
      assert.ok(await panel.locator('[data-discover-scroll-root]').evaluate(node => node === window.__qaScroll && node.scrollTop > 0));
      assert.equal(reads, countBefore); assert.equal(spoken.length, audioBefore);
      await page.screenshot({ path: path.join(output, `fullscreen-${width}-${theme}.png`) });
      await panel.getByRole('button', { name: 'Reduzir leitura' }).click();
      assert.equal(await panel.getAttribute('data-discover-fullscreen'), 'false');
      assert.ok(await panel.evaluate(node => node.getBoundingClientRect().width <= Math.min(360, node.parentElement.clientWidth * 0.32) + 1), 'Reduzir restaura a largura física da lateral');
      assert.equal(await page.locator('[data-workspace-region="chat"]').evaluate(node => node.getBoundingClientRect().width), chatWidthBefore);
      assert.equal(await panel.getByRole('button', { name: 'Recolher', exact: true }).count(), 1);
      assert.equal(await panel.locator('[data-audio-engine]').count(), 1);
      assert.equal(reads, countBefore); assert.equal(spoken.length, audioBefore);
      if (width === 1280) {
        assert.ok(await page.locator('[data-workspace-region="context"]').evaluate(node => node === window.__qaPulse && node.dataset.collapsed === 'false'));
        const clippedControls = await page.locator('[data-workspace-region="chat"]').evaluate(node => {
          const chat = node.parentElement; const bounds = chat.getBoundingClientRect();
          return Array.from(chat.querySelectorAll('button, textarea')).filter(control => {
            const rect = control.getBoundingClientRect();
            return rect.width > 0 && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1);
          }).map(control => control.getAttribute('aria-label') || control.textContent);
        });
        if (clippedControls.length) await writeFile(path.join(output, 'layout-failure.json'), JSON.stringify(await page.evaluate(() => Array.from(document.querySelectorAll('[data-workspace-region], .gc-clinical-shell')).map(node => ({ region: node.getAttribute('data-workspace-region'), full: node.getAttribute('data-discover-fullscreen'), rect: node.getBoundingClientRect().toJSON(), width: getComputedStyle(node).width, position: getComputedStyle(node).position, scrollLeft: node.scrollLeft, parent: node.parentElement.getBoundingClientRect().toJSON() }))), null, 2));
        assert.deepEqual(clippedControls, [], 'Controles do chat devem caber com Pulse e Descobrir abertos');
        await page.screenshot({ path: path.join(output, 'sidebar-reduced-with-pulse-1280.png') });
      }
    }
    await panel.locator('[data-discover-scroll-root]').evaluate(node => node.scrollTop = node.scrollHeight);
    await panel.getByRole('heading', { name: articles[2].title, exact: true }).waitFor();
    assert.ok(await panel.locator('[data-discover-scroll-root]').evaluate(node => node.scrollHeight > node.clientHeight && node.scrollTop > 0));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await panel.locator('[data-discover-scroll-root]').evaluate(node => node.scrollWidth > node.clientWidth + 1), false);
    await panel.locator('[data-discover-scroll-root]').evaluate(node => node.scrollTop = 0);
    if (compact) {
      const back = panel.getByRole('button', { name: 'Voltar ao chat' });
      await back.focus(); await page.keyboard.press('Shift+Tab');
      assert.ok(await panel.evaluate(node => node.contains(document.activeElement)));
      await page.screenshot({ path: path.join(output, `fullscreen-${width}-${height}-${theme}.png`) });
    }
    await panel.getByRole('button', { name: compact ? 'Voltar ao chat' : 'Voltar às conversas' }).focus();
    await page.keyboard.press('Escape'); await panel.waitFor({ state: 'detached' });
    assert.equal(await page.getByRole('dialog', { name: 'Conversas', exact: true }).count(), 0, 'Fechar Descobrir retorna ao chat, sem reabrir a gaveta');
    assert.equal(await composer.inputValue(), 'Rascunho preservado durante a leitura');
    assert.ok(await composer.evaluate(node => node === window.__qaComposer));
    assert.equal(await page.locator('[data-audio-engine]').count(), 0);
    await composer.blur(); await page.keyboard.press('Control+k');
    await page.getByRole('option', { name: /Descobrir IA/ }).click();
    await panel.getByRole('heading', { name: articles[0].title, exact: true }).waitFor();
    await panel.getByRole('button', { name: compact ? 'Voltar ao chat' : 'Voltar às conversas' }).click();
    await panel.waitFor({ state: 'detached' });
    await until(() => page.evaluate(() => document.activeElement?.matches('a[href="/chat/discover"], button[aria-label="Abrir conversas"], button[aria-label="Buscar conversas, notas e rotinas"]')), 'retorno do foco à navegação após paleta');
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    checks.push(`${width}x${height}/${theme}/touch=${touch}: abertura/rolagem/ampliação/áudio/foco/rascunho/paleta sem erros`);
    await context.close();
  }
  await writeFile(path.join(output, 'sidebar-results.json'), JSON.stringify({ passed: checks.length, checks }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: path.join(output, 'sidebar-failure.png') }).catch(() => undefined);
  }
  throw error;
} finally {
  await browser?.close().catch(() => undefined);
  if (server && server.exitCode === null && server.signalCode === null) {
    const exited = once(server, 'exit'); server.kill('SIGTERM');
    const timer = setTimeout(() => server.kill('SIGKILL'), 4000);
    try { await exited; } finally { clearTimeout(timer); }
  }
  await writeFile(path.join(output, 'server-sidebar.log'), log);
  if (ownsData) await rm(data, { recursive: true, force: true });
  if (temporary) await rm(temporary, { recursive: true, force: true });
}
