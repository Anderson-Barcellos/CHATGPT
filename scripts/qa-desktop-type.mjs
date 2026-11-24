// Sonda de tipografia e respiro no desktop: mede fonte do balão, cabeçalho, composer e
// paddings da coluna em várias janelas, com dados sintéticos e runtime isolado.
// Uso: node scripts/qa-desktop-type.mjs  (saída em DESKTOP_TYPE_QA_OUTPUT)
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
const out = process.env.DESKTOP_TYPE_QA_OUTPUT || '/root/.cache/gaucho-desktop-type/evidence';
const port = process.env.DESKTOP_TYPE_QA_PORT || '3191';
const base = `http://127.0.0.1:${port}/chat`;
const env = { PATH: '/usr/bin:/bin', NODE_ENV: 'production', NEXT_PUBLIC_BASE_PATH: '/chat',
  AUTH_ENABLED: 'true', AUTH_USERNAME: 'synthetic-user', AUTH_PASSWORD: 'synthetic-password',
  JWT_SECRET: 'synthetic-desktop-type-secret-not-production', GAUCHO_ISOLATED_RUNTIME: 'true', RATE_LIMIT_ENABLED: 'false' };
const now = '2026-11-09T12:00:00Z';
const assistant = '## Título sintético da resposta\n\n' + Array.from({ length: 3 }, (_, i) => `Resposta sintética ${i + 1}. ${'Parágrafo comprido para medir a leitura do balão do assistente no desktop. '.repeat(6)}`).join('\n\n');
const conversations = [{ id: 'qa-conversation', title: 'Conversa sintética', lifecycle: 'active', createdAt: now, updatedAt: now, messages: [
  { id: 'm-user-1', role: 'user', content: 'Ajusta esse texto pra mim, tchê.', timestamp: now },
  { id: 'm-assistant-1', role: 'assistant', modelId: 'gpt-6-luna', content: assistant, timestamp: now },
] }];
// [largura, altura, dpr, toque]
const scenarios = (process.env.DESKTOP_TYPE_QA_SCENARIOS
  ? JSON.parse(process.env.DESKTOP_TYPE_QA_SCENARIOS)
  : [[390, 844, 3, true], [1024, 768, 1, false], [1280, 800, 1, false], [1436, 760, 1.3375, false], [1536, 864, 1.25, false], [1920, 1080, 1, false], [2560, 1440, 1, false]]);
const shots = process.env.DESKTOP_TYPE_QA_SHOTS !== '0';
const label = process.env.DESKTOP_TYPE_QA_LABEL || 'run';

const measure = () => {
  const r = v => Math.round(v * 10) / 10;
  const fs = sel => { const n = document.querySelector(sel); return n ? r(parseFloat(getComputedStyle(n).fontSize)) : null; };
  const box = sel => { const n = document.querySelector(sel); if (!n) return null; const b = n.getBoundingClientRect(); const s = getComputedStyle(n);
    return { x: r(b.x), w: r(b.width), pad: [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map(p => r(parseFloat(p))).join('/'), margin: s.margin }; };
  return {
    rootFont: fs('html'), bodyFont: fs('body'),
    bubbleP: fs('.gc-assistant-bubble p'), bubbleH2: fs('.gc-assistant-bubble h2'), userBubble: fs('.gc-user-bubble p') ?? fs('.gc-user-bubble'),
    headerTitle: fs('header h1') ?? fs('header [class*="title"]'), textarea: fs('textarea'),
    shell: box('.gc-atmosphere-shell'), chatPanel: box('.gc-chat-column'), thread: box('.gc-chat-thread'),
    assistantBubble: box('.gc-assistant-bubble'), composer: box('.gc-composer-width'),
  };
};

let server, browser; let ownsData = false; let log = '';
const results = [];
async function until(fn, what) { for (let i = 0; i < 150; i++) { if (await Promise.resolve(fn()).catch(() => false)) return; await new Promise(r => setTimeout(r, 100)); } throw new Error(`Timeout: ${what}`); }
try {
  await mkdir(out, { recursive: true }); await mkdir(data); ownsData = true;
  await writeFile(path.join(data, 'conversations.json'), JSON.stringify(conversations));
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', port], { cwd: repo, env });
  server.stdout.on('data', b => log += b); server.stderr.on('data', b => log += b);
  await until(() => fetch(`${base}/login`).then(r => r.ok), 'boot');
  browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'], headless: true, env });
  for (const theme of (process.env.DESKTOP_TYPE_QA_THEMES || 'dark').split(',')) for (const [width, height, dpr, touch] of scenarios) {
    await writeFile(path.join(data, 'conversations.json'), JSON.stringify(conversations));
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: touch, colorScheme: theme, reducedMotion: 'reduce' });
    await context.addInitScript(t => { sessionStorage.setItem('gpt-splash-shown', '1'); localStorage.setItem('theme', t); }, theme);
    assert.equal((await context.request.post(`${base}/api/auth/login`, { data: { username: env.AUTH_USERNAME, password: env.AUTH_PASSWORD } })).status(), 200);
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    await page.goto(base, { waitUntil: 'load' });
    await page.locator('.gc-assistant-bubble').first().waitFor().catch(async e => { await page.screenshot({ path: path.join(out, 'falha.png') }); console.error(await page.evaluate(() => document.body.innerText.slice(0, 600))); throw e; });
    await page.waitForTimeout(300);
    const m = await page.evaluate(measure);
    results.push({ theme, width, height, dpr, touch, ...m, errors });
    if (shots) await page.screenshot({ path: path.join(out, `${label}-${theme}-${width}x${height}.png`) });
    await context.close();
  }
  await writeFile(path.join(out, `${label}-results.json`), JSON.stringify(results, null, 2));
  for (const x of results) console.log(`${x.theme} ${x.width}x${x.height}@${x.dpr}`, 'p', x.bubbleP, 'h2', x.bubbleH2, 'user', x.userBubble, 'title', x.headerTitle, 'ta', x.textarea,
    '| shell', x.shell?.pad, '| col', x.chatPanel?.w, x.chatPanel?.pad, '| thread', x.thread?.w, x.thread?.pad, '| bubble', x.assistantBubble?.w, x.assistantBubble?.pad, '| comp', x.composer?.w, x.errors.length ? 'ERR ' + x.errors.join(';') : '');
} finally {
  await browser?.close().catch(() => {});
  if (server) { server.kill('SIGTERM'); await new Promise(r => setTimeout(r, 500)); }
  if (ownsData) await rm(data, { recursive: true, force: true });
  if (process.env.DESKTOP_TYPE_QA_LOG) console.error(log.slice(-3000));
}
