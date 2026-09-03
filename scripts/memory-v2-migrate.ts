import { readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { openMemoryDatabase } from "../lib/server/memory-v2/database";
import {
  importLegacySnapshot,
  reconcileLegacySnapshot,
  type LegacySnapshot,
} from "../lib/server/memory-v2/importLegacy";

interface CliOptions {
  source: string;
  database: string;
  apply: boolean;
}

function parseArgs(args: string[]): CliOptions {
  let source = "";
  let database = "";
  let apply = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--apply") {
      apply = true;
      continue;
    }
    if (argument === "--source" || argument === "--database") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${argument} requires a path`);
      }
      if (argument === "--source") source = value;
      else database = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!source) throw new Error("--source is required");
  if (!database) throw new Error("--database is required");
  return { source: resolve(source), database: resolve(database), apply };
}

function readArray(path: string): unknown[] {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!Array.isArray(parsed)) throw new Error(`Legacy file must contain an array: ${path}`);
  return parsed;
}

function readSnapshot(source: string): LegacySnapshot {
  return {
    conversations: readArray(join(source, "conversations.json")),
    memories: readArray(join(source, "memories.json")),
    suggestions: readArray(join(source, "memory-suggestions.json")),
  };
}

function assertSafeTarget(source: string, database: string): void {
  const fromSource = relative(source, database);
  if (fromSource === "" || (!fromSource.startsWith("..") && !isAbsolute(fromSource))) {
    throw new Error("Target database must be outside the legacy source directory");
  }
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  assertSafeTarget(options.source, options.database);
  const snapshot = readSnapshot(options.source);
  const database = openMemoryDatabase({
    path: options.apply ? options.database : ":memory:",
  });

  try {
    const report = importLegacySnapshot(snapshot, database);
    const reconciliation = reconcileLegacySnapshot(snapshot, database);
    process.stdout.write(
      `${JSON.stringify({ dryRun: !options.apply, report, reconciliation })}\n`
    );
  } finally {
    database.close();
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown migration error";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
