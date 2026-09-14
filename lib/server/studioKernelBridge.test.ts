import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const VENV_PYTHON = "/opt/studio-venv/bin/python";
const TEST_FILE = path.join(process.cwd(), "lib/server/studio_kernel_bridge_test.py");

async function hasVenvPython(): Promise<boolean> {
  try {
    await access(VENV_PYTHON);
    return true;
  } catch {
    return false;
  }
}

describe("studio-kernel-bridge.py", () => {
  it("passes its Python unit tests (input() pendente + Interromper, stdin coalescido)", async () => {
    if (!(await hasVenvPython())) {
      console.warn("[studioKernelBridge.test] venv do Studio ausente; teste pulado.");
      return;
    }
    const result = await new Promise<{ code: number | null; output: string }>((resolve) => {
      execFile(VENV_PYTHON, ["-m", "unittest", "-v", TEST_FILE], { timeout: 30_000 }, (error, stdout, stderr) => {
        resolve({ code: error ? (error as { code?: number | null }).code ?? 1 : 0, output: `${stdout}\n${stderr}` });
      });
    });
    expect(result.output, result.output).toContain("OK");
    expect(result.code).toBe(0);
  }, 40_000);
});
