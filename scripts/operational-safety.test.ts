import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

function createHarness() {
  const directory = mkdtempSync(join(tmpdir(), "gaucho-operational-safety-"));
  temporaryDirectories.push(directory);
  const binDirectory = join(directory, "bin");
  const liveDirectory = join(directory, "live-checkout");
  const callsPath = join(directory, "calls.log");
  const curlArgumentsPath = join(directory, "curl-arguments.log");
  const curlStdinPath = join(directory, "curl-stdin.log");
  mkdirSync(binDirectory);
  mkdirSync(liveDirectory);

  const executable = (name: string, contents: string) => {
    const path = join(binDirectory, name);
    writeFileSync(path, contents, "utf8");
    chmodSync(path, 0o755);
    return path;
  };

  const systemctl = executable(
    "systemctl",
    "#!/usr/bin/env bash\nprintf '%s\\n' \"$FAKE_LIVE_WORKDIR\"\n"
  );
  const tsc = executable(
    "tsc",
    "#!/usr/bin/env bash\nprintf 'tsc %s\\n' \"$*\" >> \"$FAKE_CALLS\"\nexit \"${FAKE_TSC_EXIT:-0}\"\n"
  );
  const npx = executable(
    "npx",
    "#!/usr/bin/env bash\nprintf 'npx %s\\n' \"$*\" >> \"$FAKE_CALLS\"\nexit \"${FAKE_NEXT_EXIT:-0}\"\n"
  );
  const npm = executable(
    "npm",
    "#!/usr/bin/env bash\nprintf 'npm %s|isolated=%s|host=%s|port=%s\\n' \"$*\" \"${GAUCHO_ISOLATED_RUNTIME:-}\" \"${NEXT_PUBLIC_APP_URL:-}\" \"${PORT:-}\" >> \"$FAKE_CALLS\"\nif [[ \"$1 $2\" == 'run build' ]]; then exit \"${FAKE_BUILD_EXIT:-0}\"; fi\nexit 0\n"
  );
  const ss = executable(
    "ss",
    "#!/usr/bin/env bash\nprintf 'ss %s\\n' \"$*\" >> \"$FAKE_CALLS\"\nif [[ \"${FAKE_SS_EXIT:-0}\" != '0' ]]; then exit \"$FAKE_SS_EXIT\"; fi\nif [[ \"${FAKE_PORT_OCCUPIED:-0}\" == '1' ]]; then printf 'LISTEN 0 511 127.0.0.1:3999 0.0.0.0:*\\n'; fi\n"
  );
  const curl = executable(
    "curl",
    "#!/usr/bin/env bash\nprintf '%s\\n' \"$@\" > \"$FAKE_CURL_ARGUMENTS\"\ncat > \"$FAKE_CURL_STDIN\"\nprintf 'ok'\n"
  );

  return { callsPath, curlArgumentsPath, curlStdinPath, curl, liveDirectory, npm, npx, ss, systemctl, tsc };
}

function runScript(script: string, scriptArguments: string[], env: Partial<NodeJS.ProcessEnv>) {
  const scriptEnvironment: NodeJS.ProcessEnv = {
    ...env,
    PATH: process.env.PATH ?? "",
    LANG: "C.UTF-8",
    NODE_ENV: env.NODE_ENV ?? "test",
  };

  return spawnSync("bash", [join(repository, "scripts", script), ...scriptArguments], {
    cwd: repository,
    encoding: "utf8",
    env: scriptEnvironment,
  });
}

