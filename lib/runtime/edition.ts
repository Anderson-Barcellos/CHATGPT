import path from "node:path";

export type GauchoEdition = "web" | "desktop";

export const DESKTOP_EDITION_ENV = "GAUCHO_EDITION";
export const DESKTOP_DATA_DIR_ENV = "GAUCHO_DATA_DIR";
export const DESKTOP_SESSION_COOKIE = "gaucho-desktop-session";

type RuntimeEnvironment = Partial<NodeJS.ProcessEnv>;

export function getGauchoEdition(env: RuntimeEnvironment = process.env): GauchoEdition {
  return env[DESKTOP_EDITION_ENV] === "desktop" ? "desktop" : "web";
}

export function isDesktopEdition(env: RuntimeEnvironment = process.env): boolean {
  return getGauchoEdition(env) === "desktop";
}

export function getRuntimeDataDir(env: RuntimeEnvironment = process.env): string {
  const configured = env[DESKTOP_DATA_DIR_ENV]?.trim();

  if (configured) return configured;

  if (isDesktopEdition(env)) {
    throw new Error("GAUCHO_DATA_DIR é obrigatório na edição desktop.");
  }

  return path.join(process.cwd(), "data");
}

const DESKTOP_UNAVAILABLE_PREFIXES = [
  "/studio",
  "/soundcase",
  "/api/calendar",
  "/api/integrations/google",
] as const;

export function isDesktopUnavailablePath(pathname: string): boolean {
  return DESKTOP_UNAVAILABLE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isValidDesktopSession(
  token: string | undefined,
  expectedToken: string | undefined
): Promise<boolean> {
  if (!token || !expectedToken) return Promise.resolve(false);

  const encoder = new TextEncoder();
  return Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(token)),
    crypto.subtle.digest("SHA-256", encoder.encode(expectedToken)),
  ]).then(([tokenDigest, expectedDigest]) => {
    const actual = new Uint8Array(tokenDigest);
    const expected = new Uint8Array(expectedDigest);
    let difference = 0;

    for (let index = 0; index < actual.length; index += 1) {
      difference |= actual[index] ^ expected[index];
    }

    return difference === 0;
  });
}
