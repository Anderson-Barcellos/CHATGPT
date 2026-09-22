import { afterEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { acquireRuntimeLease, canonicalResource, runtimeLockPaths, studioOwnerProperties, studioRuntimeAvailable, type RuntimeLease } from "./runtimeOwnership";

const roots: string[] = [];
const leases: RuntimeLease[] = [];
async function fixture() { const root = await fs.mkdtemp(path.join(os.tmpdir(), "gaucho-lock-test-")); roots.push(root); return root; }
afterEach(async () => {
  await Promise.all(leases.splice(0).map(lease => lease.release()));
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
  vi.unstubAllEnvs();
});

describe("exclusividade do runtime", () => {
  it("recusa segundo proprietário e permite reaquisição após saída", async () => {
    const lock = path.join(await fixture(), "runtime.lock");
    const first = await acquireRuntimeLease([lock], vi.fn()); leases.push(first);
    await expect(acquireRuntimeLease([lock], vi.fn())).rejects.toThrow("runtime_resource_in_use");
    await first.release();
    leases.push(await acquireRuntimeLease([lock], vi.fn()));
  });
  it("libera aquisições parciais quando encontra conflito", async () => {
    const root = await fixture(); const a = path.join(root, "a.lock"); const b = path.join(root, "b.lock");
    leases.push(await acquireRuntimeLease([b], vi.fn()));
    await expect(acquireRuntimeLease([a, b], vi.fn())).rejects.toThrow("runtime_resource_in_use");
    leases.push(await acquireRuntimeLease([a], vi.fn()));
  });
  it("notifica perda inesperada e o kernel libera a trava", async () => {
    const lock = path.join(await fixture(), "runtime.lock"); const lost = vi.fn();
    const lease = await acquireRuntimeLease([lock], lost); leases.push(lease);
    process.kill(lease.holderPids[0], "SIGKILL");
    await vi.waitFor(() => expect(lost).toHaveBeenCalledOnce());
    leases.push(await acquireRuntimeLease([lock], vi.fn()));
  });
  it("resolve symlinks, inclusive caminhos filhos ainda ausentes", async () => {
    const root = await fixture(); const target = path.join(root, "real"); const alias = path.join(root, "alias");
    await fs.mkdir(target); await fs.symlink(target, alias);
    expect(await canonicalResource(path.join(alias, "data"))).toBe(path.join(target, "data"));
    expect(await runtimeLockPaths(alias, {})).toEqual(await runtimeLockPaths(target, {}));
  });
  it("locks incluem recursos externos compartilhados; QA não pula dados", async () => {
    const root = await fixture();
    const env = { SOUNDCASE_DATA_DIR: path.join(root, "audio"), MEMORY_V2_ENABLED: "true", MEMORY_V2_DATABASE_PATH: path.join(root, "external.sqlite"), GAUCHO_ISOLATED_RUNTIME: "true", STUDIO_WORKSPACE_PASSWORD: "synthetic" };
    const locks = await runtimeLockPaths(root, env);
    expect(locks).toContain(path.join(root, "audio/.gaucho-runtime.lock"));
    expect(locks).toContain(path.join(root, "external.sqlite.runtime.lock"));
    expect(locks).toContain(path.join(root, "data/.gaucho-runtime.lock"));
    expect(locks.some(lock => lock.includes("studio-projects"))).toBe(false);
    const main = await runtimeLockPaths(root, { ...env, GAUCHO_ISOLATED_RUNTIME: "false" });
    expect(main).toContain("/root/studio-projects/.gaucho-runtime.lock");
  });
  it("raízes independentes não se bloqueiam", async () => {
    for (const root of [await fixture(), await fixture()]) leases.push(await acquireRuntimeLease(await runtimeLockPaths(root, {}), vi.fn()));
  });
  it("Studio não executa sem propriedade e é indisponível em QA", () => {
    expect(studioRuntimeAvailable()).toBe(false);
    expect(() => studioOwnerProperties()).toThrow("studio_runtime_owner_unavailable");
    vi.stubEnv("GAUCHO_ISOLATED_RUNTIME", "true");
    expect(studioRuntimeAvailable()).toBe(false);
  });
});
