type StudioOrphanCleanup = () => Promise<void>;
type StudioOrphanCleanupLoader = () => Promise<{
  stopOrphanedStudioUnits: StudioOrphanCleanup;
}>;

function shouldRunStudioOrphanCleanup(
  environment: Partial<NodeJS.ProcessEnv>
): boolean {
  return (
    environment.NEXT_RUNTIME === "nodejs" &&
    environment.GAUCHO_EDITION !== "desktop"
  );
}

export async function runStudioOrphanCleanup(
  environment: Partial<NodeJS.ProcessEnv> = process.env,
  loadCleanup: StudioOrphanCleanupLoader = () =>
    import("@/lib/server/studioOrphanUnits")
): Promise<void> {
  if (!shouldRunStudioOrphanCleanup(environment)) return;

  const { stopOrphanedStudioUnits } = await loadCleanup();
  await stopOrphanedStudioUnits();
}

// Executado uma vez quando o servidor Next sobe (não roda no build).
export async function register() {
  await runStudioOrphanCleanup();
}
