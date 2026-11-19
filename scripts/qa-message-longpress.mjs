// Browser regression with intercepted synthetic data; never writes conversations.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.LONGPRESS_QA_BASE || 'http://127.0.0.1:3158/chat';
const out = process.env.LONGPRESS_QA_OUTPUT || '/root/.cache/gaucho-longpress-20261115/evidence';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const results = [];
try {
  await mkdir(out, { recursive: true });
  const authContext = await browser.newContext();
  const login = await authContext.request.post(`${base}/api/auth/login`, { data: {
    username: process.env.LONGPRESS_QA_USERNAME || 'synthetic-user',
    password: process.env.LONGPRESS_QA_PASSWORD || 'synthetic-password',
  } });
  assert.equal(login.status(), 200);
  const storageState = await authContext.storageState();
  await authContext.close();
  for (const [width, height, touch] of [[390, 844, true], [956, 440, true], [1440, 1000, false]]) {
    for (const position of ['short', 'top', 'middle', 'bottom']) {
      const context = await browser.newContext({ storageState, viewport: { width, height }, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce' });
      await context.addInitScript(() => sessionStorage.setItem('gpt-splash-shown', 'true'));
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const now = new Date().toISOString();
      const conversation = { id: 'qa-longpress', title: 'Gesto sintético', lifecycle: 'active', createdAt: now, updatedAt: now,
        messages: [{ id: 'qa-user', role: 'user', timestamp: now,
          content: 'Mensagem sintética para conferir o gesto. '.repeat(position === 'short' ? 1 : 180) }] };
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== new URL(base).origin) return route.abort();
        if (!url.pathname.includes('/api/')) return route.continue();
        const p = url.pathname;
        const body = p.endsWith('/auth/check') ? { authenticated: true, authEnabled: true }
          : p.endsWith('/conversations') ? [conversation]
          : p.includes('/conversations/') ? conversation
          : p.endsWith('/memories') ? []
          : p.endsWith('/reconcile') ? { jobs: [], reconciled: 0 } : {};
        return route.fulfill({ json: body });
      });
      await page.goto(base, { waitUntil: 'networkidle' });
      const card = page.locator('.gc-user-bubble').first();
      await card.waitFor();
      await card.evaluate((node, position) => {
        let parent = node.parentElement;
        while (parent) {
          if (parent.scrollHeight > parent.clientHeight && /auto|scroll/.test(getComputedStyle(parent).overflowY)) {
            parent.scrollTop = position === 'middle' ? (parent.scrollHeight - parent.clientHeight) / 2
              : position === 'bottom' ? parent.scrollHeight : 0;
            break;
          }
          parent = parent.parentElement;
        }
      }, position);
      await page.waitForTimeout(350);
      const rect = await card.boundingBox();
      const point = { x: rect.x + rect.width / 2, y: Math.max(160, rect.y + 35) };
      if (touch) {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
        await page.waitForTimeout(300);
        assert.equal(await page.locator('[role=menu]').count(), 0, 'short hold must not open');
        await page.waitForTimeout(750);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await page.mouse.click(point.x, point.y, { button: 'right' });
      }
      const menu = page.getByRole('menu');
      await menu.waitFor();
      await page.waitForTimeout(250);
      const box = await menu.boundingBox();
      assert.ok(box && box.y >= 0 && box.y + box.height <= height && box.x >= 0 && box.x + box.width <= width,
        `menu must fit viewport: ${JSON.stringify({ width, height, position, box })}`);
      await page.screenshot({ path: `${out}/${width}-${position}.png` });
      await page.getByRole('menuitem', { name: /Editar e refazer/ }).click();
      await page.getByRole('textbox', { name: 'Editar mensagem', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
      assert.deepEqual(errors, []);
      results.push({ width, height, position, box, edit: true });
      await context.close();
    }
  }
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(`${results.length} cenários aprovados: menu visível após soltar, edição e cancelamento.`);
} finally { await browser.close(); }
