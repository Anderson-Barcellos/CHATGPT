import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as check } from "./check/route";
import { POST as login } from "./login/route";

const original = {
  enabled: process.env.AUTH_ENABLED,
  username: process.env.AUTH_USERNAME,
  password: process.env.AUTH_PASSWORD,
  secret: process.env.JWT_SECRET,
};

function restore(name: keyof typeof original, variable: string) {
  const value = original[name];
  if (value === undefined) delete process.env[variable];
  else process.env[variable] = value;
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  process.env.AUTH_ENABLED = "true";
  process.env.AUTH_USERNAME = "usuario-sintetico";
  process.env.AUTH_PASSWORD = "senha-sintetica";
  process.env.JWT_SECRET = "segredo-sintetico";
});

afterEach(() => {
  restore("enabled", "AUTH_ENABLED");
  restore("username", "AUTH_USERNAME");
  restore("password", "AUTH_PASSWORD");
  restore("secret", "JWT_SECRET");
  vi.unstubAllEnvs();
});

describe("rotas de autenticação", () => {
  it("mantém o login e a checagem para credenciais válidas", async () => {
    const loginResponse = await login(
      new NextRequest("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: "usuario-sintetico", password: "senha-sintetica" }),
      })
    );

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.headers.get("set-cookie")).toContain("auth-token=");

    const token = loginResponse.headers.get("set-cookie")?.match(/auth-token=([^;]+)/)?.[1];
    const checkResponse = await check(
      new NextRequest("http://localhost/api/auth/check", {
        headers: { cookie: `auth-token=${token}` },
      })
    );
    await expect(checkResponse.json()).resolves.toEqual({ authEnabled: true, authenticated: true });
  });

  it("retorna 503 para login e check quando a configuração é inválida", async () => {
    delete process.env.AUTH_ENABLED;

    const loginResponse = await login(
      new NextRequest("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: "qualquer", password: "coisa" }),
      })
    );
    const checkResponse = await check(new NextRequest("http://localhost/api/auth/check"));

    expect(loginResponse.status).toBe(503);
    expect(checkResponse.status).toBe(503);
    await expect(loginResponse.text()).resolves.not.toContain("senha-sintetica");
  });
});
