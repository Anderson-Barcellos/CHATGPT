import { describe, expect, it } from "vitest";
import { getRateLimitConfig } from "@/lib/security/rateLimit";
import {
  getSecurityContentSecurityPolicy,
  shouldRateLimitPath,
} from "@/proxy";

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

  it("applies the app content security policy to every route", () => {
    const csp = getSecurityContentSecurityPolicy();

    expect(csp).toContain("default-src 'self'");
  });
});
