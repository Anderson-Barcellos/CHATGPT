import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ runDuePulseTasks: vi.fn() }));
vi.mock("@/lib/pulse/runner", () => ({ runDuePulseTasks: mocks.runDuePulseTasks }));
import { POST } from "@/app/api/pulse/run-due/route";

const previousToken = process.env.PULSE_RUNNER_TOKEN;
const URL = "http://127.0.0.1/api/pulse/run-due";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.PULSE_RUNNER_TOKEN = "pulse-secret";
});

afterEach(() => {
  vi.restoreAllMocks();
  if (previousToken === undefined) delete process.env.PULSE_RUNNER_TOKEN;
  else process.env.PULSE_RUNNER_TOKEN = previousToken;
});

describe("Pulse run-due route", () => {
  it("rejects a missing bearer even on loopback", async () => {
    const response = await POST(new NextRequest(URL, { method: "POST" }));
    expect(response.status).toBe(401);
    expect(mocks.runDuePulseTasks).not.toHaveBeenCalled();
  });

  it("rejects a wrong bearer", async () => {
    const response = await POST(
      new NextRequest(URL, { method: "POST", headers: { authorization: "Bearer nope" } })
    );
    expect(response.status).toBe(401);
    expect(mocks.runDuePulseTasks).not.toHaveBeenCalled();
  });

  it("fails closed when the runner token is not configured, even on localhost", async () => {
    delete process.env.PULSE_RUNNER_TOKEN;
    const response = await POST(
      new NextRequest("http://localhost/api/pulse/run-due", { method: "POST" })
    );
    expect(response.status).toBe(503);
    expect(mocks.runDuePulseTasks).not.toHaveBeenCalled();
  });

  it("runs due tasks with the correct bearer", async () => {
    mocks.runDuePulseTasks.mockResolvedValue({ checkedAt: "now", dueCount: 0, runs: [] });
    const response = await POST(
      new NextRequest(URL, { method: "POST", headers: { authorization: "Bearer pulse-secret" } })
    );
    expect(response.status).toBe(200);
    expect(mocks.runDuePulseTasks).toHaveBeenCalledOnce();
    expect(await response.text()).not.toContain("pulse-secret");
  });
});
