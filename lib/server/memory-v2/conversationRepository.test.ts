import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Conversation } from "@/types";
import { openMemoryDatabase, type MemoryDatabase } from "./database";
import {
  archiveConversation,
  createConversation,
  getConversation,
  listConversations,
  permanentlyDeleteConversation,
  restoreConversation,
  updateConversation,
} from "./conversationRepository";

const tempDirs: string[] = [];
const databases: MemoryDatabase[] = [];

function openTestDatabase(): MemoryDatabase {
  const directory = mkdtempSync(join(tmpdir(), "gaucho-conversation-repository-"));
  tempDirs.push(directory);
  const database = openMemoryDatabase({ path: join(directory, "memory.sqlite") });
  databases.push(database);
  return database;
}

function richConversation(): Conversation {
  return {
    id: "conv-rich-1",
    title: "Continuidade profunda",
    lifecycle: "active",
    messages: [
      {
        id: "msg-user-1",
        role: "user",
        content: "Guarda este contexto completo.",
        timestamp: new Date("2026-08-31T12:00:01.000Z"),
        responseMode: "document",
        attachments: [
          {
            id: "attachment-1",
            name: "contexto.md",
            type: "text",
            mimeType: "text/markdown",
            size: 42,
            dataUrl: "data:text/markdown;base64,IyBDb250ZXh0bw==",
            extractedText: "# Contexto",
            thumbnailUrl: "data:image/png;base64,dGh1bWI=",
          },
        ],
      },
      {
        id: "msg-assistant-1",
        role: "assistant",
        content: "Contexto preservado.",
        timestamp: new Date("2026-08-31T12:00:02.000Z"),
        streamStatus: "completed",
        reasoningSummary: "Preservar todos os campos.",
        reasoningText: "Raciocínio detalhado.",
        reasoningStatus: "complete",
        preferredDisplayMode: "document",
        citations: [{ title: "Fonte", url: "https://example.com/source" }],
        artifact: {
          id: "artifact-1",
          kind: "document",
          title: "Documento",
          summary: "Resumo",
          content: "# Documento",
          type: "markdown",
        },
        inputTokens: 101,
        outputTokens: 202,
        cachedTokens: 33,
        reasoningTokens: 44,
        backgroundJob: {
          responseId: "response-1",
          status: "completed",
          startedAt: "2026-08-31T12:00:01.000Z",
          updatedAt: "2026-08-31T12:00:02.000Z",
        },
      },
    ],
    workspace: {
      notes: {
        objective: "Manter continuidade",
        body: "Notas do workspace",
        nextSteps: ["Consolidar", "Recuperar"],
        updatedAt: new Date("2026-08-31T12:00:03.000Z"),
      },
    },
    createdAt: new Date("2026-08-31T12:00:00.000Z"),
    updatedAt: new Date("2026-08-31T12:00:03.000Z"),
  };
}

afterEach(() => {
  while (databases.length > 0) databases.pop()?.close();
  while (tempDirs.length > 0) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe("canonical conversation repository", () => {
  it("round-trips every conversation field and preserves it through archive and restore", () => {
    const database = openTestDatabase();
    const conversation = richConversation();

    createConversation(database, conversation);
    expect(getConversation(database, conversation.id)).toEqual(conversation);

    const archived = archiveConversation(database, conversation.id);
    expect(archived?.lifecycle).toBe("archived");
    expect(archived?.archivedAt).toBeInstanceOf(Date);
    expect(listConversations(database, { lifecycle: "active" })).toEqual([]);
    expect(listConversations(database, { lifecycle: "archived" })).toEqual([
      archived,
    ]);

    const restored = restoreConversation(database, conversation.id);
    expect(restored).toEqual(conversation);

    const updated = updateConversation(database, conversation.id, {
      title: "Título atualizado",
      updatedAt: new Date("2026-08-31T13:00:00.000Z"),
    });
    expect(updated).toEqual({
      ...conversation,
      title: "Título atualizado",
      updatedAt: new Date("2026-08-31T13:00:00.000Z"),
    });
  });

  it("permanently deletes canonical content and only exclusively supported facts", () => {
    const database = openTestDatabase();
    const target = richConversation();
    const other: Conversation = {
      ...richConversation(),
      id: "conv-other",
      messages: [
        {
          id: "msg-other",
          role: "user",
          content: "Evidência compartilhada",
          timestamp: new Date("2026-08-31T12:10:00.000Z"),
        },
      ],
    };
    createConversation(database, target);
    createConversation(database, other);

    const now = "2026-08-31T14:00:00.000Z";
    database.raw
      .prepare(
        "INSERT INTO memory_topics (id, slug, title, state, aliases_json, created_at, updated_at) VALUES (?, ?, ?, 'active', '[]', ?, ?)"
      )
      .run("topic-1", "continuidade", "Continuidade", now, now);
    const insertFact = database.raw.prepare(
      "INSERT INTO memory_facts (id, topic_id, fact_type, sensitivity, confidence, state, is_core, created_at, updated_at) VALUES (?, 'topic-1', 'preference', 'standard', 0.9, 'current', 0, ?, ?)"
    );
    const insertVersion = database.raw.prepare(
      "INSERT INTO memory_fact_versions (id, fact_id, content, normalized_content, state, confidence, author, created_at) VALUES (?, ?, ?, ?, 'current', 0.9, 'system', ?)"
    );
    const insertEvidence = database.raw.prepare(
      "INSERT INTO memory_evidence (id, version_id, conversation_id, message_id, created_at) VALUES (?, ?, ?, ?, ?)"
    );
    insertFact.run("fact-exclusive", now, now);
    insertVersion.run("version-exclusive", "fact-exclusive", "Exclusivo", "exclusivo", now);
    insertEvidence.run("evidence-exclusive", "version-exclusive", target.id, "msg-user-1", now);
    insertFact.run("fact-shared", now, now);
    insertVersion.run("version-shared", "fact-shared", "Compartilhado", "compartilhado", now);
    insertEvidence.run("evidence-target", "version-shared", target.id, "msg-user-1", now);
    insertEvidence.run("evidence-other", "version-shared", other.id, "msg-other", now);
    database.raw
      .prepare(
        "INSERT INTO memory_fact_versions (id, fact_id, content, normalized_content, state, confidence, author, created_at) VALUES (?, ?, ?, ?, 'superseded', 0.8, 'system', ?)"
      )
      .run(
        "version-shared-history",
        "fact-shared",
        "Histórico compartilhado",
        "historico compartilhado",
        now
      );
    insertEvidence.run(
      "evidence-target-history",
      "version-shared-history",
      target.id,
      "msg-user-1",
      now
    );

    const report = permanentlyDeleteConversation(database, target.id);

    expect(report).toEqual({
      conversations: 1,
      messages: 2,
      attachments: 1,
      evidence: 3,
      facts: 1,
    });
    expect(getConversation(database, target.id)).toBeUndefined();
    expect(getConversation(database, other.id)).toEqual(other);
    expect(
      database.raw.prepare("SELECT id FROM memory_facts ORDER BY id").all()
    ).toEqual([{ id: "fact-shared" }]);
    expect(
      database.raw.prepare("SELECT id FROM memory_evidence ORDER BY id").all()
    ).toEqual([{ id: "evidence-other" }]);
  });
});
