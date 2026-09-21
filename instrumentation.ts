// Executado uma vez quando o servidor Next sobe (não roda no build).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Instâncias de QA não são donas das units do Studio deste host.
  // Flag somente server-side: preserva o comportamento do serviço principal.
  if (process.env.GAUCHO_ISOLATED_RUNTIME === "true") return;
  const { stopOrphanedStudioUnits } = await import("@/lib/server/studioOrphanUnits");
  await stopOrphanedStudioUnits();
}
