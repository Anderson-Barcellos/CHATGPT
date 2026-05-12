import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("home page cache policy", () => {
  it("serves the chat shell dynamically instead of prerendering a long-lived HTML shell", () => {
    const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

    expect(pageSource).toMatch(/export const dynamic = ["']force-dynamic["']/);
    expect(pageSource).toMatch(/export const revalidate = 0/);
    expect(pageSource).toMatch(/export const fetchCache = ["']force-no-store["']/);
  });
});
