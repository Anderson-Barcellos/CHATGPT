import { chromium } from "playwright";

const baseUrl =
  process.env.STUDIO_SMOKE_BASE_URL ?? "http://127.0.0.1:3040/chat";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ?? "/usr/bin/google-chrome-stable",
  headless: true,
});

async function waitFor(predicate, message, timeoutMs = 4_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(message);
}

async function replaceEditorValue(page, value) {
  const editor = page.locator(".monaco-editor");
  await editor.click({ timeout: 5_000 });
  await page.keyboard.press("Control+A");
  await page.keyboard.type(value);
}

async function readEditorValue(page) {
  const editor = page.locator(".monaco-editor");
  await editor.click({ timeout: 5_000 });
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Control+C");
  return page.evaluate(() => navigator.clipboard.readText());
}

async function waitForGhostText(page, expected) {
  await page
    .locator(
      ".monaco-editor .ghost-text, .monaco-editor .ghost-text-decoration"
    )
    .filter({ hasText: expected })
    .first()
    .waitFor({ state: "visible", timeout: 4_000 });
}

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const page = await context.newPage();
  const browserErrors = [];
  page.on("pageerror", (error) => {
    if (error.name !== "Canceled") {
      browserErrors.push(`[pageerror] ${error.name}: ${error.message}`);
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(`[console] ${message.text()}`);
    }
  });
  const requests = [];

  await page.route("**/chat/api/studio/autocomplete", async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    const prefix = typeof body.prefix === "string" ? body.prefix : "";
    const completion = prefix.endsWith("const answer = ")
      ? "42"
      : prefix.endsWith("const escape = ")
        ? "99"
        : prefix.endsWith("const typed = ")
          ? "77"
          : prefix.endsWith("const moved = ")
            ? "66"
            : prefix.endsWith("const switched = ")
              ? "55"
              : "";

    if (prefix.endsWith("const switched = ")) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ completion, finishReason: "stop" }),
    });
  });

  await page.goto(`${baseUrl}/studio`, { waitUntil: "networkidle" });
  if (page.url().includes("/login")) {
    const username = process.env.STUDIO_SMOKE_USERNAME;
    const password = process.env.STUDIO_SMOKE_PASSWORD;
    if (!username || !password) {
      throw new Error("Smoke credentials are required");
    }
    const response = await page.request.post(`${baseUrl}/api/auth/login`, {
      data: { username, password },
    });
    if (!response.ok()) {
      throw new Error(`Smoke login failed with HTTP ${response.status()}`);
    }
    await page.goto(`${baseUrl}/studio`, { waitUntil: "networkidle" });
  }

  const control = page.getByRole("button", { name: "Autocomplete ligado" });
  await control.waitFor({ state: "visible", timeout: 4_000 });

  await replaceEditorValue(page, "const answer = ");
  await waitFor(
    () => requests.some((body) => body.prefix?.endsWith("const answer = ")),
    "The editor did not request the first completion"
  );
  await waitForGhostText(page, "42");
  await page.keyboard.press("Tab");
  await waitFor(
    () => requests.some((body) => body.prefix?.endsWith("const answer = 42")),
    "Accepted completion did not schedule a chained request"
  );
  const accepted = await readEditorValue(page);
  if (accepted !== "const answer = 42") {
    throw new Error(`Unexpected accepted editor value: ${accepted}`);
  }

  await page.keyboard.press("Control+Z");
  const afterUndo = await readEditorValue(page);
  if (afterUndo !== "const answer = ") {
    throw new Error(`Undo did not remove one completion: ${afterUndo}`);
  }

  await replaceEditorValue(page, "const escape = ");
  await waitFor(
    () => requests.some((body) => body.prefix?.endsWith("const escape = ")),
    "Escape scenario did not request a completion"
  );
  await waitForGhostText(page, "99");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Tab");
  if ((await readEditorValue(page)).includes("99")) {
    throw new Error("Escape did not discard ghost text");
  }

  await replaceEditorValue(page, "const typed = ");
  await waitFor(
    () => requests.some((body) => body.prefix?.endsWith("const typed = ")),
    "Typing scenario did not request a completion"
  );
  await waitForGhostText(page, "77");
  await page.keyboard.type("0");
  await page.keyboard.press("Tab");
  if ((await readEditorValue(page)).includes("77")) {
    throw new Error("Typing did not discard stale ghost text");
  }

  await replaceEditorValue(page, "const moved = ");
  await waitFor(
    () => requests.some((body) => body.prefix?.endsWith("const moved = ")),
    "Cursor scenario did not request a completion"
  );
  await waitForGhostText(page, "66");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Tab");
  if ((await readEditorValue(page)).includes("66")) {
    throw new Error("Cursor movement did not discard ghost text");
  }

  await replaceEditorValue(page, "const switched = ");
  await waitFor(
    () => requests.some((body) => body.prefix?.endsWith("const switched = ")),
    "File switch scenario did not request a completion"
  );
  await page
    .getByRole("button", { name: /index\.ts/ })
    .filter({ hasNotText: "Fechar" })
    .first()
    .click();
  await page.waitForTimeout(550);
  await page.locator(".monaco-editor").click();
  await page.keyboard.press("Tab");
  if ((await readEditorValue(page)).includes("55")) {
    throw new Error("File switch kept a stale completion");
  }

  const requestsBeforeOff = requests.length;
  await page.getByRole("button", { name: /Autocomplete/ }).click();
  await replaceEditorValue(page, "const disabled = ");
  await page.waitForTimeout(700);
  if (requests.length !== requestsBeforeOff) {
    throw new Error("Disabled autocomplete still requested the API");
  }
  const requestsBeforeDisabledReload = requests.length;
  await page.reload({ waitUntil: "networkidle" });
  await page
    .getByRole("button", { name: "Autocomplete desligado" })
    .waitFor({ state: "visible", timeout: 4_000 });
  await page.waitForTimeout(700);
  if (requests.length !== requestsBeforeDisabledReload) {
    throw new Error("Persisted disabled autocomplete requested during reload");
  }
  await page
    .getByRole("button", { name: "Autocomplete desligado" })
    .click();

  await page.screenshot({
    path: "/tmp/gaucho-studio-autocomplete-smoke.png",
    fullPage: true,
  });

  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  let mobileRequests = 0;
  await mobile.route("**/chat/api/studio/autocomplete", async (route) => {
    mobileRequests += 1;
    await route.abort();
  });
  await mobile.goto(`${baseUrl}/studio`, { waitUntil: "domcontentloaded" });
  await mobile.locator(".monaco-editor textarea").focus({ timeout: 5_000 });
  await mobile.keyboard.press("Control+A");
  await mobile.keyboard.type("const mobile = ");
  await mobile.waitForTimeout(700);
  if (mobileRequests !== 0) {
    throw new Error("Mobile must not request autocomplete");
  }
  if (await mobile.getByRole("button", { name: /Autocomplete/ }).isVisible()) {
    throw new Error("Mobile must hide the autocomplete control");
  }

  if (browserErrors.length > 0) {
    throw new Error(`Unexpected browser errors: ${browserErrors.join(" | ")}`);
  }

  await context.close();
  console.log("Studio autocomplete deterministic smoke: OK");
} finally {
  await browser.close();
}
