// Smoke local: processos/units próprios, sem arquivos de dados ou serviços reais.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = await mkdtemp(path.join(os.tmpdir(), "gaucho-owner-smoke-"));
const moduleUrl = pathToFileURL(path.join(repo, "lib/server/runtimeOwnership.ts")).href;
const ownerUrl = pathToFileURL(path.join(repo, "lib/server/studioOrphanUnits.ts")).href;
const loader = path.join(repo, "node_modules/tsx/dist/loader.mjs");
const children = [];
const units = [];
const checks = [];
const env = { PATH: "/usr/bin:/bin", NODE_ENV: "test" };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function command(command, args, options = {}) {
  const child = spawn(command, args, { cwd: repo, env, stdio: ["ignore", "pipe", "pipe"], ...options });
  let output = ""; child.stdout?.on("data", data => { output += data; }); child.stderr?.on("data", data => { output += data; });
  const timer = setTimeout(() => child.kill("SIGKILL"), 15_000);
  try { const [code] = await once(child, "exit"); return { code, output }; } finally { clearTimeout(timer); }
}
async function waitFor(check) {
  for (let i = 0; i < 100; i++) { if (await check()) return; await delay(50); }
  throw new Error("timeout aguardando fixture");
}
function ownerProcess(lock) {
  const script = `import {acquireRuntimeLease} from ${JSON.stringify(moduleUrl)}; const lease=await acquireRuntimeLease([${JSON.stringify(lock)}],()=>process.exit(17)); console.log(JSON.stringify(lease.holderPids));`;
  const child = spawn(process.execPath, ["--import", loader, "--input-type=module", "-e", script], { cwd: repo, env, stdio: ["ignore", "pipe", "pipe"] });
  children.push(child); return child;
}
async function firstLine(child) {
  let output = "";
  const timer = setTimeout(() => child.kill("SIGKILL"), 10_000);
  try {
    for await (const data of child.stdout) { output += data; if (output.includes("\n")) return JSON.parse(output.trim()); }
    throw new Error("fixture terminou antes de adquirir lock");
  } finally { clearTimeout(timer); }
}
try {
  const lock = path.join(root, "runtime.lock");
  const first = ownerProcess(lock); await firstLine(first);
  const second = ownerProcess(lock); second.stderr.resume();
  const [conflictExit] = await once(second, "exit"); assert.notEqual(conflictExit, 0); checks.push("segundo processo recusado");
  const firstExit = once(first, "exit"); first.kill("SIGKILL"); await firstExit;
  await delay(100);
  const third = ownerProcess(lock); const holders = await firstLine(third); checks.push("queda do proprietário libera lock");
  const thirdExit = once(third, "exit"); process.kill(holders[0], "SIGKILL");
  assert.equal((await thirdExit)[0], 17); checks.push("perda do holder encerra proprietário");

  if (process.argv.includes("--systemd")) {
    const suffix = `${process.pid}-${Date.now()}`;
    const parent = `gaucho-review-parent-${suffix}.service`;
    const child = `gaucho-review-child-${suffix}.service`;
    units.push(parent, child);
    const ready = path.join(root, "owner.json"); const fixture = path.join(root, "owner.mjs");
    await writeFile(fixture, `import {verifyStudioServiceOwner,studioServiceProperties} from ${JSON.stringify(ownerUrl)};
import {execFileSync} from 'node:child_process'; import {writeFileSync} from 'node:fs';
const owner=await verifyStudioServiceOwner(process.env);
execFileSync('systemd-run',['--unit=${child}','--collect',...studioServiceProperties(owner),'/usr/bin/sleep','60']);
writeFileSync(${JSON.stringify(ready)},JSON.stringify(owner)); setInterval(()=>{},1000);`);
    const launched = await command("systemd-run", [`--unit=${parent}`, "--collect", "--property=RuntimeMaxSec=60", `--setenv=GAUCHO_SERVICE_UNIT=${parent}`, process.execPath, "--import", loader, fixture]);
    assert.equal(launched.code, 0, launched.output);
    await waitFor(async () => { try { return JSON.parse(await readFile(ready, "utf8")).unit === parent; } catch { return false; } });
    assert.equal((await command("systemctl", ["is-active", child])).output.trim(), "active");
    checks.push("identidade systemd e cgroup comprovada em unit própria");
    const stopped = await command("systemctl", ["stop", parent]); assert.equal(stopped.code, 0, stopped.output);
    await waitFor(async () => (await command("systemctl", ["is-active", child])).code !== 0);
    checks.push("sessão sintética encerra com serviço proprietário");
  }
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
} finally {
  for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  for (const unit of units) await command("systemctl", ["stop", unit]);
  await rm(root, { recursive: true, force: true });
}
