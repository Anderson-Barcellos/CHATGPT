import { describe, expect, it } from "vitest";
import { getRateLimitConfig } from "@/lib/security/rateLimit";

describe("rate limit config", () => {
  it("returns specific configs for known endpoints", () => {
    expect(getRateLimitConfig("/api/chat")).toMatchObject({ windowMs: 60000 });
    expect(getRateLimitConfig("/api/transcribe")).toMatchObject({ windowMs: 60000 });
  });

  it("gives Studio autocomplete an independent 180 RPM budget", () => {
    expect(getRateLimitConfig("/api/studio/autocomplete")).toEqual({
      windowMs: 60_000,
      max: 180,
    });
    expect(getRateLimitConfig("/api/studio/assist")).toEqual({
      windowMs: 60_000,
      max: 20,
    });
  });

  it("gives the Studio console stdin a budget independent from the 20 RPM studio bucket", () => {
    expect(getRateLimitConfig("/api/studio/workspace/run/stdin")).toEqual({
      windowMs: 60_000,
      max: 240,
    });
    expect(getRateLimitConfig("/api/studio/workspace/run")).toEqual({
      windowMs: 60_000,
      max: 30,
    });
  });

  it("falls back to the default config for unknown endpoints", () => {
    expect(getRateLimitConfig("/api/health")).toMatchObject({
      windowMs: 60000,
      max: 60,
    });
  });
});
