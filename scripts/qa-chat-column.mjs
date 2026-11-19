// Medidas da coluna do chat (thread, balões, composer e boas-vindas) por largura de janela;
// somente runtime e dados sintéticos isolados. Rodar antes e depois de uma mudança de layout
// e comparar os results.json: o que não deveria mudar tem de sair idêntico.
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
const out = process.env.CHAT_COLUMN_QA_OUTPUT || '/root/.cache/gaucho-chat-column/evidence';
const port = process.env.CHAT_COLUMN_QA_PORT || '3148';
const base = `http://127.0.0.1:${port}/chat`;
const env = { PATH: '/usr/bin:/bin', NODE_ENV: 'production', NEXT_PUBLIC_BASE_PATH: '/chat',
  AUTH_ENABLED: 'true', AUTH_USERNAME: 'synthetic-user', AUTH_PASSWORD: 'synthetic-password',
  JWT_SECRET: 'synthetic-chat-column-secret-not-production', GAUCHO_ISOLATED_RUNTIME: 'true', RATE_LIMIT_ENABLED: 'false' };
const now = '2026-11-09T12:00:00Z';
const longUser = 'Ajusta esse texto pra mim.';
const longAssistant = '## Título sintético comprido para conferir a quebra de linha equilibrada no balão\n\n' + Array.from({ length: 3 }, (_, i) => `Resposta sintética ${i + 1}. ${'Parágrafo comprido para o balão do assistente atingir a largura máxima. '.repeat(8)}`).join('\n\n');
const conversations = [{ id: 'qa-conversation', title: 'Conversa sintética', lifecycle: 'active', createdAt: now, updatedAt: now, messages: [
  { id: 'm-user-1', role: 'user', content: longUser, timestamp: now },
  { id: 'm-assistant-1', role: 'assistant', modelId: 'gpt-6-luna', content: longAssistant, timestamp: now },
] }];
// [largura, altura, toque]: celular, tablet em pé, e a faixa desktop em torno dos cortes 1024, 1490 e 1907.
const scenarios = [[390, 844, true], [956, 440, true], [820, 1180, true], [900, 1000, false], [1023, 1000, false], [1024, 1000, false], [1100, 1000, false],
  [1280, 900, false], [1489, 1000, false], [1490, 1000, false], [1906, 1000, false], [1907, 1000, false], [1920, 1000, false], [2066, 1000, false], [2067, 1000, false], [2560, 1200, false], [3440, 1440, false]];
