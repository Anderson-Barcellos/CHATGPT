import OpenAI from "openai";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authEnabled: vi.fn(() => false),
  authenticated: vi.fn().mockResolvedValue(true),
  createClient: vi.fn(),
  complete: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/auth", () => ({
  isAuthEnabled: mocks.authEnabled,
  isAuthenticatedRequest: mocks.authenticated,
}));
vi.mock("@/lib/server/studioAutocomplete", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/server/studioAutocomplete")>();
  return {
    ...original,
    createStudioFimClient: mocks.createClient,
    requestStudioFimCompletion: mocks.complete,
  };
});

import { POST } from "@/app/api/studio/autocomplete/route";

function request(body: unknown) {
  return new NextRequest("http://localhost/chat/api/studio/autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validRequest = {
  filePath: "src/index.ts",
  language: "typescript",
  prefix: "const answer = ",
  suffix: ";",
};

describe("Studio autocomplete route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authEnabled.mockReturnValue(false);
    mocks.authenticated.mockResolvedValue(true);
    mocks.createClient.mockReturnValue({});
    mocks.complete.mockResolvedValue({
      completion: "42",
      finishReason: "stop",
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("requires app authentication", async () => {
    mocks.authEnabled.mockReturnValue(true);
    mocks.authenticated.mockResolvedValueOnce(false);

    const response = await POST(request(validRequest));

    expect(response.status).toBe(401);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("rejects invalid or oversized autocomplete context", async () => {
    const response = await POST(
      request({ ...validRequest, prefix: "x".repeat(32_001) })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "studio_autocomplete_context_invalid",
    });
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it("returns a provider-specific 503 without exposing configuration", async () => {
    mocks.createClient.mockReturnValue(null);

    const response = await POST(request(validRequest));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Autocomplete unavailable",
      message: "Autocomplete temporariamente indisponível.",
      code: "studio_autocomplete_unavailable",
    });
  });

  it("returns only the public completion contract", async () => {
    const response = await POST(request(validRequest));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      completion: "42",
      finishReason: "stop",
    });
    expect(mocks.complete).toHaveBeenCalledWith(
      {},
      validRequest,
      expect.any(AbortSignal)
    );
  });

  it("maps an aborted upstream call to 499", async () => {
    const error = new Error("aborted");
    error.name = "AbortError";
    mocks.complete.mockRejectedValueOnce(error);

    expect((await POST(request(validRequest))).status).toBe(499);
  });

  it("maps the linked upstream timeout to a sanitized 504", async () => {
    const error = new Error("timed out with sensitive code");
    error.name = "TimeoutError";
    mocks.complete.mockRejectedValueOnce(error);

    const response = await POST(request(validRequest));

    expect(response.status).toBe(504);
    const payload = await response.json();
    expect(payload).toMatchObject({ code: "studio_autocomplete_timeout" });
    expect(JSON.stringify(payload)).not.toContain("sensitive");
  });

  it("preserves Retry-After without returning the upstream message", async () => {
    mocks.complete.mockRejectedValueOnce(
      new OpenAI.APIError(
        429,
        { error: { message: "sensitive upstream payload" } },
        "sensitive upstream payload",
        new Headers({ "retry-after": "17" })
      )
    );

    const response = await POST(request(validRequest));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("17");
    expect(JSON.stringify(await response.json())).not.toContain("sensitive");
  });

  it("does not return generic upstream details", async () => {
    mocks.complete.mockRejectedValueOnce(
      new Error("sensitive upstream payload and source code")
    );

    const response = await POST(request(validRequest));

    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("sensitive");
    expect(console.error).toHaveBeenCalledWith(
      "Studio autocomplete upstream failure",
      expect.objectContaining({ name: "Error" })
    );
  });
});
