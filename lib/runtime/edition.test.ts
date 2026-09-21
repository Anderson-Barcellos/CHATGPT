import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getGauchoEdition,
  getRuntimeDataDir,
  isDesktopUnavailablePath,
  isValidDesktopSession,
} from "./edition";

describe("edição Gaucho", () => {
  it("preserva web como padrão e exige diretório por usuário no desktop", () => {
    expect(getGauchoEdition({})).toBe("web");
    expect(getRuntimeDataDir({})).toBe(path.join(process.cwd(), "data"));
    expect(() => getRuntimeDataDir({ GAUCHO_EDITION: "desktop" })).toThrow(
      "GAUCHO_DATA_DIR é obrigatório"
    );
    expect(
      getRuntimeDataDir({
        GAUCHO_EDITION: "desktop",
        GAUCHO_DATA_DIR: "C:\\Users\\Anders\\AppData\\Roaming\\Gaucho Chat",
      })
    ).toBe("C:\\Users\\Anders\\AppData\\Roaming\\Gaucho Chat");
  });

  it("bloqueia somente superfícies excluídas da edição desktop", () => {
    expect(isDesktopUnavailablePath("/studio")).toBe(true);
    expect(isDesktopUnavailablePath("/soundcase/project-1")).toBe(true);
    expect(isDesktopUnavailablePath("/api/calendar/events")).toBe(true);
    expect(isDesktopUnavailablePath("/api/integrations/google/status")).toBe(true);
    expect(isDesktopUnavailablePath("/api/chat")).toBe(false);
  });

  it("exige o token local exato", async () => {
    await expect(isValidDesktopSession("token", "token")).resolves.toBe(true);
    await expect(isValidDesktopSession("outro", "token")).resolves.toBe(false);
    await expect(isValidDesktopSession(undefined, "token")).resolves.toBe(false);
  });
});
