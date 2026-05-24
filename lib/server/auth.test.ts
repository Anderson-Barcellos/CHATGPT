import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getAuthPassword,
  getAuthUsername,
  isAuthEnabled,
  signAuthToken,
  verifyAuthToken,
} from "@/lib/server/auth";

describe("auth helpers", () => {
  const originalAuthEnabled = process.env.AUTH_ENABLED;
  const originalAuthUsername = process.env.AUTH_USERNAME;
  const originalAuthPassword = process.env.AUTH_PASSWORD;
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.AUTH_ENABLED = "true";
    process.env.AUTH_USERNAME = "anders";
    process.env.AUTH_PASSWORD = "segredo-do-mate";
    process.env.JWT_SECRET = "jwt-super-seguro";
  });

  afterEach(() => {
    process.env.AUTH_ENABLED = originalAuthEnabled;
    process.env.AUTH_USERNAME = originalAuthUsername;
    process.env.AUTH_PASSWORD = originalAuthPassword;
    process.env.JWT_SECRET = originalJwtSecret;
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
});
