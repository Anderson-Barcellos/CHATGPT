import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getRateLimitConfig } from "@/lib/security/rateLimit";
import {
  getSecurityContentSecurityPolicy,
  proxy,
  shouldRateLimitPath,
} from "@/proxy";

const originalAuthEnabled = process.env.AUTH_ENABLED;
const originalAuthUsername = process.env.AUTH_USERNAME;
const originalAuthPassword = process.env.AUTH_PASSWORD;
const originalJwtSecret = process.env.JWT_SECRET;

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  process.env.AUTH_ENABLED = "true";
  process.env.AUTH_USERNAME = "usuario-sintetico";
  process.env.AUTH_PASSWORD = "senha-sintetica";
  process.env.JWT_SECRET = "segredo-sintetico";
});

afterEach(() => {
  if (originalAuthEnabled === undefined) delete process.env.AUTH_ENABLED;
  else process.env.AUTH_ENABLED = originalAuthEnabled;
  if (originalAuthUsername === undefined) delete process.env.AUTH_USERNAME;
  else process.env.AUTH_USERNAME = originalAuthUsername;
  if (originalAuthPassword === undefined) delete process.env.AUTH_PASSWORD;
  else process.env.AUTH_PASSWORD = originalAuthPassword;
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
  vi.unstubAllEnvs();
});

describe("proxy rate limit routing", () => {
  it("uses the login rate limit for auth login", () => {
    expect(getRateLimitConfig("/api/auth/login")).toMatchObject({
      windowMs: 60000,
      max: 5,
    });
  });

  it("rate limits login even though it is a public route", () => {
    expect(shouldRateLimitPath("/api/auth/login")).toBe(true);
  });

  it("rate limits the Studio assistant independently from page navigation", () => {
    expect(shouldRateLimitPath("/api/studio/assist")).toBe(true);
    expect(getRateLimitConfig("/api/studio/assist")).toMatchObject({
      windowMs: 60000,
      max: 20,
    });
  });

  it("rate limits Studio autocomplete independently from the assistant", () => {
    expect(shouldRateLimitPath("/api/studio/autocomplete")).toBe(true);
    expect(getRateLimitConfig("/api/studio/autocomplete")).toMatchObject({
      windowMs: 60_000,
      max: 180,
    });
  });

  it("rate limits the workspace unlock tightly against brute force", () => {
    expect(shouldRateLimitPath("/api/studio/workspace/unlock")).toBe(true);
    expect(getRateLimitConfig("/api/studio/workspace/unlock")).toMatchObject({
      windowMs: 60_000,
      max: 10,
    });
  });

  it("rate limits workspace runs independently from other studio routes", () => {
    expect(shouldRateLimitPath("/api/studio/workspace/run")).toBe(true);
    expect(getRateLimitConfig("/api/studio/workspace/run")).toMatchObject({
      windowMs: 60_000,
      max: 30,
    });
  });

  it("does not rate limit plain workspace file routes via middleware", () => {
    expect(shouldRateLimitPath("/api/studio/workspace/tree")).toBe(false);
  });

  it("rate limits the public runner endpoints", () => {
    expect(shouldRateLimitPath("/api/pulse/run-due")).toBe(true);
    expect(shouldRateLimitPath("/api/soundcase/worker/run-next")).toBe(true);
  });

  it("applies the app content security policy to every route", () => {
    const csp = getSecurityContentSecurityPolicy();

    expect(csp).toContain("default-src 'self'");
  });

  it("não deixa configuração inválida abrir rotas públicas de autenticação", async () => {
    delete process.env.AUTH_ENABLED;

    const response = await proxy(new NextRequest("http://localhost/api/auth/check"));

    expect(response.status).toBe(503);
  });

  it("mantém liveness público mesmo quando a configuração ainda não está válida", async () => {
    delete process.env.AUTH_ENABLED;

    const response = await proxy(new NextRequest("http://localhost/api/health/live"));

    expect(response.status).toBe(200);
  });

  it("deixa somente o readiness exato produzir seu contrato unhealthy", async () => {
    delete process.env.AUTH_ENABLED;

    const readiness = await proxy(new NextRequest("http://localhost/api/health"));
    const nestedPath = await proxy(new NextRequest("http://localhost/api/health/private"));

    expect(readiness.status).toBe(200);
    expect(nestedPath.status).toBe(503);
  });
});
