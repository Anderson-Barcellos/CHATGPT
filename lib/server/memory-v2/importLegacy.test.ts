import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openMemoryDatabase, type MemoryDatabase } from "./database";
import {
  importLegacySnapshot,
  reconcileLegacySnapshot,
  type LegacySnapshot,
} from "./importLegacy";
import { getConversation } from "./conversationRepository";
import { deserializeConversation } from "@/lib/storage/serializers";
import type { SerializedConversation } from "@/types";

vi.mock("server-only", () => ({}));

const fixtureDir = join(process.cwd(), "test", "fixtures", "memory-v2");
const tempDirs: string[] = [];
const databases: MemoryDatabase[] = [];

function readFixture(name: string): unknown[] {
  return JSON.parse(readFileSync(join(fixtureDir, name), "utf8")) as unknown[];
}

function legacyFixture(): LegacySnapshot {
  return {
    conversations: readFixture("conversations.json"),
    memories: readFixture("memories.json"),
    suggestions: readFixture("memory-suggestions.json"),
  };
}

function openTestDatabase(): MemoryDatabase {
  const directory = mkdtempSync(join(tmpdir(), "gaucho-memory-import-"));
  tempDirs.push(directory);
  const database = openMemoryDatabase({ path: join(directory, "memory.sqlite") });
  databases.push(database);
  return database;
}

afterEach(() => {
  while (databases.length > 0) databases.pop()?.close();
  while (tempDirs.length > 0) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe("legacy memory importer", () => {
  it("preserves canonical IDs, timestamps, attachments, memories, and suggestions", () => {
    const database = openTestDatabase();
    const fixture = legacyFixture();

    const report = importLegacySnapshot(fixture, database);

    expect(report).toMatchObject({
      conversations: 1,
      messages: 2,
      attachments: 1,
      memories: 2,
      suggestions: 1,
      skipped: 0,
    });
    expect(database.raw.prepare("SELECT id, created_at, updated_at FROM conversations").get()).toEqual({
      id: "conv-legacy-1",
      created_at: "2026-08-20T12:00:00.000Z",
      updated_at: "2026-08-20T12:00:01.000Z",
    });
    expect(database.raw.prepare("SELECT id, message_id FROM conversation_attachments").get()).toEqual({
      id: "attachment-legacy-1",
      message_id: "msg-legacy-1",
    });
    expect(getConversation(database, "conv-legacy-1")).toEqual({
      ...deserializeConversation(
        fixture.conversations[0] as SerializedConversation
      ),
      lifecycle: "active",
    });
    expect(database.raw.prepare("SELECT id, state, legacy_priority FROM memory_facts ORDER BY id").all()).toEqual([
      { id: "memory-legacy-1", state: "current", legacy_priority: 12 },
      { id: "memory-legacy-2", state: "archived", legacy_priority: 4 },
    ]);
    expect(database.raw.prepare("SELECT id, status FROM memory_operations").get()).toEqual({
      id: "suggestion-legacy-1",
      status: "review",
    });
    expect(reconcileLegacySnapshot(fixture, database).mismatches).toEqual([]);
  });

  it("is idempotent when the same snapshot is imported twice", () => {
    const database = openTestDatabase();
    const fixture = legacyFixture();
    importLegacySnapshot(fixture, database);

    const second = importLegacySnapshot(fixture, database);

    expect(second.skipped).toBe(7);
    expect(database.raw.prepare("SELECT COUNT(*) AS count FROM conversations").get()).toEqual({ count: 1 });
    expect(database.raw.prepare("SELECT COUNT(*) AS count FROM conversation_messages").get()).toEqual({ count: 2 });
    expect(database.raw.prepare("SELECT COUNT(*) AS count FROM memory_facts").get()).toEqual({ count: 2 });
  });

  it("rejects an existing ID whose durable content differs", () => {
    const database = openTestDatabase();
    const fixture = legacyFixture();
    importLegacySnapshot(fixture, database);
    const changed = structuredClone(fixture);
    (changed.conversations[0] as { title: string }).title = "Outro projeto";

    expect(() => importLegacySnapshot(changed, database)).toThrow(
      "Legacy ID collision: conversation conv-legacy-1"
    );
  });

  it("reports a reconciliation mismatch without exposing content", () => {
    const database = openTestDatabase();
    const fixture = legacyFixture();
    importLegacySnapshot(fixture, database);
    database.raw.prepare("UPDATE conversations SET title = ? WHERE id = ?").run(
      "Título alterado",
      "conv-legacy-1"
    );

    expect(reconcileLegacySnapshot(fixture, database).mismatches).toEqual([
      { entity: "conversation", id: "conv-legacy-1", field: "title" },
    ]);
  });
});
