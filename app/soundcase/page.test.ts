import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("SoundCase page", () => {
  it("is dynamic, authenticated and renders the SoundCase shell", () => {
    const source = readFileSync(path.join(process.cwd(), "app/soundcase/page.tsx"), "utf8");
    expect(source).toContain('export const dynamic = "force-dynamic"');
    expect(source).toContain("verifyAuthToken");
    expect(source).toContain("SoundCaseShell");
  });
});
