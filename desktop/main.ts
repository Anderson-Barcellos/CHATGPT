import { fork, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  nativeImage,
  session,
  shell,
  Tray,
} from "electron";
import { DesktopLifecycle } from "./lifecycle";
import {
  buildDesktopChildEnvironment,
  findFreeLoopbackPort,
  getDesktopServerDirectory,
  getDesktopSessionCookie,
  getLoopbackUrl,
  isDesktopHealthReady,
  isLoopbackNavigation,
  isSafeExternalNavigation,
} from "./runtime";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let backend: ChildProcess | null = null;
let backendPort: number | null = null;
const lifecycle = new DesktopLifecycle();

function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

function stopBackend(): void {
  if (!backend || backend.killed) return;
  backend.kill();
  backend = null;
}

function quitDesktopApplication(): void {
  lifecycle.quit(stopBackend);
  app.quit();
}

function handleDesktopFailure(): void {
  lifecycle.fail(stopBackend, () => {
    mainWindow?.destroy();
    dialog.showErrorBox(
      "Gaucho Chat",
      "Não foi possível iniciar o Gaucho Chat. Tente abrir o aplicativo novamente."
    );
    app.quit();
  });
}

async function waitForBackend(url: string, token: string): Promise<void> {
  const deadline = Date.now() + 20_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/api/health`, {
        headers: { Cookie: `gaucho-desktop-session=${token}` },
      });
      if (await isDesktopHealthReady(response)) return;
    } catch {
      // O Next standalone ainda está subindo.
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw new Error("O backend local do Gaucho Chat não respondeu a tempo.");
}

async function startBackend(): Promise<{ url: string; token: string }> {
  const port = await findFreeLoopbackPort();
  const token = createSessionToken();
  const serverDirectory = getDesktopServerDirectory({
    appPath: app.getAppPath(),
    resourcesPath: process.resourcesPath,
    isPackaged: app.isPackaged,
  });
  const serverPath = path.join(serverDirectory, "server.js");

  backend = fork(serverPath, [], {
    cwd: serverDirectory,
    execPath: process.execPath,
    env: buildDesktopChildEnvironment(process.env, {
      dataDir: app.getPath("userData"),
      port,
      sessionToken: token,
    }),
    stdio: "ignore",
  });
  backendPort = port;
  backend.once("exit", () => {
    backend = null;
    if (!lifecycle.isQuitting) handleDesktopFailure();
  });

  const url = getLoopbackUrl(port);
  await waitForBackend(url, token);
  return { url, token };
}

function revealMainWindow(): void {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray(): void {
  const icon = nativeImage.createFromDataURL(
    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDE2IDE2Ij48Y2lyY2xlIGN4PSI4IiBjeT0iOCIgcj0iNyIgZmlsbD0iIzc4YWZmZiIvPjxwYXRoIGQ9Ik01IDhoNiIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48L3N2Zz4="
  );
  tray = new Tray(icon);
  tray.setToolTip("Gaucho Chat");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Abrir Gaucho Chat", click: revealMainWindow },
      {
        label: "Sair",
        click: quitDesktopApplication,
      },
    ])
  );
  tray.on("click", revealMainWindow);
}

async function createWindow(url: string, token: string): Promise<void> {
  await session.defaultSession.cookies.set(getDesktopSessionCookie(url, token));

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.on("close", (event) => {
    const shouldClose = lifecycle.requestWindowClose(() => mainWindow?.hide());
    if (!shouldClose) event.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (isSafeExternalNavigation(targetUrl)) void shell.openExternal(targetUrl);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    if (backendPort !== null && isLoopbackNavigation(targetUrl, backendPort)) return;
    event.preventDefault();
    if (isSafeExternalNavigation(targetUrl)) void shell.openExternal(targetUrl);
  });

  await mainWindow.loadURL(url);
  mainWindow.show();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", revealMainWindow);
  app.on("before-quit", () => lifecycle.quit(stopBackend));
  process.once("SIGINT", quitDesktopApplication);
  process.once("SIGTERM", quitDesktopApplication);

  void app
    .whenReady()
    .then(async () => {
      app.setLoginItemSettings({ openAtLogin: false });
      createTray();
      const { url, token } = await startBackend();
      await createWindow(url, token);
    })
    .catch(handleDesktopFailure);
}
