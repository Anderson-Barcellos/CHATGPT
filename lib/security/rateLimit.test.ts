import { describe, expect, it } from "vitest";
import { getRateLimitConfig } from "@/lib/security/rateLimit";

describe("rate limit config", () => {
  it("returns specific configs for known endpoints", () => {
    expect(getRateLimitConfig("/api/chat")).toMatchObject({ windowMs: 60000 });
    expect(getRateLimitConfig("/api/transcribe")).toMatchObject({ windowMs: 60000 });
  });

  it("falls back to the default config for unknown endpoints", () => {
    expect(getRateLimitConfig("/api/health")).toMatchObject({
      windowMs: 60000,
      max: 60,
    });
  });
});
