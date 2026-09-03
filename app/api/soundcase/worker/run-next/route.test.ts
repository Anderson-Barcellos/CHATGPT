import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ runNextSoundCaseJob: vi.fn() }));
vi.mock("@/lib/server/soundcase/worker", () => ({ runNextSoundCaseJob: mocks.runNextSoundCaseJob }));
import { POST } from "@/app/api/soundcase/worker/run-next/route";

const previousToken = process.env.SOUNDCASE_WORKER_TOKEN;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SOUNDCASE_WORKER_TOKEN = "worker-secret";
});

afterEach(() => {
  if (previousToken === undefined) delete process.env.SOUNDCASE_WORKER_TOKEN;
  else process.env.SOUNDCASE_WORKER_TOKEN = previousToken;
});

describe("SoundCase worker route", () => {
  it("rejects a missing bearer even on loopback", async () => {
    const response = await POST(new NextRequest("http://127.0.0.1/api/soundcase/worker/run-next", { method: "POST" }));
    expect(response.status).toBe(401);
    expect(mocks.runNextSoundCaseJob).not.toHaveBeenCalled();
  });

  it("fails closed when the worker token is not configured", async () => {
    delete process.env.SOUNDCASE_WORKER_TOKEN;
    const response = await POST(new NextRequest("http://127.0.0.1/api/soundcase/worker/run-next", { method: "POST" }));
    expect(response.status).toBe(503);
  });

  it("returns 204 when the authenticated queue is empty", async () => {
    mocks.runNextSoundCaseJob.mockResolvedValue({ status: "empty" });
    const response = await POST(new NextRequest("http://127.0.0.1/api/soundcase/worker/run-next", {
      method: "POST", headers: { authorization: "Bearer worker-secret" },
    }));
    expect(response.status).toBe(204);
    expect(mocks.runNextSoundCaseJob).toHaveBeenCalledOnce();
  });

  it("returns the processed result without leaking the configured token", async () => {
    mocks.runNextSoundCaseJob.mockResolvedValue({ status: "completed", versionId: VERSION_ID });
    const response = await POST(new NextRequest("http://127.0.0.1/api/soundcase/worker/run-next", {
      method: "POST", headers: { authorization: "Bearer worker-secret" },
    }));
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain("worker-secret");
  });

  it("sanitizes unexpected worker failures with a diagnostic id", async () => {
    mocks.runNextSoundCaseJob.mockRejectedValue(new Error("provider secret"));
    const response = await POST(new NextRequest("http://127.0.0.1/api/soundcase/worker/run-next", {
      method: "POST", headers: { authorization: "Bearer worker-secret" },
    }));
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.diagnosticId).toEqual(expect.any(String));
    expect(JSON.stringify(body)).not.toContain("provider secret");
  });
});

const VERSION_ID = "22222222-2222-4222-8222-222222222222";
