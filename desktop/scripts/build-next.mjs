import { access, cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "../..");
const nextBinary = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
const standaloneDirectory = path.join(projectRoot, ".next", "standalone");
const desktopServerDirectory = path.join(projectRoot, "desktop", ".next");

function runNextBuild() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [nextBinary, "build"], {
      cwd: projectRoot,
      env: {
        ...process.env,
        GAUCHO_DESKTOP_BUILD: "true",
        NEXT_PUBLIC_BASE_PATH: "",
      },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`next build desktop terminou com exit ${code ?? "desconhecido"}.`));
    });
  });
}

async function copyRuntime() {
  await access(standaloneDirectory);
  await rm(desktopServerDirectory, { recursive: true, force: true });
  await cp(standaloneDirectory, desktopServerDirectory, { recursive: true });

  await mkdir(path.join(desktopServerDirectory, ".next"), { recursive: true });
  await cp(path.join(projectRoot, ".next", "static"), path.join(desktopServerDirectory, ".next", "static"), {
    recursive: true,
  });

  try {
    await cp(path.join(projectRoot, "public"), path.join(desktopServerDirectory, "public"), {
      recursive: true,
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
}

await runNextBuild();
await copyRuntime();