let server, browser, page, ownsData = false, log = '';
const results = [];
async function until(fn, label) {
  for (let i = 0; i < 100; i++) { if (await Promise.resolve(fn()).catch(() => false)) return; await new Promise(r => setTimeout(r, 100)); }
  throw new Error(`Timeout: ${label}`);
}
const measureThread = () => {
  const px = value => Math.round(value * 100) / 100;
  const box = selector => {
    const node = document.querySelector(selector); if (!node) return null;
    return { width: px(node.getBoundingClientRect().width), maxWidth: getComputedStyle(node).maxWidth };
  };
  return { column: box('.gc-chat-column')?.width ?? null, thread: box('.gc-chat-thread'), user: box('.gc-user-bubble'),
    assistant: box('.gc-assistant-bubble'), composer: box('.gc-composer-width') };
};
const measureWelcome = () => {
  const grid = document.querySelector('.gc-welcome-grid'), panel = document.querySelector('.gc-welcome-desktop');
  if (!grid || !panel || grid.getBoundingClientRect().width === 0) return null;
  const gridStyle = getComputedStyle(grid), panelStyle = getComputedStyle(panel);
  return { column: Math.round(document.querySelector('.gc-chat-column').getBoundingClientRect().width * 100) / 100,
    tracks: gridStyle.gridTemplateColumns.split(' ').length, columnGap: gridStyle.columnGap, rowGap: gridStyle.rowGap,
    padding: panelStyle.padding, radius: panelStyle.borderRadius };
};
try {
  await mkdir(out, { recursive: true }); await mkdir(data); ownsData = true;
  await writeFile(path.join(data, 'conversations.json'), JSON.stringify(conversations));
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', port], { cwd: repo, env });
  server.stdout.on('data', b => log += b); server.stderr.on('data', b => log += b);
  await until(() => fetch(`${base}/login`).then(r => r.ok), 'boot');
  browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'], headless: true, env });
  for (const [width, height, touch] of scenarios) {
    // A conversa nova criada para medir as boas-vindas fica persistida; cada cenário recomeça dos dados originais.
    await writeFile(path.join(data, 'conversations.json'), JSON.stringify(conversations));
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, colorScheme: 'dark', reducedMotion: 'reduce' });
    await context.addInitScript(() => { sessionStorage.setItem('gpt-splash-shown', '1'); localStorage.setItem('theme', 'dark'); });
    assert.equal((await context.request.post(`${base}/api/auth/login`, { data: { username: env.AUTH_USERNAME, password: env.AUTH_PASSWORD } })).status(), 200);
    page = await context.newPage(); page.setDefaultTimeout(12000);
    const errors = [], external = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin) { external.push(url.origin); return route.abort(); }
      return route.continue();
    });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.locator('.gc-assistant-bubble').first().waitFor();
    const thread = await page.evaluate(measureThread);
    const mobileReading = width <= 767 || (touch && height <= 500);
    const fontSize = await page.locator('.gc-assistant-bubble p').first().evaluate(node => parseFloat(getComputedStyle(node).fontSize));
    assert.ok(mobileReading ? fontSize === 14 : fontSize >= 15 && fontSize <= 16, 'corpo desktop 15–16px; mobile 14px preservado');
    if (!mobileReading && width >= 1489) {
      assert.ok(Math.abs(thread.assistant.width - 896) < 1, 'resposta usa o novo teto de 896px');
      assert.ok(Math.abs(thread.user.width - 768) < 1, 'mensagem usa o novo teto de 768px');
    }
    await page.locator('[data-message-id="m-user-1"]').getByRole('button', { name: 'Acoes da mensagem' }).click();
    await page.getByRole('menuitem', { name: /Editar/ }).click();
    await page.getByRole('textbox', { name: 'Editar mensagem', exact: true }).waitFor();
    console.log('REVIEW_EDITOR', JSON.stringify(await page.evaluate(() => {
      const rect = s => { const n = document.querySelector(s); const r = n.getBoundingClientRect(); return { width: r.width, height: r.height, scrollWidth: n.scrollWidth, clientWidth: n.clientWidth }; };
      return { viewport: innerWidth, frame: rect('.gc-message-frame'), bubble: rect('.gc-user-bubble'), editor: rect('.gc-message-editor'), textarea: rect('.gc-message-editor textarea') };
    })));
    await page.screenshot({ path: `${out}/edit-${width}.png` });
    if (width <= 767 || (touch && height <= 500)) {
      assert.ok(await page.evaluate(() => Math.abs(document.querySelector('.gc-user-bubble').getBoundingClientRect().width - document.querySelector('.gc-message-frame').getBoundingClientRect().width) < 1), 'edição mobile ocupa a largura disponível');
    }
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    if (width >= 1907) {
      const panel = page.locator('[data-workspace-region="context"]');
      await page.getByRole('button', { name: 'Abrir painel', exact: true }).click();
      await until(async () => Math.abs((await panel.boundingBox()).width - 600) < 1, 'painel normal assentado');
      await page.getByRole('button', { name: 'Expandir canvas', exact: true }).click();
      await until(async () => Math.abs((await panel.boundingBox()).width - 760) < 1 && await panel.getAttribute('data-context-mode') === (width >= 2067 ? 'docked' : 'floating'), 'encaixe ampliado assentado');
      await until(async () => {
        const measured = await page.evaluate(measureThread);
        return Math.abs(measured.user.width - thread.user.width) < 1 && Math.abs(measured.assistant.width - thread.assistant.width) < 1;
      }, 'ampliação preserva largura dos balões');
      console.log('REVIEW_DOCK_EXPANDED', JSON.stringify(await page.evaluate(measureThread)));
      if (width === 2067) {
        await page.setViewportSize({ width: 2066, height });
        await until(async () => await panel.getAttribute('data-context-mode') === 'floating', 'ampliado flutua ao reduzir');
        await page.setViewportSize({ width: 2067, height });
        await until(async () => await panel.getAttribute('data-context-mode') === 'docked', 'ampliado encaixa ao aumentar');
      }
      await page.getByRole('button', { name: 'Recolher painel', exact: true }).click();
    }
    // Leitura: título do markdown equilibrado; parágrafo do balão sem pretty (o texto do chat chega aos poucos).
    const wrap = selector => page.locator(selector).first().evaluate(node => getComputedStyle(node).textWrapStyle);
    assert.equal(await wrap('.gc-assistant-bubble h2'), 'balance', 'título do balão equilibrado');
    assert.equal(await wrap('.gc-assistant-bubble p'), 'auto', 'parágrafo do balão sem pretty');
    await page.screenshot({ path: `${out}/thread-${width}.png` });
    let welcome = null;
    const mobile = width <= 767 || (touch && height <= 500);
    if (!mobile) {
      await page.keyboard.press('Control+Shift+n');
      await until(() => page.evaluate(measureWelcome).then(Boolean), 'boas-vindas visíveis');
      welcome = await page.evaluate(measureWelcome);
      assert.equal(await wrap('.gc-welcome-desktop h2'), 'balance', 'título das boas-vindas equilibrado');
      await page.screenshot({ path: `${out}/welcome-${width}.png` });
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'sem rolagem horizontal');
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    results.push({ width, height, touch, fontSize, thread, welcome });
    await context.close();
  }
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2)); console.log(JSON.stringify(results));
} catch (error) { await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {}); throw error; }
finally {
  await browser?.close();
  if (server && server.exitCode === null && server.signalCode === null) { const exited = once(server, 'exit'); server.kill('SIGTERM'); const timer = setTimeout(() => server.kill('SIGKILL'), 4000); await exited; clearTimeout(timer); }
  await writeFile(`${out}/server.log`, log); if (ownsData) await rm(data, { recursive: true, force: true });
}
