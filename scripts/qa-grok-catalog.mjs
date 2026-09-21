// Seletor real do chat com armazenamento/API exclusivamente sintéticos.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.GROK_QA_BASE_URL || "http://127.0.0.1:3147/chat";
const conversation = { id: "33333333-3333-4333-8333-333333333333", title: "Conversa sintética", messages: [], createdAt: "2026-09-21T12:00:00.000Z", updatedAt: "2026-09-21T12:00:00.000Z" };
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
const results = [];
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript(() => sessionStorage.setItem("gpt-splash-shown", "true"));
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/**", async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      const body = pathname.endsWith("/conversations") ? [conversation]
        : pathname.endsWith(`/conversations/${conversation.id}`) ? conversation
        : pathname.endsWith("/memories") ? []
        : pathname.endsWith("/persona") ? { contextAboutUser: "", customSystemInstructions: "", responsePreferences: "" }
        : pathname.endsWith("/reconcile") ? { jobs: [], reconciled: 0 } : {};
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.goto(base, { waitUntil: "networkidle" });
    const selector = page.getByRole("button", { name: "Selecionar modelo", exact: true });
    assert.match(await selector.innerText(), /Luna/u);
    await selector.click();
    assert.equal(await page.getByRole("menuitem", { name: /5\.4.*mini/iu }).count(), 0);
    await page.getByRole("menuitem", { name: /Grok 4\.7/u }).click();
    assert.match(await selector.innerText(), /Grok 4\.7/u);
    await page.getByRole("button", { name: "Ajustar nível de raciocínio", exact: true }).click();
    const choices = page.getByRole("menuitem");
    assert.equal(await choices.count(), 1);
    assert.equal(await choices.first().getAttribute("aria-disabled"), "true");
    assert.match(await choices.first().innerText(), /M[eé]dio/iu);
    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "networkidle" });
    assert.match(await selector.innerText(), /Grok 4\.7/u);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    results.push({ viewport, passed: true, checks: ["luna_default", "mini_hidden", "grok_selectable", "medium_fixed", "selection_persisted", "no_overflow", "no_pageerror"] });
    await context.close();
  }
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
