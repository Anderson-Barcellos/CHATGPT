import { describe, expect, it } from "vitest";

describe("home page cache policy", () => {
  it("serves the chat shell dynamically instead of prerendering a long-lived HTML shell", async () => {
    const pageModule = await import("./page");

    expect(pageModule.dynamic).toBe("force-dynamic");
    expect(pageModule.revalidate).toBe(0);
    expect(pageModule.fetchCache).toBe("force-no-store");
  });
});
