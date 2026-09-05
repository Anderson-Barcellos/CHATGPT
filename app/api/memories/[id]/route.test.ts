import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  updateMemory: vi.fn(),
  deleteMemory: vi.fn(),
}));
vi.mock("@/app/api/memories/data", () => ({
  updateMemory: mocks.updateMemory,
  deleteMemory: mocks.deleteMemory,
}));
import { PUT } from "@/app/api/memories/[id]/route";

function put(body: unknown) {
  const request = new NextRequest("http://localhost/chat/api/memories/mem-1", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return PUT(request, { params: Promise.resolve({ id: "mem-1" }) });
}

describe("PUT /api/memories/[id]", () => {
  const previousAuth = process.env.AUTH_ENABLED;

  beforeEach(() => {
    process.env.AUTH_ENABLED = "false";
    mocks.updateMemory.mockReset();
    mocks.updateMemory.mockImplementation(async (id: string, updates: Record<string, unknown>) => ({
      id, content: "antigo", category: "preference", isActive: true, priority: 1,
      createdAt: new Date(0), updatedAt: new Date(0), ...updates,
    }));
  });

  afterEach(() => {
    if (previousAuth === undefined) delete process.env.AUTH_ENABLED;
    else process.env.AUTH_ENABLED = previousAuth;
  });

  it.each([
    ["content as object", { content: { $set: "x" } }],
    ["empty content", { content: "   " }],
    ["isActive as string", { isActive: "true" }],
    ["priority as string", { priority: "5" }],
    ["priority infinite", { priority: Number.POSITIVE_INFINITY }],
  ])("rejects %s with 400 without touching storage", async (_label, body) => {
    const response = await put(body);
    expect(response.status).toBe(400);
    expect(mocks.updateMemory).not.toHaveBeenCalled();
  });

  it("applies only the validated fields", async () => {
    const response = await put({ content: "  novo  ", isActive: false, priority: 3, extra: "ignorado" });
    expect(response.status).toBe(200);
    expect(mocks.updateMemory).toHaveBeenCalledWith("mem-1", {
      content: "novo", isActive: false, priority: 3,
    });
  });
});
