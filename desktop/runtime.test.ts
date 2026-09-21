import path from "node:path";
import { describe, expect, it } from "vitest";
import { DESKTOP_SESSION_COOKIE } from "@/lib/runtime/edition";
import {
  buildDesktopBackendEnvironment,
  buildDesktopChildEnvironment,
  getDesktopServerDirectory,
  getDesktopSessionCookie,
  isDesktopHealthReady,
  isLoopbackNavigation,
  isSafeExternalNavigation,
} from "./runtime";

describe("runtime desktop", () => {
  it("monta backend isolado em loopback, sem basePath web", () => {
    expect(
      buildDesktopBackendEnvironment({
        dataDir: "C:\\Users\\Anders\\AppData\\Roaming\\Gaucho Chat",
        port: 42319,
        sessionToken: "token-local",
      })
    ).toMatchObject({
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: "42319",
      NEXT_PUBLIC_BASE_PATH: "",
      GAUCHO_EDITION: "desktop",
      GAUCHO_DATA_DIR: "C:\\Users\\Anders\\AppData\\Roaming\\Gaucho Chat",
      GAUCHO_DESKTOP_SESSION_TOKEN: "token-local",
      AUTH_ENABLED: "false",
      ELECTRON_RUN_AS_NODE: "1",
    });
  });

  it("repassa somente o mínimo operacional e nunca segredos do host", () => {
    const environment = buildDesktopChildEnvironment(
      {
        PATH: "/usr/bin",
        SystemRoot: "C:\\Windows",
        OPENAI_API_KEY: "provider-key",
        DEEPSEEK_API_KEY: "deepseek-key",
        GEMINI_API_KEY: "gemini-key",
        GOOGLE_CLIENT_SECRET: "google-secret",
        JWT_SECRET: "jwt-secret",
        AUTH_PASSWORD: "auth-password",
        PULSE_RUNNER_TOKEN: "pulse-token",
        SOUNDCASE_TOKEN: "soundcase-token",
        STUDIO_WORKSPACE_PASSWORD: "studio-password",
        UNRELATED_TOKEN: "unrelated-token",
      },
      { dataDir: "/isolado", port: 40123, sessionToken: "sessão-local" }
    );

    expect(environment).toMatchObject({
      PATH: "/usr/bin",
      SystemRoot: "C:\\Windows",
      AUTH_ENABLED: "false",
      GAUCHO_EDITION: "desktop",
      GAUCHO_DATA_DIR: "/isolado",
    });
    for (const secret of [
      "OPENAI_API_KEY",
      "DEEPSEEK_API_KEY",
      "GEMINI_API_KEY",
      "GOOGLE_CLIENT_SECRET",
      "JWT_SECRET",
      "AUTH_PASSWORD",
      "PULSE_RUNNER_TOKEN",
      "SOUNDCASE_TOKEN",
      "STUDIO_WORKSPACE_PASSWORD",
      "UNRELATED_TOKEN",
    ]) {
      expect(environment).not.toHaveProperty(secret);
    }
  });

  it("reconhece somente health saudável ou a ausência conhecida de provider", async () => {
    await expect(
      isDesktopHealthReady({ status: 200, json: async () => ({}) })
    ).resolves.toBe(true);
    await expect(
      isDesktopHealthReady({
        status: 503,
        json: async () => ({
          status: "unhealthy",
          checks: {
            openai: {
              status: "error",
              message: "OpenAI API key not configured",
            },
          },
        }),
      })
    ).resolves.toBe(true);
    await expect(
      isDesktopHealthReady({ status: 500, json: async () => ({}) })
    ).resolves.toBe(false);
    await expect(
      isDesktopHealthReady({
        status: 503,
        json: async () => ({ status: "unhealthy" }),
      })
    ).resolves.toBe(false);
  });

  it("mantém o standalone fora do asar em desenvolvimento e pacote", () => {
    expect(
      getDesktopServerDirectory({
        appPath: "/repo",
        resourcesPath: "/package/resources",
        isPackaged: false,
      })
    ).toBe(path.join("/repo", "desktop", ".next"));
    expect(
      getDesktopServerDirectory({
        appPath: "/repo",
        resourcesPath: "/package/resources",
        isPackaged: true,
      })
    ).toBe(path.join("/package/resources", ".next"));
  });

  it("instala token apenas como cookie HttpOnly na origem loopback", () => {
    expect(getDesktopSessionCookie("http://127.0.0.1:42001", "segredo")).toEqual({
      url: "http://127.0.0.1:42001",
      name: DESKTOP_SESSION_COOKIE,
      value: "segredo",
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    });
  });

  it("aceita só a origem local e delega links externos HTTP(S) ao navegador", () => {
    expect(isLoopbackNavigation("http://127.0.0.1:42001/", 42001)).toBe(true);
    expect(isLoopbackNavigation("http://localhost:42001/", 42001)).toBe(false);
    expect(isLoopbackNavigation("https://127.0.0.1:42001/", 42001)).toBe(false);
    expect(isSafeExternalNavigation("https://openai.com")).toBe(true);
    expect(isSafeExternalNavigation("file:///etc/passwd")).toBe(false);
    expect(isSafeExternalNavigation("http://127.0.0.1:42001")).toBe(false);
  });
});
