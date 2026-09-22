import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { GET as live } from "./live/route";
import { proxy } from "@/proxy";
import { NextRequest } from "next/server";

const original = {
  authEnabled: process.env.AUTH_ENABLED,
  authUsername: process.env.AUTH_USERNAME,
  authPassword: process.env.AUTH_PASSWORD,
  jwtSecret: process.env.JWT_SECRET,
  openAi: process.env.OPENAI_API_KEY,
};
let directory = "";

function restore(variable: string, value: string | undefined) {
  if (value === undefined) delete process.env[variable];
  else process.env[variable] = value;
}

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "gaucho-health-route-"));
  await writeFile(path.join(directory, "conversations.json"), "[]", "utf-8");
  await writeFile(path.join(directory, "memories.json"), "[]", "utf-8");
  await writeFile(path.join(directory, "persona.json"), JSON.stringify({ contextAboutUser: "" }), "utf-8");
  vi.spyOn(process, "cwd").mockReturnValue(directory);
  vi.stubEnv("NODE_ENV", "test");
  process.env.AUTH_ENABLED = "true";
  process.env.AUTH_USERNAME = "usuario-sintetico";
  process.env.AUTH_PASSWORD = "senha-sintetica";
  process.env.JWT_SECRET = "segredo-sintetico";
  process.env.OPENAI_API_KEY = "sk-sintetica";
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(directory, { recursive: true, force: true });
  restore("AUTH_ENABLED", original.authEnabled);
  restore("AUTH_USERNAME", original.authUsername);
  restore("AUTH_PASSWORD", original.authPassword);
  restore("JWT_SECRET", original.jwtSecret);
  vi.unstubAllEnvs();
  restore("OPENAI_API_KEY", original.openAi);
});

describe("health routes", () => {
  it("trata readiness como unhealthy e 503 quando falta storage", async () => {
    await rm(path.join(directory, "conversations.json"));

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "unhealthy",
      checks: { database: { status: "error" } },
    });
  });

  it("trata configuração de auth inválida como readiness unhealthy", async () => {
    delete process.env.AUTH_ENABLED;

    const proxyResponse = await proxy(new NextRequest("http://localhost/api/health"));
    const response = await GET();

    expect(proxyResponse.status).toBe(200);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      checks: { auth: { status: "error" } },
      metadata: { node_version: expect.any(String), pid: expect.any(Number) },
    });
  });

  it("expõe liveness público sem tocar auth ou storage", async () => {
    delete process.env.AUTH_ENABLED;
    await rm(path.join(directory, "conversations.json"));

    const response = live();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "live" });
  });
});
