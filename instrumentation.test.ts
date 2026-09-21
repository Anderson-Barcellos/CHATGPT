import { describe, expect, it, vi } from "vitest";
import { runStudioOrphanCleanup } from "./instrumentation";

describe("instrumentation", () => {
  it("não importa nem chama a limpeza do Studio na edição desktop", async () => {
    const loadCleanup = vi.fn();

    await runStudioOrphanCleanup(
      { NEXT_RUNTIME: "nodejs", GAUCHO_EDITION: "desktop" },
      loadCleanup
    );

    expect(loadCleanup).not.toHaveBeenCalled();
  });

  it("preserva a limpeza de unidades órfãs no boot Node da web", async () => {
    const stopOrphanedStudioUnits = vi.fn().mockResolvedValue(undefined);
    const loadCleanup = vi.fn().mockResolvedValue({ stopOrphanedStudioUnits });

    await runStudioOrphanCleanup({ NEXT_RUNTIME: "nodejs" }, loadCleanup);

    expect(loadCleanup).toHaveBeenCalledOnce();
    expect(stopOrphanedStudioUnits).toHaveBeenCalledOnce();
  });
});
