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

  it("removes network access from the Studio runner response", () => {
    const csp = getSecurityContentSecurityPolicy("/api/studio/runner");

    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src blob:");
    expect(csp).toContain("connect-src 'none'");
  });
});
