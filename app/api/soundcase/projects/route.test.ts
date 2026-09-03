import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAppAuth: vi.fn(), readJsonWithLimit: vi.fn(),
  listSoundCaseProjects: vi.fn(), createSoundCaseProject: vi.fn(), getSoundCaseProject: vi.fn(),
}));
vi.mock("@/lib/server/routeAuth", () => ({ requireAppAuth: mocks.requireAppAuth }));
vi.mock("@/lib/server/readJsonWithLimit", () => ({ readJsonWithLimit: mocks.readJsonWithLimit }));
vi.mock("@/lib/server/soundcase/store", () => ({
  listSoundCaseProjects: mocks.listSoundCaseProjects,
  createSoundCaseProject: mocks.createSoundCaseProject,
  getSoundCaseProject: mocks.getSoundCaseProject,
}));

import { GET, POST } from "@/app/api/soundcase/projects/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAppAuth.mockResolvedValue(null);
});

describe("/api/soundcase/projects", () => {
  it("authenticates before reading the request body", async () => {
    mocks.requireAppAuth.mockResolvedValue(Response.json({ error: "Unauthorized" }, { status: 401 }));
    const response = await POST(new NextRequest("http://local/api/soundcase/projects", { method: "POST" }));
    expect(response.status).toBe(401);
    expect(mocks.readJsonWithLimit).not.toHaveBeenCalled();
    expect(mocks.createSoundCaseProject).not.toHaveBeenCalled();
  });

  it("lists projects behind the shared auth gate", async () => {
    mocks.listSoundCaseProjects.mockResolvedValue([{ id: "p" }]);
    const response = await GET(new NextRequest("http://local/api/soundcase/projects"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ projects: [{ id: "p" }] });
  });

  it("creates and returns the complete project detail", async () => {
    mocks.readJsonWithLimit.mockResolvedValue({ ok: true, value: { title: "Leitura", text: "Texto" } });
    mocks.createSoundCaseProject.mockResolvedValue({ id: "project-id" });
    mocks.getSoundCaseProject.mockResolvedValue({ id: "project-id", draftText: "Texto", versions: [] });
    const response = await POST(new NextRequest("http://local/api/soundcase/projects", { method: "POST" }));
    expect(response.status).toBe(201);
    expect(mocks.createSoundCaseProject).toHaveBeenCalledWith({ title: "Leitura", text: "Texto" });
    await expect(response.json()).resolves.toMatchObject({ project: { draftText: "Texto" } });
  });

  it("sanitizes unknown storage errors", async () => {
    mocks.listSoundCaseProjects.mockRejectedValue(new Error("private path /secret"));
    const response = await GET(new NextRequest("http://local/api/soundcase/projects"));
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.code).toBe("soundcase_internal_error");
    expect(JSON.stringify(body)).not.toContain("/secret");
  });
});
