import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { requireAppAuth } from "./routeAuth";

const originalEnabled = process.env.AUTH_ENABLED;
const originalUsername = process.env.AUTH_USERNAME;
const originalPassword = process.env.AUTH_PASSWORD;
const originalSecret = process.env.JWT_SECRET;

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  process.env.AUTH_ENABLED = "true";
  process.env.AUTH_USERNAME = "usuario-sintetico";
  process.env.AUTH_PASSWORD = "senha-sintetica";
  process.env.JWT_SECRET = "segredo-sintetico";
});

afterEach(() => {
  if (originalEnabled === undefined) delete process.env.AUTH_ENABLED;
  else process.env.AUTH_ENABLED = originalEnabled;
  if (originalUsername === undefined) delete process.env.AUTH_USERNAME;
  else process.env.AUTH_USERNAME = originalUsername;
  if (originalPassword === undefined) delete process.env.AUTH_PASSWORD;
  else process.env.AUTH_PASSWORD = originalPassword;
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
  vi.unstubAllEnvs();
});

describe("requireAppAuth", () => {
  it("retorna 503, e não bypass, para configuração inválida", async () => {
    delete process.env.AUTH_ENABLED;

    const response = await requireAppAuth(new NextRequest("http://localhost/api/private"));

    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toMatchObject({ code: "auth_configuration_invalid" });
  });
});
