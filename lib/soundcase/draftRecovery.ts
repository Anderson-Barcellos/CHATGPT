const RECOVERY_PREFIX = "gaucho-soundcase:draft-recovery:v1:";

export interface SoundCaseDraftRecovery {
  projectId: string;
  text: string;
  baseRevision: number;
  updatedAt: string;
}

type RecoveryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): RecoveryStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function recoveryKey(projectId: string): string {
  return `${RECOVERY_PREFIX}${projectId}`;
}

export function saveSoundCaseDraftRecovery(
  recovery: SoundCaseDraftRecovery,
  storage: RecoveryStorage | null = browserStorage()
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(recoveryKey(recovery.projectId), JSON.stringify(recovery));
    return true;
  } catch {
    return false;
  }
}

export function readSoundCaseDraftRecovery(
  projectId: string,
  storage: RecoveryStorage | null = browserStorage()
): SoundCaseDraftRecovery | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(recoveryKey(projectId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<SoundCaseDraftRecovery>;
    if (value.projectId !== projectId || typeof value.text !== "string" ||
      !Number.isSafeInteger(value.baseRevision) || (value.baseRevision ?? -1) < 0 ||
      typeof value.updatedAt !== "string") return null;
    return value as SoundCaseDraftRecovery;
  } catch {
    return null;
  }
}

export function clearSoundCaseDraftRecovery(
  projectId: string,
  storage: RecoveryStorage | null = browserStorage()
): void {
  if (!storage) return;
  try { storage.removeItem(recoveryKey(projectId)); } catch { /* best effort */ }
}
