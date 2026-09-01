import "server-only";

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { migrateMemorySchema } from "./schema";

export interface MemoryDatabase {
  raw: Database.Database;
  close(): void;
}

export interface OpenMemoryDatabaseOptions {
  path?: string;
}

export function openMemoryDatabase(
  options: OpenMemoryDatabaseOptions = {}
): MemoryDatabase {
  const databasePath = options.path ?? join(process.cwd(), "data", "memory-v2.sqlite");
  mkdirSync(dirname(databasePath), { recursive: true });

  const raw = new Database(databasePath);
  raw.pragma("journal_mode = WAL");
  raw.pragma("foreign_keys = ON");
  raw.pragma("busy_timeout = 5000");
  migrateMemorySchema(raw);

  return {
    raw,
    close: () => raw.close(),
  };
}

export function withMemoryTransaction<T>(
  database: MemoryDatabase,
  work: () => T
): T {
  return database.raw.transaction(work)();
}
