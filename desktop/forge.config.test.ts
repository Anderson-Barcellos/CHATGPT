import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import config from "./forge.config";

describe("configuração do pacote desktop", () => {
  it("identifica executável e produto como Gaucho Chat", () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(process.cwd(), "package.json"), "utf8")
    ) as { author?: string; description?: string; productName?: string };

    expect(packageJson.productName).toBe("Gaucho Chat");
    expect(packageJson.author).toBe("Anderson Barcellos");
    expect(packageJson.description).toBe("Gaucho Chat desktop application");
    expect(config.packagerConfig?.executableName).toBe("Gaucho Chat");
  });
});
