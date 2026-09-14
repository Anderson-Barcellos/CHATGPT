import { execFile } from "node:child_process";

/**
 * Units transientes do Studio (runner, terminal PTY e kernel do notebook).
 * Um restart do chatgpt.service não as derruba: ficavam órfãs até o
 * RuntimeMaxSec de 8 h, segurando CPU, memória e o lock de "1 sessão" (B5).
 */
export const STUDIO_TRANSIENT_UNIT_PATTERNS = [
  "gaucho-studio-run-*.service",
  "gaucho-studio-term-*.service",
  "gaucho-studio-kernel-*.service",
] as const;

export type SystemctlExec = (
  command: string,
  args: string[]
) => Promise<{ stdout: string; stderr: string }>;

function defaultExec(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 15_000 }, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve({ stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

/** Para e limpa as units órfãs; nunca lança (o boot do app não depende disso). */
export async function stopOrphanedStudioUnits(execImpl: SystemctlExec = defaultExec): Promise<void> {
  const patterns = [...STUDIO_TRANSIENT_UNIT_PATTERNS];
  for (const verb of ["stop", "reset-failed"] as const) {
    try {
      await execImpl("systemctl", [verb, ...patterns]);
    } catch (error) {
      console.warn(`[studio] systemctl ${verb} das units órfãs falhou:`, error);
    }
  }
}
