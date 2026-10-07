import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repository = process.cwd();
const temporaryDirectories: string[] = [];

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    rmSync(temporaryDirectories.pop()!, { recursive: true, force: true });
  }
});

function writeBuild(directory: string, buildId: string, chunk: string) {
  mkdirSync(join(directory, ".next", "static", "chunks"), { recursive: true });
  writeFileSync(join(directory, ".next", "BUILD_ID"), buildId, "utf8");
  writeFileSync(join(directory, ".next", "static", "chunks", chunk), "//", "utf8");
}

function createDeployHarness() {
  const directory = mkdtempSync(join(tmpdir(), "gaucho-deploy-"));
  temporaryDirectories.push(directory);
  const binDirectory = join(directory, "bin");
  const liveDirectory = join(directory, "live-checkout");
  const buildDirectory = join(directory, "prebuilt");
  const deployRoot = join(directory, "deploys");
  const callsPath = join(directory, "calls.log");
  mkdirSync(binDirectory);
  mkdirSync(liveDirectory);
  mkdirSync(buildDirectory);

  writeBuild(liveDirectory, "old-build", "old.js");
  writeBuild(buildDirectory, "new-build", "new.js");

  const executable = (name: string, contents: string) => {
    const path = join(binDirectory, name);
    writeFileSync(path, contents, "utf8");
    chmodSync(path, 0o755);
    return path;
  };

  const systemctl = executable(
    "systemctl",
    [
      "#!/usr/bin/env bash",
      "if [[ \"$1\" == show ]]; then printf '%s\\n' \"$FAKE_LIVE_WORKDIR\"; exit 0; fi",
      "printf 'systemctl %s\\n' \"$*\" >> \"$FAKE_CALLS\"",
      "",
    ].join("\n")
  );
  const curl = executable(
    "curl",
    [
      "#!/usr/bin/env bash",
      "url=\"${@: -1}\"",
      "printf 'curl %s\\n' \"$url\" >> \"$FAKE_CALLS\"",
      "if [[ \"$url\" == *127.0.0.1* ]]; then printf '%s' \"${FAKE_HEALTH_LOCAL:-200}\"; else printf '%s' \"${FAKE_HEALTH_PUBLIC:-200}\"; fi",
      "",
    ].join("\n")
  );
  const npm = executable(
    "npm",
    [
      "#!/usr/bin/env bash",
      "printf 'npm %s|base=%s|cwd=%s\\n' \"$*\" \"${NEXT_PUBLIC_BASE_PATH:-}\" \"$PWD\" >> \"$FAKE_CALLS\"",
      "if [[ \"$1 $2\" == 'run build' ]]; then",
      "  mkdir -p .next/static/chunks && printf 'gated-build' > .next/BUILD_ID && printf '//' > .next/static/chunks/gated.js",
      "fi",
      "",
    ].join("\n")
  );
  const npx = executable(
    "npx",
    "#!/usr/bin/env bash\nprintf 'npx %s\\n' \"$*\" >> \"$FAKE_CALLS\"\n"
  );
  const tsc = executable(
    "tsc",
    "#!/usr/bin/env bash\nprintf 'tsc %s\\n' \"$*\" >> \"$FAKE_CALLS\"\nexit \"${FAKE_TSC_EXIT:-0}\"\n"
  );

  const env = {
    FAKE_CALLS: callsPath,
    FAKE_LIVE_WORKDIR: liveDirectory,
    GAUCHO_CURL_BIN: curl,
    GAUCHO_DEPLOY_ROOT: deployRoot,
    GAUCHO_HEALTH_ATTEMPTS: "2",
    GAUCHO_HEALTH_INTERVAL: "0",
    GAUCHO_NPM_BIN: npm,
    GAUCHO_NPX_BIN: npx,
    GAUCHO_SYSTEMCTL_BIN: systemctl,
    GAUCHO_TSC_BIN: tsc,
  };

  const calls = () => (existsSync(callsPath) ? readFileSync(callsPath, "utf8") : "");
  const liveBuildId = () => readFileSync(join(liveDirectory, ".next", "BUILD_ID"), "utf8");
  const backups = () => (existsSync(deployRoot) ? readdirSync(deployRoot) : []);

  return { backups, buildDirectory, calls, deployRoot, env, liveBuildId, liveDirectory };
}

function runDeploy(scriptArguments: string[], env: Partial<NodeJS.ProcessEnv>) {
  return spawnSync("bash", [join(repository, "scripts", "deploy.sh"), ...scriptArguments], {
    cwd: repository,
    encoding: "utf8",
    env: { ...env, PATH: process.env.PATH ?? "", LANG: "C.UTF-8", NODE_ENV: "test" },
  });
}

