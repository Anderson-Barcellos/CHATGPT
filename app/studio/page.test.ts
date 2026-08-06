import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Studio page cache policy", () => {
  it("keeps the authenticated Studio shell dynamic and uncached", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

    expect(source).toMatch(/export const dynamic = ["']force-dynamic["']/);
    expect(source).toMatch(/export const revalidate = 0/);
    expect(source).toMatch(/export const fetchCache = ["']force-no-store["']/);
    expect(source).toContain("GauchoStudioShell");
  });
});
