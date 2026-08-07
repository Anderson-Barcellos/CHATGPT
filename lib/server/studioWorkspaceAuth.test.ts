import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { signAuthToken } from "@/lib/server/auth";
import {
  STUDIO_WORKSPACE_TOKEN_HEADER,
  isStudioWorkspaceEnabled,
  requireStudioWorkspaceAccess,
  signStudioWorkspaceToken,
  verifyStudioWorkspacePassword,
  verifyStudioWorkspaceToken,
} from "@/lib/server/studioWorkspaceAuth";

const WORKSPACE_URL = "http://127.0.0.1:3040/api/studio/workspace/tree";

async function requestWithAppAuth(
  headers: Record<string, string> = {}
): Promise<NextRequest> {
  const appToken = await signAuthToken();
  return new NextRequest(WORKSPACE_URL, {
    headers: { cookie: `auth-token=${appToken}`, ...headers },
  });
}

async function readErrorCode(response: Response): Promise<string | undefined> {
  const body = (await response.json()) as { code?: string };
  return body.code;
}

describe("studio workspace auth", () => {
  const originalPassword = process.env.STUDIO_WORKSPACE_PASSWORD;
  const originalAuthEnabled = process.env.AUTH_ENABLED;
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.STUDIO_WORKSPACE_PASSWORD = "chimarrao-do-workspace";
    process.env.AUTH_ENABLED = "true";
    process.env.JWT_SECRET = "jwt-super-seguro";
  });

  afterEach(() => {
    process.env.STUDIO_WORKSPACE_PASSWORD = originalPassword;
    process.env.AUTH_ENABLED = originalAuthEnabled;
    process.env.JWT_SECRET = originalJwtSecret;
    vi.useRealTimers();
  });

  it("reports the feature disabled without the password env", () => {
    delete process.env.STUDIO_WORKSPACE_PASSWORD;
    expect(isStudioWorkspaceEnabled()).toBe(false);
  });

  it("reports the feature enabled with a configured password", () => {
    expect(isStudioWorkspaceEnabled()).toBe(true);
  });

  it("accepts only the exact configured password", () => {
    expect(verifyStudioWorkspacePassword("chimarrao-do-workspace")).toBe(true);
    expect(verifyStudioWorkspacePassword("chimarrao-errado")).toBe(false);
    expect(verifyStudioWorkspacePassword("")).toBe(false);
  });

  it("rejects any password when the feature is disabled", () => {
    delete process.env.STUDIO_WORKSPACE_PASSWORD;
    expect(verifyStudioWorkspacePassword("chimarrao-do-workspace")).toBe(false);
  });

  it("signs and verifies workspace tokens", async () => {
    const token = await signStudioWorkspaceToken();

    await expect(verifyStudioWorkspaceToken(token)).resolves.toBe(true);
    await expect(
      verifyStudioWorkspaceToken(`${token}-corrompido`)
    ).resolves.toBe(false);
    await expect(verifyStudioWorkspaceToken("")).resolves.toBe(false);
  });

  it("rejects tokens issued under a different password", async () => {
    const token = await signStudioWorkspaceToken();
    process.env.STUDIO_WORKSPACE_PASSWORD = "outra-senha";

    await expect(verifyStudioWorkspaceToken(token)).resolves.toBe(false);
  });

  it("expires workspace tokens after 60 minutes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T12:00:00Z"));
    const token = await signStudioWorkspaceToken();

    vi.setSystemTime(new Date("2026-08-07T12:59:00Z"));
    await expect(verifyStudioWorkspaceToken(token)).resolves.toBe(true);

    vi.setSystemTime(new Date("2026-08-07T13:01:00Z"));
    await expect(verifyStudioWorkspaceToken(token)).resolves.toBe(false);
  });

  it("returns 503 when the feature is disabled", async () => {
    delete process.env.STUDIO_WORKSPACE_PASSWORD;
    const gate = await requireStudioWorkspaceAccess(await requestWithAppAuth());

    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.response.status).toBe(503);
      await expect(readErrorCode(gate.response)).resolves.toBe(
        "studio_workspace_disabled"
      );
    }
  });

  it("returns 401 unauthorized without app authentication", async () => {
    const gate = await requireStudioWorkspaceAccess(
      new NextRequest(WORKSPACE_URL)
    );

    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.response.status).toBe(401);
      await expect(readErrorCode(gate.response)).resolves.toBe("unauthorized");
    }
  });

  it("returns 401 locked with app auth but no workspace token", async () => {
    const gate = await requireStudioWorkspaceAccess(await requestWithAppAuth());

    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.response.status).toBe(401);
      await expect(readErrorCode(gate.response)).resolves.toBe(
        "studio_workspace_locked"
      );
    }
  });

  it("returns 401 locked with an invalid workspace token", async () => {
    const gate = await requireStudioWorkspaceAccess(
      await requestWithAppAuth({
        [STUDIO_WORKSPACE_TOKEN_HEADER]: "token-invalido",
      })
    );

    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.response.status).toBe(401);
      await expect(readErrorCode(gate.response)).resolves.toBe(
        "studio_workspace_locked"
      );
    }
  });

  it("grants access with app auth and a valid workspace token", async () => {
    const token = await signStudioWorkspaceToken();
    const gate = await requireStudioWorkspaceAccess(
      await requestWithAppAuth({ [STUDIO_WORKSPACE_TOKEN_HEADER]: token })
    );

    expect(gate.ok).toBe(true);
  });

  it("still requires the workspace token when app auth is globally off", async () => {
    process.env.AUTH_ENABLED = "false";
    const gate = await requireStudioWorkspaceAccess(
      new NextRequest(WORKSPACE_URL)
    );

    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.response.status).toBe(401);
      await expect(readErrorCode(gate.response)).resolves.toBe(
        "studio_workspace_locked"
      );
    }
  });
});
