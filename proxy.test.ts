import { describe, expect, it } from "vitest";
import { getRateLimitConfig } from "@/lib/security/rateLimit";
import { shouldRateLimitPath } from "@/proxy";

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
});
