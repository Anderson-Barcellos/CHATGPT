import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  openMemoryDatabase,
  withMemoryTransaction,
  type MemoryDatabase,
} from "./database";

vi.mock("server-only", () => ({}));

const tempDirs: string[] = [];
const databases: MemoryDatabase[] = [];

function openTestDatabase(): MemoryDatabase {
  const directory = mkdtempSync(join(tmpdir(), "gaucho-memory-v2-"));
  tempDirs.push(directory);
  const database = openMemoryDatabase({ path: join(directory, "memory.sqlite") });
  databases.push(database);
  return database;
}

afterEach(() => {
  while (databases.length > 0) databases.pop()?.close();
  while (tempDirs.length > 0) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe("memory v2 database", () => {
  it("opens with durable SQLite settings and the complete canonical schema", () => {
    const database = openTestDatabase();
    const tableNames = database.raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(database.raw.pragma("journal_mode", { simple: true })).toBe("wal");
    expect(database.raw.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(tableNames).toEqual(
      expect.arrayContaining([
        "conversations",
        "conversation_messages",
        "conversation_attachments",
        "memory_topics",
        "memory_facts",
        "memory_fact_versions",
        "memory_evidence",
        "memory_conflicts",
        "memory_operations",
        "memory_audit_log",
        "memory_jobs",
        "schema_migrations",
      ])
    );
  });

  it("cascades conversation content without deleting unrelated conversations", () => {
    const { raw } = openTestDatabase();
    const now = "2026-08-31T12:00:00.000Z";
    raw.prepare(
      "INSERT INTO conversations (id, title, lifecycle, created_at, updated_at) VALUES (?, ?, 'active', ?, ?)"
    ).run("conv-delete", "Apagar", now, now);
    raw.prepare(
      "INSERT INTO conversations (id, title, lifecycle, created_at, updated_at) VALUES (?, ?, 'active', ?, ?)"
    ).run("conv-keep", "Manter", now, now);
    raw.prepare(
      "INSERT INTO conversation_messages (id, conversation_id, role, content, timestamp, ordinal) VALUES (?, ?, 'user', ?, ?, 0)"
    ).run("msg-delete", "conv-delete", "conteúdo", now);
    raw.prepare(
      "INSERT INTO conversation_attachments (id, message_id, name, media_type) VALUES (?, ?, ?, ?)"
    ).run("attachment-delete", "msg-delete", "nota.txt", "text/plain");

    raw.prepare("DELETE FROM conversations WHERE id = ?").run("conv-delete");

    expect(
      raw.prepare("SELECT COUNT(*) AS count FROM conversation_messages").get()
    ).toEqual({ count: 0 });
    expect(
      raw.prepare("SELECT COUNT(*) AS count FROM conversation_attachments").get()
    ).toEqual({ count: 0 });
    expect(raw.prepare("SELECT id FROM conversations").all()).toEqual([
      { id: "conv-keep" },
    ]);
  });

  it("rejects two current versions for the same fact", () => {
    const { raw } = openTestDatabase();
    const now = "2026-08-31T12:00:00.000Z";
    raw.prepare(
      "INSERT INTO memory_topics (id, slug, title, state, aliases_json, created_at, updated_at) VALUES (?, ?, ?, 'active', '[]', ?, ?)"
    ).run("topic-1", "preferencias", "Preferências", now, now);
    raw.prepare(
      "INSERT INTO memory_facts (id, topic_id, fact_type, sensitivity, confidence, state, is_core, created_at, updated_at) VALUES (?, ?, ?, 'standard', 0.9, 'current', 0, ?, ?)"
    ).run("fact-1", "topic-1", "preference", now, now);
    const insertVersion = raw.prepare(
      "INSERT INTO memory_fact_versions (id, fact_id, content, normalized_content, state, confidence, author, created_at) VALUES (?, ?, ?, ?, 'current', 0.9, 'system', ?)"
    );
    insertVersion.run("version-1", "fact-1", "Prefere respostas curtas", "prefere respostas curtas", now);

    expect(() =>
      insertVersion.run(
        "version-2",
        "fact-1",
        "Prefere respostas longas",
        "prefere respostas longas",
        now
      )
    ).toThrow();
  });

  it("rolls back every write when a transaction fails", () => {
    const database = openTestDatabase();
    const now = "2026-08-31T12:00:00.000Z";

    expect(() =>
      withMemoryTransaction(database, () => {
        database.raw
          .prepare(
            "INSERT INTO conversations (id, title, lifecycle, created_at, updated_at) VALUES (?, ?, 'active', ?, ?)"
          )
          .run("conv-rollback", "Rollback", now, now);
        throw new Error("synthetic failure");
      })
    ).toThrow("synthetic failure");
    expect(
      database.raw.prepare("SELECT COUNT(*) AS count FROM conversations").get()
    ).toEqual({ count: 0 });
  });

  it("reopens an existing database without reapplying migrations", () => {
    const directory = mkdtempSync(join(tmpdir(), "gaucho-memory-v2-reopen-"));
    tempDirs.push(directory);
    const path = join(directory, "memory.sqlite");
    openMemoryDatabase({ path }).close();

    const reopened = openMemoryDatabase({ path });
    databases.push(reopened);

    expect(
      reopened.raw.prepare("SELECT version FROM schema_migrations ORDER BY version").all()
    ).toEqual([{ version: 1 }]);
  });
});
