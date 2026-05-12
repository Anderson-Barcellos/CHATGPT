import { describe, expect, it } from "vitest";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";

function jsonRequest(payload: string): Request {
  return new Request("https://example.test/api/chat", {
    method: "POST",
    body: payload,
    headers: { "Content-Type": "application/json" },
  });
}

describe("readJsonWithLimit", () => {
  it("parses JSON payloads within the byte limit", async () => {
    const result = await readJsonWithLimit<{ message: string }>(
      jsonRequest(JSON.stringify({ message: "Ola" })),
      { limitBytes: 1024 }
    );

    expect(result).toEqual({
      ok: true,
      value: { message: "Ola" },
    });
  });

  it("rejects invalid JSON as a bad request", async () => {
    const result = await readJsonWithLimit(jsonRequest("{bad json"), {
      limitBytes: 1024,
    });

    expect(result).toEqual({
      ok: false,
      reason: "invalid_json",
      status: 400,
    });
  });

  it("rejects bodies that exceed the configured byte limit", async () => {
    const result = await readJsonWithLimit(jsonRequest(JSON.stringify({ text: "abcd" })), {
      limitBytes: 10,
    });

    expect(result).toEqual({
      ok: false,
      reason: "too_large",
      status: 413,
    });
  });
});
