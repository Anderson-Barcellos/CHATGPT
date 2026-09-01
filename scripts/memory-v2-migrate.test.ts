import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

function runCli(args: string[]) {
  const tsxCli = join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
  return spawnSync(
    process.execPath,
    [tsxCli, join(process.cwd(), "scripts", "memory-v2-migrate.ts"), ...args],
    { cwd: process.cwd(), encoding: "utf8" }
  );
}

describe("memory v2 migration CLI", () => {
  it("defaults to a content-safe dry run without creating the target database", () => {
    const directory = mkdtempSync(join(tmpdir(), "gaucho-memory-cli-"));
    tempDirs.push(directory);
    const databasePath = join(directory, "memory.sqlite");
    const sourcePath = join(process.cwd(), "test", "fixtures", "memory-v2");

    const result = runCli(["--source", sourcePath, "--database", databasePath]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(existsSync(databasePath)).toBe(false);
    expect(JSON.parse(result.stdout)).toMatchObject({
      dryRun: true,
      report: { conversations: 1, messages: 2, attachments: 1, memories: 2, suggestions: 1 },
      reconciliation: { mismatches: [] },
    });
    expect(result.stdout).not.toContain("Meu projeto favorito");
  });

  it("creates only the explicit target when apply is requested", () => {
    const directory = mkdtempSync(join(tmpdir(), "gaucho-memory-cli-apply-"));
    tempDirs.push(directory);
    const databasePath = join(directory, "memory.sqlite");
    const sourcePath = join(process.cwd(), "test", "fixtures", "memory-v2");

    const result = runCli([
      "--source",
      sourcePath,
      "--database",
      databasePath,
      "--apply",
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(existsSync(databasePath)).toBe(true);
    expect(JSON.parse(result.stdout).dryRun).toBe(false);
  });

  it("refuses to create the target database inside the legacy source", () => {
    const directory = mkdtempSync(join(tmpdir(), "gaucho-memory-cli-unsafe-"));
    tempDirs.push(directory);
    const sourcePath = join(directory, "legacy");
    mkdirSync(sourcePath);
    for (const file of [
      "conversations.json",
      "memories.json",
      "memory-suggestions.json",
    ]) {
      copyFileSync(join(process.cwd(), "test", "fixtures", "memory-v2", file), join(sourcePath, file));
    }
    const databasePath = join(sourcePath, "memory.sqlite");

    const result = runCli([
      "--source",
      sourcePath,
      "--database",
      databasePath,
      "--apply",
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "Target database must be outside the legacy source directory"
    );
    expect(existsSync(databasePath)).toBe(false);
  });
});
