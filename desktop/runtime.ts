import { createServer } from "node:net";
import path from "node:path";
import {
  DESKTOP_DATA_DIR_ENV,
  DESKTOP_EDITION_ENV,
  DESKTOP_SESSION_COOKIE,
} from "../lib/runtime/edition";

export interface DesktopBackendConfig {
  dataDir: string;
  port: number;
  sessionToken: string;
}

export interface DesktopRuntimePaths {
  appPath: string;
  resourcesPath: string;
  isPackaged: boolean;
}

const CHILD_OPERATIONAL_ENVIRONMENT_KEYS = [
  "APPDATA",
  "COMSPEC",
  "DISPLAY",
  "HOME",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "LOCALAPPDATA",
  "PATH",
  "PATHEXT",
  "SystemRoot",
  "SYSTEMROOT",
  "TEMP",
  "TMP",
  "USERPROFILE",
  "WAYLAND_DISPLAY",
  "WINDIR",
  "XAUTHORITY",
  "XDG_CACHE_HOME",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "XDG_RUNTIME_DIR",
] as const;

interface DesktopHealthPayload {
  checks?: {
    openai?: {
      message?: unknown;
      status?: unknown;
    };
  };
  status?: unknown;
}

interface DesktopHealthResponse {
  json(): Promise<DesktopHealthPayload>;
  status: number;
}

export async function findFreeLoopbackPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Não foi possível reservar uma porta loopback."));
        return;
      }

      server.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });
}

export function getDesktopServerDirectory(paths: DesktopRuntimePaths): string {
  return paths.isPackaged
    ? path.join(paths.resourcesPath, ".next")
    : path.join(paths.appPath, "desktop", ".next");
}

export function buildDesktopBackendEnvironment(
  config: DesktopBackendConfig
): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    HOSTNAME: "127.0.0.1",
    PORT: String(config.port),
    NEXT_PUBLIC_BASE_PATH: "",
    [DESKTOP_EDITION_ENV]: "desktop",
    [DESKTOP_DATA_DIR_ENV]: config.dataDir,
    GAUCHO_DESKTOP_SESSION_TOKEN: config.sessionToken,
    AUTH_ENABLED: "false",
    ELECTRON_RUN_AS_NODE: "1",
  };
}

export function buildDesktopChildEnvironment(
  hostEnvironment: Partial<NodeJS.ProcessEnv>,
  config: DesktopBackendConfig
): NodeJS.ProcessEnv {
  const operationalEnvironment: Record<string, string> = {};

  for (const key of CHILD_OPERATIONAL_ENVIRONMENT_KEYS) {
    const value = hostEnvironment[key];
    if (value !== undefined) operationalEnvironment[key] = value;
  }

  return {
    ...operationalEnvironment,
    ...buildDesktopBackendEnvironment(config),
  } as NodeJS.ProcessEnv;
}

export async function isDesktopHealthReady(
  response: DesktopHealthResponse
): Promise<boolean> {
  if (response.status === 200) return true;
  if (response.status !== 503) return false;

  const health = await response.json().catch(() => undefined);
  return (
    health?.status === "unhealthy" &&
    health.checks?.openai?.status === "error" &&
    health.checks.openai.message === "OpenAI API key not configured"
  );
}

export function getLoopbackUrl(port: number): string {
  return `http://127.0.0.1:${port}`;
}

export function getDesktopSessionCookie(url: string, token: string) {
  return {
    url,
    name: DESKTOP_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: false,
    sameSite: "lax" as const,
    path: "/",
  };
}

export function isLoopbackNavigation(url: string, port: number): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "http:" &&
      parsed.hostname === "127.0.0.1" &&
      parsed.port === String(port)
    );
  } catch {
    return false;
  }
}

export function isSafeExternalNavigation(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      parsed.hostname !== "127.0.0.1" &&
      parsed.hostname !== "localhost" &&
      parsed.hostname !== "::1"
    );
  } catch {
    return false;
  }
}
