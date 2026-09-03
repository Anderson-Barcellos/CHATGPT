import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/server/auth", () => ({
  isAuthEnabled: () => false,
  isAuthenticatedRequest: vi.fn().mockResolvedValue(true),
}));

describe("TTS route build-safe credential gate", () => {
  const previous = process.env.OPENAI_API_KEY;
  afterEach(() => {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  });

  it("loads without a key and rejects before reading the body", async () => {
    delete process.env.OPENAI_API_KEY;
    const { POST } = await import("@/app/api/tts/route");
    const json = vi.fn(() => { throw new Error("body must not be read"); });
    const response = await POST({ json } as unknown as NextRequest);
    expect(response.status).toBe(503);
    expect(json).not.toHaveBeenCalled();
  });
});
