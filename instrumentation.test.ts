import { afterEach, describe, expect, it, vi } from "vitest";

const { stopOrphanedStudioUnits } = vi.hoisted(() => ({
  stopOrphanedStudioUnits: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/server/studioOrphanUnits", () => ({ stopOrphanedStudioUnits }));
import { register } from "./instrumentation";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("boot isolado", () => {
  it("não para units de produção quando o QA inicia", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("GAUCHO_ISOLATED_RUNTIME", "true");
    await register();
    expect(stopOrphanedStudioUnits).not.toHaveBeenCalled();
  });

  it("preserva a limpeza do runtime principal", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("GAUCHO_ISOLATED_RUNTIME", "false");
    await register();
    expect(stopOrphanedStudioUnits).toHaveBeenCalledOnce();
  });

  it("não importa o cleanup fora do runtime Node", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    await register();
    expect(stopOrphanedStudioUnits).not.toHaveBeenCalled();
  });
});
