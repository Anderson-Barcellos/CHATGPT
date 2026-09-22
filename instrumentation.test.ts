import { afterEach, describe, expect, it, vi } from "vitest";

const { initializeRuntimeOwnership, validateRuntimeAuthConfig } = vi.hoisted(() => ({
  initializeRuntimeOwnership: vi.fn().mockResolvedValue(undefined),
  validateRuntimeAuthConfig: vi.fn(),
}));

vi.mock("@/lib/server/runtimeOwnership", () => ({ initializeRuntimeOwnership }));
vi.mock("@/lib/server/auth", () => ({ validateRuntimeAuthConfig }));
import { register } from "./instrumentation";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

describe("boot isolado", () => {
  it("QA também valida auth e reserva recursos; não ignora a exclusividade", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("GAUCHO_ISOLATED_RUNTIME", "true");
    await register();
    expect(validateRuntimeAuthConfig).toHaveBeenCalledOnce();
    expect(initializeRuntimeOwnership).toHaveBeenCalledOnce();
  });

  it("valida auth antes de iniciar o runtime principal", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("GAUCHO_ISOLATED_RUNTIME", "false");
    await register();
    expect(validateRuntimeAuthConfig.mock.invocationCallOrder[0]).toBeLessThan(initializeRuntimeOwnership.mock.invocationCallOrder[0]);
  });

  it("não importa o cleanup fora do runtime Node", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    await register();
    expect(initializeRuntimeOwnership).not.toHaveBeenCalled();
  });
  it("build não valida credenciais nem adquire recursos", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    await register();
    expect(validateRuntimeAuthConfig).not.toHaveBeenCalled();
    expect(initializeRuntimeOwnership).not.toHaveBeenCalled();
  });
  it("configuração inválida interrompe antes de qualquer efeito operacional", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    const exit = vi.spyOn(process, "exit").mockImplementation(() => { throw new Error("runtime_exit_1"); });
    vi.spyOn(console, "error").mockImplementation(() => {});
    validateRuntimeAuthConfig.mockImplementationOnce(() => { throw new Error("invalid_auth"); });
    await expect(register()).rejects.toThrow("runtime_exit_1");
    expect(exit).toHaveBeenCalledWith(1);
    expect(initializeRuntimeOwnership).not.toHaveBeenCalled();
  });
  it("falha de exclusividade também encerra o processo, não só rejeita o hook", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    const exit = vi.spyOn(process, "exit").mockImplementation(() => { throw new Error("runtime_exit_1"); });
    vi.spyOn(console, "error").mockImplementation(() => {});
    initializeRuntimeOwnership.mockRejectedValueOnce(new Error("runtime_resource_in_use"));
    await expect(register()).rejects.toThrow("runtime_exit_1");
    expect(exit).toHaveBeenCalledWith(1);
  });
});