describe("ferramentas operacionais", () => {
  it("recusa o checkout vivo antes de qualquer gate, inclusive com --skip-build", () => {
    const harness = createHarness();
    const result = runScript("pre-deploy.sh", ["--skip-build"], {
      FAKE_CALLS: harness.callsPath,
      FAKE_LIVE_WORKDIR: repository,
      GAUCHO_NPM_BIN: harness.npm,
      GAUCHO_NPX_BIN: harness.npx,
      GAUCHO_SYSTEMCTL_BIN: harness.systemctl,
      GAUCHO_TSC_BIN: harness.tsc,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Recusado");
    expect(() => readFileSync(harness.callsPath, "utf8")).toThrow();
  });

  it("propaga a falha do gate e não instala dependências nem remove .next", () => {
    const harness = createHarness();
    const result = runScript("pre-deploy.sh", ["--skip-build"], {
      FAKE_CALLS: harness.callsPath,
      FAKE_LIVE_WORKDIR: harness.liveDirectory,
      FAKE_TSC_EXIT: "23",
      GAUCHO_NPM_BIN: harness.npm,
      GAUCHO_NPX_BIN: harness.npx,
      GAUCHO_SYSTEMCTL_BIN: harness.systemctl,
      GAUCHO_TSC_BIN: harness.tsc,
    });

    expect(result.status).toBe(23);
    expect(readFileSync(harness.callsPath, "utf8")).toBe("npx --no-install next typegen\ntsc --noEmit\n");
    expect(readFileSync(join(repository, "scripts", "pre-deploy.sh"), "utf8")).not.toContain("npm install");
    expect(readFileSync(join(repository, "scripts", "pre-deploy.sh"), "utf8")).not.toContain("rm -rf .next");
  });

  it("mantém --skip-build explícito e não o apresenta como certificação", () => {
    const harness = createHarness();
    const result = runScript("pre-deploy.sh", ["--skip-build"], {
      FAKE_CALLS: harness.callsPath,
      FAKE_LIVE_WORKDIR: harness.liveDirectory,
      GAUCHO_NPM_BIN: harness.npm,
      GAUCHO_NPX_BIN: harness.npx,
      GAUCHO_SYSTEMCTL_BIN: harness.systemctl,
      GAUCHO_TSC_BIN: harness.tsc,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("não certifica entrega");
    expect(readFileSync(harness.callsPath, "utf8")).not.toContain("run build");
  });

  it("propaga a falha do typegen antes de executar o tsc", () => {
    const harness = createHarness();
    const result = runScript("pre-deploy.sh", ["--skip-build"], {
      FAKE_CALLS: harness.callsPath,
      FAKE_LIVE_WORKDIR: harness.liveDirectory,
      FAKE_NEXT_EXIT: "31",
      GAUCHO_NPM_BIN: harness.npm,
      GAUCHO_NPX_BIN: harness.npx,
      GAUCHO_SYSTEMCTL_BIN: harness.systemctl,
      GAUCHO_TSC_BIN: harness.tsc,
    });

    expect(result.status).toBe(31);
    expect(readFileSync(harness.callsPath, "utf8")).toBe("npx --no-install next typegen\n");
  });

  it("não inicia o QA se o build isolado falhar", () => {
    const harness = createHarness();
    const result = runScript("test-local.sh", ["--port", "3999"], {
      FAKE_BUILD_EXIT: "29",
      FAKE_CALLS: harness.callsPath,
      FAKE_LIVE_WORKDIR: harness.liveDirectory,
      GAUCHO_NPM_BIN: harness.npm,
      GAUCHO_SS_BIN: harness.ss,
      GAUCHO_SYSTEMCTL_BIN: harness.systemctl,
    });

    expect(result.status).toBe(29);
    const calls = readFileSync(harness.callsPath, "utf8");
    expect(calls).toContain("npm run build|isolated=true|host=http://127.0.0.1:3999/chat|port=3999");
    expect(calls).not.toContain("npm start");
  });

  it("recusa o checkout vivo antes de consultar a porta do QA", () => {
    const harness = createHarness();
    const result = runScript("test-local.sh", ["--port", "3999"], {
      FAKE_CALLS: harness.callsPath,
      FAKE_LIVE_WORKDIR: repository,
      GAUCHO_NPM_BIN: harness.npm,
      GAUCHO_SS_BIN: harness.ss,
      GAUCHO_SYSTEMCTL_BIN: harness.systemctl,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Recusado");
    expect(() => readFileSync(harness.callsPath, "utf8")).toThrow();
  });

  it("falha com a porta ocupada sem sinalizar o ocupante", () => {
    const harness = createHarness();
    const result = runScript("test-local.sh", ["--port", "3999"], {
      FAKE_CALLS: harness.callsPath,
      FAKE_LIVE_WORKDIR: harness.liveDirectory,
      FAKE_PORT_OCCUPIED: "1",
      GAUCHO_NPM_BIN: harness.npm,
      GAUCHO_SS_BIN: harness.ss,
      GAUCHO_SYSTEMCTL_BIN: harness.systemctl,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("nenhum processo foi sinalizado");
    expect(readFileSync(harness.callsPath, "utf8")).not.toContain("npm ");
  });

  it("falha fechada se não consegue consultar a porta", () => {
    const harness = createHarness();
    const result = runScript("test-local.sh", ["--port", "3999"], {
      FAKE_CALLS: harness.callsPath,
      FAKE_LIVE_WORKDIR: harness.liveDirectory,
      FAKE_SS_EXIT: "44",
      GAUCHO_NPM_BIN: harness.npm,
      GAUCHO_SS_BIN: harness.ss,
      GAUCHO_SYSTEMCTL_BIN: harness.systemctl,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Não foi possível verificar a porta loopback");
    expect(readFileSync(harness.callsPath, "utf8")).not.toContain("npm ");
  });

  it("normaliza a porta decimal antes de iniciar o QA", () => {
    const harness = createHarness();
    const result = runScript("test-local.sh", ["--port", "080"], {
      FAKE_CALLS: harness.callsPath,
      FAKE_LIVE_WORKDIR: harness.liveDirectory,
      GAUCHO_NPM_BIN: harness.npm,
      GAUCHO_SS_BIN: harness.ss,
      GAUCHO_SYSTEMCTL_BIN: harness.systemctl,
    });

    expect(result.status).toBe(0);
    expect(readFileSync(harness.callsPath, "utf8")).toContain(
      "npm start -- --hostname 127.0.0.1 --port 80|isolated=true|host=http://127.0.0.1:80/chat|port=80"
    );
  });

  it("inicia o QA somente em loopback, com flag isolada e porta explícita", () => {
    const harness = createHarness();
    const result = runScript("test-local.sh", ["--port", "3999"], {
      FAKE_CALLS: harness.callsPath,
      FAKE_LIVE_WORKDIR: harness.liveDirectory,
      GAUCHO_NPM_BIN: harness.npm,
      GAUCHO_SS_BIN: harness.ss,
      GAUCHO_SYSTEMCTL_BIN: harness.systemctl,
    });

    expect(result.status).toBe(0);
    expect(readFileSync(harness.callsPath, "utf8")).toContain(
      "npm start -- --hostname 127.0.0.1 --port 3999|isolated=true|host=http://127.0.0.1:3999/chat|port=3999"
    );
  });

  it("interrompe o Pulse sem token antes de chamar a rede", () => {
    const harness = createHarness();
    const result = runScript("run-pulse-due.sh", [], {
      FAKE_CURL_ARGUMENTS: harness.curlArgumentsPath,
      FAKE_CURL_STDIN: harness.curlStdinPath,
      GAUCHO_CURL_BIN: harness.curl,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("PULSE_RUNNER_TOKEN ausente");
    expect(() => readFileSync(harness.curlArgumentsPath, "utf8")).toThrow();
  });

  it("entrega o token sintético do Pulse só pelo stdin do curl", () => {
    const harness = createHarness();
    const token = "synthetic-pulse-token";
    const result = runScript("run-pulse-due.sh", [], {
      FAKE_CURL_ARGUMENTS: harness.curlArgumentsPath,
      FAKE_CURL_STDIN: harness.curlStdinPath,
      GAUCHO_CURL_BIN: harness.curl,
      PULSE_RUNNER_TOKEN: token,
      PULSE_RUNNER_URL: "http://127.0.0.1:3999/chat/api/pulse/run-due",
    });

    expect(result.status).toBe(0);
    expect(readFileSync(harness.curlArgumentsPath, "utf8")).not.toContain(token);
    expect(readFileSync(harness.curlArgumentsPath, "utf8")).toContain("@-");
    expect(readFileSync(harness.curlStdinPath, "utf8")).toBe(`Authorization: Bearer ${token}\n`);
  });

  it("mantém a unit sem pre-start que mata quem ocupa a porta", () => {
    const unit = readFileSync(join(repository, "systemd", "chatgpt.service"), "utf8");

    expect(unit).not.toContain("fuser -k");
    expect(unit).not.toContain("ExecStartPre=");
    expect(unit).toContain("ExecStart=/usr/bin/npm start");
  });
});
