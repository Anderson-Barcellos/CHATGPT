import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireAppAuthMock = vi.fn();
const getGoogleCalendarConnectionStatusMock = vi.fn();

vi.mock("@/lib/server/routeAuth", () => ({
  requireAppAuth: requireAppAuthMock,
}));

vi.mock("@/lib/google/tokenStore", () => ({
  getGoogleCalendarConnectionStatus: getGoogleCalendarConnectionStatusMock,
}));

vi.mock("@/lib/google/oauth", () => ({
  isGoogleOAuthConfigured: () => false,
  googleOAuthRedirectUri: () =>
    "https://ultrassom.ai/chat/api/integrations/google/auth/callback",
}));

describe("/api/integrations/google/status route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAppAuthMock.mockResolvedValue(null);
  });

  it("returns disconnected status without failing when no token exists", async () => {
    getGoogleCalendarConnectionStatusMock.mockResolvedValueOnce({
      connected: false,
      tokenStoreConfigured: false,
      hasRefreshToken: false,
      defaultCalendarId: "primary",
    });

    const { GET } = await import("./route");
    const response = await GET(
      new NextRequest("http://localhost/api/integrations/google/status")
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      connected: false,
      oauthConfigured: false,
      defaultCalendarId: "primary",
    });
  });
});