describe("deploy.sh", () => {
  it("instala a build pronta com backup, mantém os assets antigos, reinicia e confere os health", () => {
    const harness = createDeployHarness();
    const result = runDeploy(["--from", harness.buildDirectory], harness.env);

    expect(result.status, result.stderr).toBe(0);
    expect(harness.liveBuildId()).toBe("new-build");
    expect(existsSync(join(harness.liveDirectory, ".next", "static", "chunks", "new.js"))).toBe(true);
    expect(existsSync(join(harness.liveDirectory, ".next", "static", "chunks", "old.js"))).toBe(true);

    const [run] = harness.backups();
    expect(readFileSync(join(harness.deployRoot, run, "next-before", "BUILD_ID"), "utf8")).toBe("old-build");
    expect(existsSync(join(harness.buildDirectory, ".next", "BUILD_ID"))).toBe(true);

    const calls = harness.calls();
    expect(calls.match(/systemctl restart chatgpt\.service/g)).toHaveLength(1);
    expect(calls).toContain("curl http://127.0.0.1:3040/chat/api/health");
    expect(calls).toContain("curl https://ultrassom.ai/chat/api/health");
    expect(result.stdout).toContain("new-build");
  });

  it("restaura a build anterior se o health local falhar", () => {
    const harness = createDeployHarness();
    const result = runDeploy(["--from", harness.buildDirectory], {
      ...harness.env,
      FAKE_HEALTH_LOCAL: "502",
    });

    expect(result.status).not.toBe(0);
    expect(harness.liveBuildId()).toBe("old-build");
    expect(harness.calls().match(/systemctl restart chatgpt\.service/g)).toHaveLength(2);
    expect(result.stderr).toContain("restaurada");
  });

  it("mantém a build nova e avisa quando só o health público falha", () => {
    const harness = createDeployHarness();
    const result = runDeploy(["--from", harness.buildDirectory], {
      ...harness.env,
      FAKE_HEALTH_PUBLIC: "503",
    });

    expect(result.status).not.toBe(0);
    expect(harness.liveBuildId()).toBe("new-build");
    expect(harness.calls().match(/systemctl restart chatgpt\.service/g)).toHaveLength(1);
    expect(result.stderr).toContain("público");
  });

  it("recusa build sem BUILD_ID antes de tocar produção", () => {
    const harness = createDeployHarness();
    rmSync(join(harness.buildDirectory, ".next"), { recursive: true });
    const result = runDeploy(["--from", harness.buildDirectory], harness.env);

    expect(result.status).not.toBe(0);
    expect(harness.liveBuildId()).toBe("old-build");
    expect(harness.calls()).not.toContain("restart");
  });

  it("recusa usar o próprio checkout vivo como origem da build", () => {
    const harness = createDeployHarness();
    const result = runDeploy(["--from", harness.liveDirectory], harness.env);

    expect(result.status).not.toBe(0);
    expect(harness.liveBuildId()).toBe("old-build");
    expect(harness.calls()).not.toContain("restart");
  });

  describe("sem --from", () => {
    function prepareLiveSources(liveDirectory: string) {
      writeFileSync(join(liveDirectory, "package.json"), "{}", "utf8");
      mkdirSync(join(liveDirectory, "node_modules", "pkg"), { recursive: true });
      writeFileSync(join(liveDirectory, "node_modules", "pkg", "index.js"), "//", "utf8");
      mkdirSync(join(liveDirectory, "scripts", "lib"), { recursive: true });
      mkdirSync(join(liveDirectory, "data"));
      writeFileSync(join(liveDirectory, "data", "private.json"), "{}", "utf8");
      mkdirSync(join(liveDirectory, "lib", "data"), { recursive: true });
      writeFileSync(join(liveDirectory, "lib", "data", "source.ts"), "export {};", "utf8");
      writeFileSync(join(liveDirectory, ".env.production"), "SECRET=1", "utf8");
      for (const file of ["pre-deploy.sh", "lib/runtime-safety.sh"]) {
        copyFileSync(join(repository, "scripts", file), join(liveDirectory, "scripts", file));
      }
    }

    it("roda os gates numa cópia isolada, builda com /chat e só então instala", () => {
      const harness = createDeployHarness();
      prepareLiveSources(harness.liveDirectory);
      const result = runDeploy([], harness.env);

      expect(result.status, result.stderr).toBe(0);
      expect(harness.liveBuildId()).toBe("gated-build");

      const calls = harness.calls();
      const [run] = harness.backups();
      const isolated = join(harness.deployRoot, run, "build");
      expect(calls).toContain("npx --no-install next typegen");
      expect(calls).toContain("tsc --noEmit");
      expect(calls).toContain(`npm test|base=|cwd=${isolated}`);
      expect(calls).toContain(`npm run build|base=/chat|cwd=${isolated}`);
      expect(calls.indexOf("npm run build")).toBeLessThan(calls.indexOf("systemctl restart"));
      expect(existsSync(join(isolated, "data"))).toBe(false);
      expect(existsSync(join(isolated, ".env.production"))).toBe(false);
      expect(existsSync(join(isolated, "lib", "data", "source.ts"))).toBe(true);
      expect(existsSync(join(isolated, "node_modules", "pkg", "index.js"))).toBe(true);
    });

    it("não instala nem reinicia se um gate falhar", () => {
      const harness = createDeployHarness();
      prepareLiveSources(harness.liveDirectory);
      const result = runDeploy([], { ...harness.env, FAKE_TSC_EXIT: "3" });

      expect(result.status).not.toBe(0);
      expect(harness.liveBuildId()).toBe("old-build");
      expect(harness.calls()).not.toContain("npm run build");
      expect(harness.calls()).not.toContain("restart");
    });
  });
});
