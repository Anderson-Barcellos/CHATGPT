import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createStudioRunnerScriptResponse } from "@/lib/server/studioRunner";

describe("Studio runner response", () => {
  it("serves the worker with a network-denying CSP", async () => {
    const response = createStudioRunnerScriptResponse();
    const source = await response.text();

    expect(response.headers.get("content-security-policy")).toContain(
      "connect-src 'none'"
    );
    expect(response.headers.get("content-type")).toContain("text/javascript");
    expect(source).toContain("hostPostMessage");
    expect(source).toContain("sessionToken");
  });
});
