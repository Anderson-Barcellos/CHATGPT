// QA de navegador com APIs/WebSocket simulados e dados exclusivamente sintéticos.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.GROK_QA_BASE_URL || "http://127.0.0.1:3147/chat";
const output = process.env.GROK_QA_OUTPUT_DIR || "/root/.cache/grok-chat-soundcase-qa";
await mkdir(output, { recursive: true });
const projectId = "11111111-1111-4111-8111-111111111111";
const versionId = "22222222-2222-4222-8222-222222222222";
const text = "Uma narração sintética para conferir os controles de voz do SoundCase.";
const date = "2026-09-21T12:00:00.000Z";
const requestedSettings = { automatic: true, playbackMode: "realtime", format: "mp3", voiceOverride: null, speedOverride: null, instructionsOverride: null };
const choice = (value) => ({ value, source: "automatic" });
const effectiveSettings = { format: choice("mp3"), voice: choice("cedar"), speed: choice(1), instructions: choice("Leia fielmente.") };
const direction = { model: "gpt-5.6-luna", promptVersion: "qa", source: "automatic", title: "Narração de teste", summary: "Texto sintético.", language: "pt-BR", voice: "cedar", speed: 1, globalInstructions: "Leia fielmente.", pronunciations: [], segmentDirections: [], coverPrompt: "" };
const summary = { id: versionId, projectId, idempotencyKey: "qa", status: "ready", title: "Narração de teste", summary: "Texto sintético para QA.", wordCount: 13, estimatedDurationSeconds: 6, requestedFormat: "mp3", audio: { status: "pending", format: "mp3" }, cover: { status: "pending" }, progress: { phase: "ready", ratio: 1, completedChunks: 1, totalChunks: 1, updatedAt: date }, createdAt: date, completedAt: date };
const version = { ...summary, sourceHash: "qa", settingsHash: "qa", requestedSettings, effectiveSettings, direction };
const project = { id: projectId, title: "Narração de teste", draftRevision: 1, activeVersionId: versionId, createdAt: date, updatedAt: date, draftText: text, draftWordCount: 13, estimatedDurationSeconds: 6, versions: [summary] };
const results = [];
let currentPage;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    currentPage = page;
    const errors = [];
    const requests = [];
    const sentEvents = [];
    let failSession = false;
    let sockets = 0;
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/**", async (route) => {
      const pathname = new URL(route.request().url()).pathname.replace(/^\/chat/u, "");
      requests.push({ pathname, method: route.request().method() });
      let body = {};
      let status = 200;
      if (pathname === "/api/soundcase/projects") body = { projects: [project] };
      else if (pathname === `/api/soundcase/projects/${projectId}`) body = { project };
      else if (pathname.endsWith("/source")) body = { text };
      else if (pathname.endsWith(`/versions/${versionId}`)) body = { version };
      else if (pathname.endsWith("/versions")) body = { versions: [summary] };
      else if (pathname.endsWith("/grok-realtime/voices")) body = { voices: [{ id: "eve", name: "Eve" }, { id: "ara", name: "Ara" }] };
      else if (pathname.endsWith("/grok-realtime/session")) {
        body = failSession ? { message: "Serviço Grok temporariamente indisponível." } : { token: "qa-ephemeral-token" };
        if (failSession) status = 503;
      } else if (route.request().method() !== "GET") {
        errors.push(`unexpected_write:${pathname}`); status = 409;
      }
      await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.routeWebSocket(/api\.x\.ai\/v1\/realtime/u, (ws) => {
      sockets += 1;
      ws.onMessage((data) => {
        const event = JSON.parse(String(data)); sentEvents.push(event);
        if (event.type === "session.update") ws.send(JSON.stringify({ type: "session.updated" }));
        if (event.type === "response.create") {
          ws.send(JSON.stringify({ type: "response.created", response: { id: "qa-response" } }));
          ws.send(Buffer.alloc(48000));
          // Manter turno aberto para que o usuário possa exercitar Parar.
        }
      });
    });
    await page.goto(`${base}/soundcase`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Configurações do Soundcase", exact: true }).click();
    await page.getByRole("combobox", { name: /Leitura ao vivo/u }).selectOption("grok");
    await page.getByRole("combobox", { name: /Voz Grok/u }).selectOption("ara");
    await page.getByRole("slider", { name: "Velocidade da voz Grok" }).fill("1.2");
    assert.equal(sockets, 0, "abrir/configurar não inicia áudio");
    assert.equal(requests.filter((r) => r.pathname.endsWith("/session")).length, 0);
    await page.screenshot({ path: `${output}/soundcase-grok-${viewport.width}.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false, "sem overflow horizontal");
    for (const name of [/Leitura ao vivo/u, /Voz Grok/u]) {
      const bounds = await page.getByRole("combobox", { name }).boundingBox();
      assert.ok(bounds && bounds.height >= 44, "controle de voz tem alvo tátil de 44px");
    }
    await page.getByRole("button", { name: "Ouvir Narração de teste", exact: true }).click();
    await page.getByRole("button", { name: "Ouvir com Realtime", exact: true }).click();
    await page.getByRole("button", { name: "Parar leitura Realtime", exact: true }).waitFor();
    await page.waitForFunction(() => document.body.textContent.includes("Leitura em andamento"));
    assert.equal(sockets, 1);
    const session = sentEvents.find((event) => event.type === "session.update")?.session;
    assert.equal(session?.voice, "ara");
    assert.equal(session?.turn_detection, null);
    assert.equal(session?.audio?.output?.speed, 1.2);
    assert.equal(sentEvents.find((event) => event.type === "conversation.item.create")?.item?.content?.[0]?.text, text);
    await page.getByRole("button", { name: "Parar leitura Realtime", exact: true }).click();
    await page.getByRole("button", { name: "Ouvir com Realtime", exact: true }).waitFor();
    failSession = true;
    await page.getByRole("button", { name: "Ouvir com Realtime", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "indisponível" }).waitFor();
    assert.equal(sockets, 1, "falha no token não abre conexão");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Configurações do Soundcase", exact: true }).click();
    assert.equal(await page.getByRole("combobox", { name: /Leitura ao vivo/u }).inputValue(), "grok");
    assert.equal(await page.getByRole("combobox", { name: /Voz Grok/u }).inputValue(), "ara");
    await page.getByRole("combobox", { name: /Leitura ao vivo/u }).selectOption("openai");
    assert.equal(await page.getByRole("combobox", { name: /Voz Grok/u }).count(), 0);
    assert.deepEqual(errors, []);
    results.push({ viewport, passed: true, checks: ["config_without_generation", "voices", "speed", "snapshot", "audio_start_stop", "token_error", "persistence", "openai_preserved", "no_overflow", "no_pageerror"] });
    await context.close();
  }
  await writeFile(`${output}/browser-results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} catch (error) {
  if (currentPage && !currentPage.isClosed()) await currentPage.screenshot({ path: `${output}/browser-failure.png`, fullPage: true });
  throw error;
} finally { await browser.close(); }
