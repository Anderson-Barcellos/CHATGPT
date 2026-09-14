// Executado uma vez quando o servidor Next sobe (não roda no build).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { stopOrphanedStudioUnits } = await import("@/lib/server/studioOrphanUnits");
  await stopOrphanedStudioUnits();
}
