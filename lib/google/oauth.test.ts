import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { buildGoogleOAuthAuthorizationUrl } from "@/lib/google/oauth";

describe("google oauth", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.NEXT_PUBLIC_BASE_PATH = "/chat";
    delete process.env.GOOGLE_OAUTH_REDIRECT_URI;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("builds a web-server OAuth URL with offline calendar-events access", () => {
    const request = new NextRequest("https://ultrassom.ai/chat/api/test", {
      headers: {
        "x-forwarded-host": "ultrassom.ai",
        "x-forwarded-proto": "https",
      },
    });
    const url = new URL(buildGoogleOAuthAuthorizationUrl("state-123", request));

    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://ultrassom.ai/chat/api/integrations/google/auth/callback"
    );
    expect(url.searchParams.get("scope")).toBe(
      "https://www.googleapis.com/auth/calendar.events"
    );
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("include_granted_scopes")).toBe("true");
    expect(url.searchParams.get("state")).toBe("state-123");
  });
});
