// Executar após build /chat em worktree isolada. Somente credenciais/dados sintéticos.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const repo = await realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
assert.notEqual(repo, "/root/CHATGPT", "QA não pode rodar no checkout de produção");
const output = process.env.REVIEW_QA_OUTPUT || "/root/.cache/gaucho-review-20260922";
await mkdir(output, { recursive: true });
const temporary = await mkdtemp(path.join(os.tmpdir(), "gaucho-browser-qa-"));
const data = path.join(repo, "data");
try { await readdir(data); throw new Error("QA exige data inexistente; não sobrescreve dados existentes"); }
catch (error) { if (error.code !== "ENOENT") throw error; }
const port = Number(process.env.REVIEW_QA_PORT || 3148);
const children = [];
const checks = [];
const conversation = { id: "33333333-3333-4333-8333-333333333333", title: "Conversa sintética", messages: [], createdAt: "2026-09-22T12:00:00.000Z", updatedAt: "2026-09-22T12:00:00.000Z" };
let browser;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const env = { PATH: "/usr/bin:/bin", NODE_ENV: "production", NEXT_PUBLIC_BASE_PATH: "/chat",
  AUTH_ENABLED: "true", AUTH_USERNAME: "review-user", AUTH_PASSWORD: "review-password", JWT_SECRET: "synthetic-review-jwt-secret-only",
  OPENAI_API_KEY: "sk-synthetic-review-no-network", GAUCHO_ISOLATED_RUNTIME: "true", RATE_LIMIT_ENABLED: "false",
  XDG_CONFIG_HOME: path.join(temporary, "config"), XDG_CACHE_HOME: path.join(temporary, "cache") };
async function assertPortFree(value) {
  const server = createServer(); server.listen(value, "127.0.0.1"); await once(server, "listening");
  await new Promise(resolve => server.close(resolve));
}
function start(value, overrides = {}) {
  const child = spawn(process.execPath, [path.join(repo, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(value)],
    { cwd: repo, env: { ...env, ...overrides }, stdio: ["ignore", "pipe", "pipe"] });
  const entry = { child, output: "" }; children.push(entry);
  child.stdout.on("data", data => { entry.output += data; }); child.stderr.on("data", data => { entry.output += data; });
  return entry;
}
async function waitUntil(check, label) {
  for (let i = 0; i < 200; i++) { if (await check()) return; await delay(100); }
  throw new Error(`Timeout: ${label}`);
}
async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exit = once(child, "exit"); child.kill("SIGTERM");
  const timer = setTimeout(() => child.kill("SIGKILL"), 3_000);
  try { await exit; } finally { clearTimeout(timer); }
}
const base = `http://127.0.0.1:${port}/chat`;
try {
  await assertPortFree(port); await assertPortFree(port + 1);
  const invalid = start(port, { AUTH_ENABLED: "false" });
  await waitUntil(() => invalid.child.exitCode !== null, "auth inválida impedir boot");
  assert.notEqual(invalid.child.exitCode, 0); assert.match(invalid.output, /Invalid authentication configuration/);
  checks.push("produção com auth desligada recusa boot");

  const main = start(port);
  await waitUntil(async () => {
    if (main.child.exitCode !== null) throw new Error(main.output);
    try { return (await fetch(`${base}/api/health/live`)).status === 200; } catch { return false; }
  }, "liveness");
  assert.equal((await fetch(`${base}/api/health`)).status, 503);
  for (const file of ["conversations.json", "memories.json", "persona.json"]) {
    await assert.rejects(readFile(path.join(data, file)), { code: "ENOENT" });
  }
  checks.push("liveness 200 e readiness 503 sem criar dados ausentes");
  assert.equal((await fetch(`${base}/api/conversations`)).status, 401); checks.push("rota privada recusa anônimo");

  await mkdir(data, { recursive: true });
  await writeFile(path.join(data, "conversations.json"), "[]");
  await writeFile(path.join(data, "memories.json"), "[]");
  await writeFile(path.join(data, "persona.json"), '{"contextAboutUser":"","responsePreferences":""}');
  assert.equal((await fetch(`${base}/api/health`)).status, 200); checks.push("readiness aceita armazenamento sintético válido");
  await writeFile(path.join(data, "conversations.json"), "{synthetic-broken");
  assert.equal((await fetch(`${base}/api/health`)).status, 503);
  assert.equal(await readFile(path.join(data, "conversations.json"), "utf8"), "{synthetic-broken");
  assert.equal((await readdir(data)).some(name => name.includes(".corrupt-")), false);
  await writeFile(path.join(data, "conversations.json"), "[]"); checks.push("readiness recusa corrupção sem rename/recovery");

  const duplicate = start(port + 1);
  await waitUntil(() => duplicate.child.exitCode !== null, "segunda instância recusar dados compartilhados");
  assert.notEqual(duplicate.child.exitCode, 0); assert.match(duplicate.output, /runtime_resource_in_use/);
  assert.equal((await fetch(`${base}/api/health/live`)).status, 200); checks.push("segunda instância recusada; primeira preservada");

  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", headless: true,
    env: { ...env }, args: ["--no-sandbox"] });
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript(() => sessionStorage.setItem("gpt-splash-shown", "true"));
    const page = await context.newPage(); const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/**", async route => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.includes("/api/auth/")) return route.continue();
      // O pós-login exercita o shell, sem gerar/consultar providers nem persistir UI.
      const body = pathname.endsWith("/conversations") ? [conversation]
        : pathname.endsWith(`/conversations/${conversation.id}`) ? conversation
        : pathname.endsWith("/memories") ? []
        : pathname.endsWith("/persona") ? { contextAboutUser: "", responsePreferences: "" }
        : pathname.endsWith("/reconcile") ? { jobs: [], reconciled: 0 } : {};
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.goto(`${base}/login`, { waitUntil: "networkidle" });
    await page.locator("#username").fill(env.AUTH_USERNAME); await page.locator("#password").fill("wrong-synthetic-password");
    await page.locator('button[type="submit"]').click(); await page.getByText("Credenciais incorretas", { exact: true }).waitFor();
    await page.locator("#password").fill(env.AUTH_PASSWORD);
    await Promise.all([page.waitForURL(url => url.pathname === "/chat" || url.pathname === "/chat/"), page.locator('button[type="submit"]').click()]);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Selecionar modelo", exact: true }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Enviar mensagem", exact: true }).waitFor({ state: "visible" });
    assert.ok((await context.cookies()).some(cookie => cookie.name === "auth-token" && cookie.httpOnly));
    const status = await context.request.get(`${base}/api/auth/check`); assert.equal((await status.json()).authenticated, true);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(output, `auth-${viewport.width}.png`) });
    checks.push(`login incorreto/correto, cookie e shell ${viewport.width}px`);
    await context.close();
  }
  await browser.close(); browser = undefined;
  await stop(main.child);
  const restarted = start(port);
  await waitUntil(async () => { try { return (await fetch(`${base}/api/health/live`)).status === 200; } catch { return false; } }, "reaquisição após encerramento");
  assert.equal(restarted.child.exitCode, null); checks.push("novo processo readquire recursos após encerramento");
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
} finally {
  await browser?.close();
  for (const { child } of children) await stop(child);
  for (const [index, entry] of children.entries()) await writeFile(path.join(output, `qa-server-${index}.log`), entry.output);
  await rm(data, { recursive: true, force: true }); // Criado exclusivamente por esta rodada.
  await rm(temporary, { recursive: true, force: true });
}
