// Fluxo integrado do painel operacional; somente runtime e dados sintéticos isolados.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { access, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
assert.notEqual(repo, '/root/CHATGPT', 'QA exige worktree isolada');
const data = path.join(repo, 'data');
try { await access(data); throw new Error('QA exige data inexistente'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const out = process.env.DISCOVER_QA_OUTPUT || '/root/.cache/gaucho-discover-context/evidence/browser';
const port = process.env.DISCOVER_QA_PORT || '3148';
const DOCK = 1773; // espelha CONTEXT_SIDEBAR_BREAKPOINT
const base = `http://127.0.0.1:${port}/chat`;
const env = { PATH: '/usr/bin:/bin', NODE_ENV: 'production', NEXT_PUBLIC_BASE_PATH: '/chat',
  AUTH_ENABLED: 'true', AUTH_USERNAME: 'synthetic-user', AUTH_PASSWORD: 'synthetic-password',
  JWT_SECRET: 'synthetic-discover-panel-secret-not-production', GAUCHO_ISOLATED_RUNTIME: 'true', RATE_LIMIT_ENABLED: 'false' };
const articles = [1, 2, 3].map(n => ({ id: `synthetic-${n}`, title: `Notícia sintética ${n}: avanços da inteligência artificial`,
  summary: 'Um resumo sintético para conferir leitura e conforto no painel. '.repeat(5),
  content: Array.from({ length: 12 }, (_, i) => `Parágrafo ${i + 1}. ${'Texto sintético com contexto e explicações para testar leitura contínua. '.repeat(10)}`).join('\n\n'),
  topic: 'Pesquisa em IA', image: 'synthetic.png', publishedAt: '2026-10-24T12:00:00Z', createdAt: '2026-10-24T12:00:00Z',
  sources: [{ title: 'Fonte sintética', url: 'https://example.org/fonte' }] }));
const audio = Buffer.alloc(44 + 24000 * 2 * 3);
audio.write('RIFF'); audio.writeUInt32LE(audio.length - 8, 4); audio.write('WAVEfmt ', 8);
audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22);
audio.writeUInt32LE(24000, 24); audio.writeUInt32LE(48000, 28); audio.writeUInt16LE(2, 32);
audio.writeUInt16LE(16, 34); audio.write('data', 36); audio.writeUInt32LE(audio.length - 44, 40);
let server, browser, page, ownsData = false, log = '';
const results = [];
async function until(fn, label) {
  for (let i = 0; i < 100; i++) { if (await fn()) return; await new Promise(r => setTimeout(r, 100)); }
  throw new Error(`Timeout: ${label}`);
}
try {
  await mkdir(out, { recursive: true }); await mkdir(data); ownsData = true;
  await writeFile(path.join(data, 'discover.json'), JSON.stringify({ topics: ['Ciência'], articles, job: { status: 'idle' }, schedule: { enabled: false } }));
  await writeFile(path.join(data, 'conversations.json'), JSON.stringify([{ id: 'qa-conversation', title: 'Conversa sintética', messages: [], createdAt: '2026-10-24T12:00:00Z', updatedAt: '2026-10-24T12:00:00Z' }]));
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', port], { cwd: repo, env });
  server.stdout.on('data', b => log += b); server.stderr.on('data', b => log += b);
  await until(() => fetch(`${base}/login`).then(r => r.ok).catch(() => false), 'boot');
  browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'], headless: true, env });
  for (const [width, height, touch, theme] of [[1199, 1000, false, 'light'], [1280, 900, false, 'dark'], [1440, 1000, false, 'dark'], [1536, 1000, false, 'light'], [1772, 1000, false, 'dark'], [1773, 900, false, 'light'], [1920, 1000, false, 'dark'], [3440, 1000, false, 'dark'], [6880, 1000, false, 'light'], [820, 1180, true, 'light'], [390, 844, true, 'dark'], [320, 740, true, 'light'], [1100, 440, true, 'dark']]) {
    if (process.env.DISCOVER_QA_WIDTH && width !== Number(process.env.DISCOVER_QA_WIDTH)) continue;
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, colorScheme: theme, reducedMotion: 'reduce' });
    await context.addInitScript(t => { sessionStorage.setItem('gpt-splash-shown', '1'); localStorage.setItem('theme', t); }, theme);
    assert.equal((await context.request.post(`${base}/api/auth/login`, { data: { username: env.AUTH_USERNAME, password: env.AUTH_PASSWORD } })).status(), 200);
    page = await context.newPage(); page.setDefaultTimeout(12000);
    const errors = [], external = [], spoken = []; let reads = 0;
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin) { external.push(url.origin); return route.abort(); }
      if (url.pathname === '/chat/api/discover') reads++;
      if (url.pathname.includes('/api/discover/images/')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="260"><defs><linearGradient id="g"><stop stop-color="#193858"/><stop offset="1" stop-color="#417f8d"/></linearGradient></defs><rect width="900" height="260" fill="url(#g)"/><circle cx="700" cy="80" r="80" fill="#91c9ca" opacity=".5"/></svg>' });
      if (url.pathname === '/chat/api/tts/xai') { spoken.push(route.request().postDataJSON()); return route.fulfill({ contentType: 'audio/wav', body: audio }); }
      if (url.pathname === '/chat/api/discover/refresh') return route.fulfill({ json: { status: 'running' } });
      return route.continue();
    });
    await page.goto(base, { waitUntil: 'networkidle' });
    assert.ok(await page.title()); assert.equal(new URL(page.url()).pathname, '/chat');
    const composer = page.locator('.gc-composer-dock textarea'); await composer.fill('Rascunho preservado');
    await composer.evaluate(node => window.__qaComposer = node);
    assert.equal(await page.locator('a[href="/chat/discover"]').count(), 0);
    const mobile = width <= 767 || (touch && height <= 500);
    // Encaixe a partir de CONTEXT_SIDEBAR_BREAKPOINT (lib/layout/breakpoints.ts); abaixo, flutua sem diálogo.
    const docked = !mobile && width >= DOCK;
    const desktop = !mobile;
    const normalWidth = Math.min(Math.max(500, width * 0.4), 600);
    const expandedWidth = Math.min(Math.max(640, width * 0.5), 760);
    if (docked) await page.getByRole('button', { name: 'Abrir painel', exact: true }).click();
    else if (mobile) {
      const nav = page.locator('[data-mobile-primary-nav]');
      assert.deepEqual(await nav.locator('button').allTextContents().then(labels => labels.map(s => s.trim())), ['Nova conversa', 'Pulse', 'Descobrir', 'Notas', 'Rotinas']);
      const bounds = await nav.evaluate(node => Array.from(node.querySelectorAll('button')).map(button => {
        const rect = button.getBoundingClientRect();
        return { width: rect.width, height: rect.height, overflow: button.scrollWidth > button.clientWidth + 1 };
      }));
      assert.ok(bounds.every(rect => rect.width >= 44 && rect.height >= 44 && !rect.overflow), JSON.stringify(bounds));
      await page.screenshot({ path: `${out}/navigation-${width}-${theme}.png` });
      await nav.getByRole('button', { name: 'Descobrir', exact: true }).click();
    }
    else await page.getByRole('button', { name: 'Painel contextual', exact: true }).click();
    const panel = desktop ? page.locator('[data-workspace-region="context"]') : page.getByRole('dialog', { name: 'Painel contextual', exact: true });
    await panel.getByRole('tab', { name: 'Descobrir IA', exact: true }).click();
    const feed = panel.locator('[data-discover-scroll-root]');
    await feed.getByRole('heading', { name: articles[0].title, exact: true }).waitFor();
    assert.equal(await page.locator('[data-discover-scroll-root]').count(), 1);
    if (mobile) {
      const bounds = await panel.boundingBox(); assert.ok(Math.abs(bounds.width - width) <= 1); assert.ok(bounds.height >= height - 1);
    }
    else await until(async () => Math.abs((await panel.boundingBox()).width - normalWidth) < 1, 'largura normal fluida');
    if (desktop) {
      assert.equal(await panel.getAttribute('data-context-mode'), docked ? 'docked' : 'floating');
      assert.equal(await page.locator('[role="dialog"], .gc-context-drawer-overlay').count(), 0, 'desktop sem gaveta modal');
    }
    const tabs = panel.getByRole('tablist');
    assert.equal(await tabs.evaluate(node => node.scrollWidth > node.clientWidth + 1), false);
    assert.equal(await feed.locator('.line-clamp-3').count(), 3); assert.equal(spoken.length, 0);
    await page.screenshot({ path: `${out}/feed-${width}-${theme}.png` });
    const first = feed.locator('[data-discover-article="synthetic-1"]');
    await first.locator('button[aria-expanded]').click();
    await first.getByText('Fontes', { exact: true }).waitFor();
    await first.getByRole('button', { name: 'Ouvir matéria', exact: true }).click();
    assert.equal(spoken.length, 0);
    await first.getByRole('button', { name: 'Tocar', exact: true }).click();
    await until(() => spoken.length > 0, 'áudio');
    await first.getByRole('button', { name: 'Pausar', exact: true }).click();
    await feed.evaluate(node => { window.__qaFeed = node; node.scrollTop = 600; });
    const readsBefore = reads, audioBefore = spoken.length;
    if (desktop) {
      const originalWidth = (await panel.boundingBox()).width;
      const checkChatControls = async () => {
        const issues = await page.locator('.gc-chat-column').evaluate(node => {
          const bounds = node.getBoundingClientRect();
          return Array.from(node.querySelectorAll('header button, footer button, .gc-welcome-desktop button, textarea')).filter(control => {
            const rect = control.getBoundingClientRect();
            return rect.width > 0 && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1);
          }).map(control => control.getAttribute('aria-label') || control.textContent);
        });
        assert.deepEqual(issues, [], 'Controles do chat sem cortes');
        const columnWidth = (await page.locator('.gc-chat-column').boundingBox()).width;
        const welcome = page.locator('.gc-welcome-grid:visible');
        if (columnWidth < 800 && await welcome.count()) assert.ok(await welcome.evaluate(node => {
          const [intro, suggestions] = Array.from(node.children).map(child => child.getBoundingClientRect());
          return suggestions.top >= intro.bottom - 1;
        }), 'Boas-vindas empilhadas sem sobreposição no chat estreito');
        if (columnWidth < 640) {
          assert.equal(await page.getByRole('button', { name: 'Buscar conversas, notas e rotinas', exact: true }).isVisible(), false);
          assert.equal(await page.getByRole('button', { name: 'Buscar comandos', exact: true }).isVisible(), true);
        }
      };
      await checkChatControls();
      await feed.evaluate(node => {
        const top = node.getBoundingClientRect().top;
        const anchor = Array.from(node.querySelectorAll('p')).find(p => p.getBoundingClientRect().bottom > top);
        window.__qaAnchor = { node: anchor, offset: anchor.getBoundingClientRect().top - top };
      });
      await panel.getByRole('button', { name: 'Expandir canvas', exact: true }).click();
      await until(async () => Math.abs((await panel.boundingBox()).width - expandedWidth) < 1, 'ampliação fluida');
      await checkChatControls();
      assert.ok(await feed.evaluate(node => node === window.__qaFeed && node.scrollTop > 0));
      await until(() => feed.evaluate(node => Math.abs(window.__qaAnchor.node.getBoundingClientRect().top - node.getBoundingClientRect().top - window.__qaAnchor.offset) < 3), 'ponto de leitura após ampliar');
      assert.equal(await first.locator('button[aria-expanded]').getAttribute('aria-expanded'), 'true');
      await page.screenshot({ path: `${out}/expanded-${width}-${theme}.png` });
      if (width >= 3440) await panel.screenshot({ path: `${out}/panel-expanded-${width}-${theme}.png` });
      await panel.getByRole('button', { name: 'Reduzir canvas', exact: true }).click();
      await until(async () => Math.abs((await panel.boundingBox()).width - originalWidth) < 1, 'redução');
      await until(() => feed.evaluate(node => Math.abs(window.__qaAnchor.node.getBoundingClientRect().top - node.getBoundingClientRect().top - window.__qaAnchor.offset) < 3), 'ponto de leitura após reduzir');
      assert.equal(reads, readsBefore); assert.equal(spoken.length, audioBefore);
    }
    await feed.evaluate(node => node.scrollTop = node.scrollHeight);
    assert.ok(await feed.evaluate(node => node.scrollTop > 0 && node.scrollHeight > node.clientHeight));
    assert.equal(await feed.evaluate(node => node.scrollWidth > node.clientWidth + 1), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await panel.getByRole('tab', { name: 'Pulse', exact: true }).click();
    assert.equal(await panel.locator('[data-audio-engine]').count(), 0);
    assert.equal(await panel.locator('[data-discover-scroll-root]').count(), 0);
    await panel.getByRole('tab', { name: 'Notas', exact: true }).click();
    await panel.getByRole('tab', { name: 'Rotinas', exact: true }).click();
    await panel.getByRole('heading', { name: 'Nova rotina Pulse', exact: true }).waitFor();
    if (width === 1773) {
      // Uma abertura sobrevive a encaixado → flutuante → encaixado, sem gaveta nem véu.
      await page.setViewportSize({ width: 1772, height });
      await until(async () => await panel.getAttribute('data-context-mode') === 'floating', 'flutuante ao reduzir');
      assert.equal(await panel.getByRole('tab', { name: 'Rotinas', exact: true }).getAttribute('aria-selected'), 'true');
      assert.equal(await page.locator('[role="dialog"], .gc-context-drawer-overlay').count(), 0);
      await composer.fill('Rascunho preservado');
      await page.setViewportSize({ width: 1773, height });
      await until(async () => await panel.getAttribute('data-context-mode') === 'docked', 'encaixado ao ampliar');
      await until(async () => Math.abs((await panel.boundingBox()).width - 600) < 1, 'lateral aberta ao redimensionar');
      assert.equal(await panel.getByRole('tab', { name: 'Rotinas', exact: true }).getAttribute('aria-selected'), 'true');
    }
    if (desktop) await panel.getByRole('button', { name: 'Recolher painel', exact: true }).click();
    else { await page.keyboard.press('Escape'); await panel.waitFor({ state: 'detached' }); }
    assert.equal(await composer.inputValue(), 'Rascunho preservado');
    assert.ok(await composer.evaluate(node => node === window.__qaComposer));
    await composer.blur(); await page.keyboard.press('Control+k');
    await page.getByRole('option', { name: /Descobrir IA/ }).click();
    await panel.getByRole('heading', { name: articles[0].title, exact: true }).waitFor();
    assert.equal(await page.locator('[data-discover-scroll-root]').count(), 1);
    assert.equal(await page.locator('nextjs-portal').count(), 0);
    if (width === 1773) {
      // Criar conversa mantém a lateral aberta, como antes da unificação do estado.
      await page.keyboard.press('Control+Shift+n');
      await page.getByRole('heading', { name: 'Nova conversa', exact: true }).waitFor();
      await until(async () => Math.abs((await panel.boundingBox()).width - normalWidth) < 1, 'lateral preservada ao criar conversa');
      assert.equal(await panel.getByRole('tab', { name: 'Descobrir IA', exact: true }).getAttribute('aria-selected'), 'true');
    }
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    results.push({ width, height, theme, mobile, desktop, mode: mobile ? 'mobile' : docked ? 'docked' : 'floating', normalWidth: mobile ? width : normalWidth, expandedWidth: desktop ? expandedWidth : null, navigation: true, cards: true, audio: true, resize: desktop, breakpointResize: width === 1773, draft: true, console: true });
    await context.close();
  }
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2)); console.log(JSON.stringify(results));
} catch (error) { await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {}); throw error; }
finally {
  await browser?.close();
  if (server && server.exitCode === null && server.signalCode === null) { const exited = once(server, 'exit'); server.kill('SIGTERM'); const timer = setTimeout(() => server.kill('SIGKILL'), 4000); await exited; clearTimeout(timer); }
  await writeFile(`${out}/server.log`, log); if (ownsData) await rm(data, { recursive: true, force: true });
}
