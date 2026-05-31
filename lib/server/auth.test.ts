import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import {
  clearAuthCookie,
  getAuthPassword,
  getAuthUsername,
  isAuthEnabled,
  setAuthCookie,
  signAuthToken,
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
  });

  afterEach(() => {
    process.env.AUTH_ENABLED = originalAuthEnabled;
    process.env.AUTH_USERNAME = originalAuthUsername;
    process.env.AUTH_PASSWORD = originalAuthPassword;
    process.env.JWT_SECRET = originalJwtSecret;
    process.env.NEXT_PUBLIC_BASE_PATH = originalBasePath;
  });

  it("detects when auth is enabled", () => {
    expect(isAuthEnabled()).toBe(true);
    expect(getAuthUsername()).toBe("anders");
    expect(getAuthPassword()).toBe("segredo-do-mate");
  });

  it("signs and verifies auth tokens", async () => {
    const token = await signAuthToken();

    expect(token).toBeTypeOf("string");
    await expect(verifyAuthToken(token)).resolves.toBe(true);
    await expect(verifyAuthToken(`${token}-corrompido`)).resolves.toBe(false);
  });

  it("sets auth cookie on base path scope", () => {
    const response = new NextResponse(null, { status: 200 });
    setAuthCookie(response, "token-de-teste");

    const setCookies =
      response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];

    expect(setCookies.some((value) => value.includes("auth-token=token-de-teste"))).toBe(
      true
    );
    expect(setCookies.some((value) => value.includes("Path=/chat"))).toBe(true);
    expect(setCookies.some((value) => value.includes("Path=/chat/"))).toBe(false);
  });

  it("clears auth cookie on base path scope", () => {
    const response = new NextResponse(null, { status: 200 });
    clearAuthCookie(response);

    const setCookies =
      response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];

    expect(setCookies.some((value) => value.includes("auth-token=; Path=/chat"))).toBe(
      true
    );
    expect(setCookies.some((value) => value.includes("Path=/chat/"))).toBe(false);
  });
});
