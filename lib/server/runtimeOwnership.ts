import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { constants, promises as fs } from "node:fs";
import path from "node:path";
import { studioServiceProperties, verifyStudioServiceOwner, type StudioServiceOwner } from "./studioOrphanUnits";

export interface RuntimeLease {
  readonly holderPids: number[];
  release(): Promise<void>;
}
type RuntimeState = { starting?: Promise<void>; lease?: RuntimeLease; studioOwner?: StudioServiceOwner; ready: boolean };
const globals = globalThis as typeof globalThis & { __gauchoRuntimeOwnership?: RuntimeState };
function state(): RuntimeState { return (globals.__gauchoRuntimeOwnership ??= { ready: false }); }

// Resolve também destinos ausentes, sem criar os arquivos de dados.
export async function canonicalResource(resource: string): Promise<string> {
  const absolute = path.resolve(resource);
  try { return await fs.realpath(absolute); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const parent = path.dirname(absolute);
    if (parent === absolute) throw error;
    return path.join(await canonicalResource(parent), path.basename(absolute));
  }
}

export async function runtimeLockPaths(cwd: string, env: Readonly<Record<string, string | undefined>>): Promise<string[]> {
  const directories = [path.join(cwd, "data"), path.resolve(cwd, env.SOUNDCASE_DATA_DIR?.trim() || "data/soundcase")];
  if (env.STUDIO_WORKSPACE_PASSWORD?.trim() && env.GAUCHO_ISOLATED_RUNTIME !== "true") directories.push("/root/studio-projects");
  const paths = await Promise.all(directories.map(async directory => path.join(await canonicalResource(directory), ".gaucho-runtime.lock")));
  if (env.MEMORY_V2_ENABLED === "true") paths.push(`${await canonicalResource(path.resolve(cwd, env.MEMORY_V2_DATABASE_PATH || "data/memory-v2.sqlite"))}.runtime.lock`);
  return [...new Set(paths)].sort();
}

async function closeHolder(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null || !child.pid) return;
  await new Promise<void>(resolve => {
    const timeout = setTimeout(() => { child.kill("SIGKILL"); }, 1_000);
    child.once("exit", () => { clearTimeout(timeout); resolve(); });
    child.stdin.end();
  });
}

/** Locks do kernel, sem PID file obsoleto e sem espera por outro servidor. */
export async function acquireRuntimeLease(paths: string[], onLost: () => void): Promise<RuntimeLease> {
  const holders: ChildProcessWithoutNullStreams[] = [];
  let releasing = false;
  let lost = false;
  try {
    for (const lockPath of [...new Set(paths)].sort()) {
      await fs.mkdir(path.dirname(lockPath), { recursive: true });
      const handle = await fs.open(lockPath, constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
      let child: ChildProcessWithoutNullStreams;
      try {
        if (!(await handle.stat()).isFile()) throw new Error("runtime_lock_invalid");
        // FD herdado evita reabrir um caminho trocado entre open e flock.
        child = spawn("/usr/bin/flock", ["--exclusive", "--nonblock", "--no-fork", "/proc/self/fd/3",
          process.execPath, "-e", 'process.stdout.write("locked\\n");process.stdin.resume();process.stdin.on("end",()=>process.exit(0));'],
        { stdio: ["pipe", "pipe", "pipe", handle.fd] }) as ChildProcessWithoutNullStreams;
      } catch (error) { await handle.close(); throw error; }
      holders.push(child);
      child.stdin.on("error", () => { /* A saída do holder é tratada abaixo. */ });
      child.stderr.resume();
      let acquired = false;
      child.on("exit", () => { if (acquired && !releasing) { lost = true; onLost(); } });
      try { await new Promise<void>((resolve, reject) => {
        let output = "";
        const timeout = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("runtime_lock_timeout")); }, 5_000);
        child.once("error", () => { clearTimeout(timeout); reject(new Error("runtime_lock_unavailable")); });
        child.once("exit", () => { clearTimeout(timeout); reject(new Error("runtime_resource_in_use")); });
        child.stdout.on("data", (data: Buffer) => {
          output += data.toString();
          if (output.includes("locked\n")) { acquired = true; clearTimeout(timeout); resolve(); }
        });
      }); } finally { await handle.close(); }
      if (lost) throw new Error("runtime_lock_lost");
    }
    return { holderPids: holders.map(child => child.pid!), async release() { releasing = true; await Promise.all(holders.map(closeHolder)); } };
  } catch (error) { releasing = true; await Promise.all(holders.map(closeHolder)); throw error; }
}

export async function initializeRuntimeOwnership(): Promise<void> {
  const current = state();
  if (current.starting) return current.starting;
  current.starting = (async () => {
    const env = process.env;
    // Confere identidade antes de reservar o workspace real.
    const studioOwner = env.STUDIO_WORKSPACE_PASSWORD?.trim() && env.GAUCHO_ISOLATED_RUNTIME !== "true"
      ? await verifyStudioServiceOwner(env) : undefined;
    const lease = await acquireRuntimeLease(await runtimeLockPaths(process.cwd(), env), () => {
      current.ready = false;
      console.error("[runtime] Exclusividade perdida; encerrando o servidor.");
      process.exit(1);
    });
    current.lease = lease;
    current.studioOwner = studioOwner;
    current.ready = true;
  })();
  try { await current.starting; } catch (error) { current.starting = undefined; throw error; }
}

export function studioRuntimeAvailable(): boolean {
  return process.env.GAUCHO_ISOLATED_RUNTIME !== "true" && state().ready && Boolean(state().studioOwner);
}

export function studioOwnerProperties(): string[] {
  const owner = state().studioOwner;
  if (!studioRuntimeAvailable() || !owner) throw new Error("studio_runtime_owner_unavailable");
  return studioServiceProperties(owner);
}
