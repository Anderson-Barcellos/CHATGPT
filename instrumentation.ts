// Executado uma vez quando o servidor Next sobe (não roda no build).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  try {
    const { validateRuntimeAuthConfig } = await import("@/lib/server/auth");
    validateRuntimeAuthConfig();
    const { initializeRuntimeOwnership } = await import("@/lib/server/runtimeOwnership");
    await initializeRuntimeOwnership();
  } catch (error) {
    // Next pode capturar a rejeição do hook e manter a porta aberta. O contrato
    // de boot exige encerrar, inclusive se auth/locks/ownership forem inválidos.
    console.error("[runtime] Inicialização recusada:", error instanceof Error ? error.message : "runtime_initialization_failed");
    process.exit(1);
  }
}
