import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const projectId = "11111111-1111-4111-8111-111111111111";
const versionId = "22222222-2222-4222-8222-222222222222";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), getVersion: vi.fn() }));
vi.mock("@/lib/server/routeAuth", () => ({ requireAppAuth: mocks.auth }));
vi.mock("@/lib/server/soundcase/jobs", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/server/soundcase/jobs")>(),
  getSoundCaseVersion: mocks.getVersion,
}));
import { GET } from "@/app/api/soundcase/projects/[projectId]/versions/[versionId]/source/route";

const context = { params: Promise.resolve({ projectId, versionId }) };
let root: string;
beforeEach(async () => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(null);
  mocks.getVersion.mockResolvedValue({ id: versionId, projectId });
  root = await fs.mkdtemp(path.join(tmpdir(), "soundcase-source-"));
  vi.stubEnv("SOUNDCASE_DATA_DIR", root);
  const directory = path.join(root, "projects", projectId, "versions", versionId);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "source.txt"), "Texto original.\n\nSegunda parte.");
  await fs.writeFile(path.join(root, "projects", projectId, "draft.txt"), "Rascunho editado depois da geração.");
});
afterEach(async () => { vi.unstubAllEnvs(); await fs.rm(root, { recursive: true, force: true }); });

describe("SoundCase version source", () => {
  it("returns the immutable version text with private no-store caching", async () => {
    const response = await GET(new NextRequest("http://local/source"), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ text: "Texto original.\n\nSegunda parte." });
  });
  it("authenticates before accessing version metadata or text", async () => {
    mocks.auth.mockResolvedValue(new Response(null, { status: 401 }));
    expect((await GET(new NextRequest("http://local/source"), context)).status).toBe(401);
    expect(mocks.getVersion).not.toHaveBeenCalled();
  });
  it("rejects invalid identifiers before accessing storage", async () => {
    const response = await GET(new NextRequest("http://local/source"), { params: Promise.resolve({ projectId: "..", versionId }) });
    expect(response.status).toBe(400);
    expect(mocks.getVersion).not.toHaveBeenCalled();
  });
  it("rejects metadata pointing to another project", async () => {
    mocks.getVersion.mockResolvedValue({ id: versionId, projectId: versionId });
    expect((await GET(new NextRequest("http://local/source"), context)).status).toBe(404);
  });
});
