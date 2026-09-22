import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import {
  clearAuthCookie,
  getAuthPassword,
  getAuthUsername,
  isAuthConfigurationValid,
  isAuthEnabled,
  setAuthCookie,
  signAuthToken,
  validateRuntimeAuthConfig,
  verifyAuthToken,
} from "@/lib/server/auth";

describe("auth helpers", () => {
  const originalAuthEnabled = process.env.AUTH_ENABLED;
  const originalAuthUsername = process.env.AUTH_USERNAME;
  const originalAuthPassword = process.env.AUTH_PASSWORD;
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalBasePath = process.env.NEXT_PUBLIC_BASE_PATH;

  beforeEach(() => {
    process.env.AUTH_ENABLED = "true";
    process.env.AUTH_USERNAME = "anders";
    process.env.AUTH_PASSWORD = "segredo-do-mate";
    process.env.JWT_SECRET = "jwt-super-seguro";
    process.env.NEXT_PUBLIC_BASE_PATH = "/chat";
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    process.env.AUTH_ENABLED = originalAuthEnabled;
    process.env.AUTH_USERNAME = originalAuthUsername;
    process.env.AUTH_PASSWORD = originalAuthPassword;
    process.env.JWT_SECRET = originalJwtSecret;
    process.env.NEXT_PUBLIC_BASE_PATH = originalBasePath;
    vi.unstubAllEnvs();
  });

  it("detects when auth is enabled", () => {
    expect(isAuthEnabled()).toBe(true);
    expect(isAuthConfigurationValid()).toBe(true);
    expect(getAuthUsername()).toBe("anders");
    expect(getAuthPassword()).toBe("segredo-do-mate");
  });

  it("permite desligamento somente com false explícito fora de produção", () => {
    process.env.AUTH_ENABLED = "false";
    delete process.env.AUTH_USERNAME;
    delete process.env.AUTH_PASSWORD;
    delete process.env.JWT_SECRET;

    expect(isAuthConfigurationValid()).toBe(true);
    expect(isAuthEnabled()).toBe(false);
  });

  it("falha fechado para configuração ausente fora de produção", () => {
    delete process.env.AUTH_ENABLED;

    expect(isAuthConfigurationValid()).toBe(false);
    expect(isAuthEnabled()).toBe(true);
  });

  it("exige autenticação e credenciais completas em produção sem revelar valores", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.AUTH_ENABLED = "false";
    delete process.env.AUTH_USERNAME;
    delete process.env.AUTH_PASSWORD;
    delete process.env.JWT_SECRET;

    expect(isAuthConfigurationValid()).toBe(false);
    expect(isAuthEnabled()).toBe(true);
    expect(() => validateRuntimeAuthConfig()).toThrow("AUTH_ENABLED");

    process.env.AUTH_ENABLED = "true";
    process.env.AUTH_USERNAME = "usuario-sintetico";
    process.env.AUTH_PASSWORD = "senha-sintetica";
    process.env.JWT_SECRET = "segredo-sintetico";

    expect(() => validateRuntimeAuthConfig()).not.toThrow();
  });

  it("signs and verifies auth tokens", async () => {
    const token = await signAuthToken();

    expect(token).toBeTypeOf("string");
    await expect(verifyAuthToken(token)).resolves.toBe(true);
    await expect(verifyAuthToken(`${token}-corrompido`)).resolves.toBe(false);
  });

  it("sets auth cookie with root path", () => {
    const response = new NextResponse(null, { status: 200 });
    setAuthCookie(response, "token-de-teste");

    const setCookies =
      response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];

    expect(setCookies.some((value) => value.includes("auth-token=token-de-teste"))).toBe(
      true
    );
    expect(setCookies.some((value) => value.includes("Path=/"))).toBe(true);
    expect(setCookies.some((value) => value.includes("Path=/chat"))).toBe(false);
  });

  it("clears auth cookie with root path", () => {
    const response = new NextResponse(null, { status: 200 });
    clearAuthCookie(response);

    const setCookies =
      response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];

    expect(setCookies.some((value) => value.includes("auth-token=; Path=/"))).toBe(true);
    expect(setCookies.some((value) => value.includes("Path=/chat"))).toBe(false);
  });
});
