# Thematic Memory and Continuous Recall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-on-demand:subagent-driven-development (recommended) or superpowers-on-demand:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a SQLite-canonical memory system with thematic Markdown projections, temporal fact history, archived-conversation recall, automatic consolidation, and budgeted server-side retrieval for Chat and Pulse.

**Architecture:** SQLite owns conversations, facts, versions, evidence, topics, jobs, and audit history. Markdown and LanceDB are rebuildable projections. A server-side Context Assembler supplies a small core plus relevant themes/history to every provider, while durable jobs consolidate completed conversations without blocking chat.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, `better-sqlite3`, LanceDB, OpenAI Responses API, Vitest, Zustand, TanStack Query.

**Spec:** `docs/superpowers/specs/2026-08-31-thematic-memory-continuity-design.md`

## Global Constraints

- Preserve all existing runtime IDs, timestamps, messages, attachments, memories, and suggestions during migration.
- Never modify `data/conversations.json`, `data/memories.json`, `data/persona.json`, or `data/memory-index` in tests; use temporary directories and synthetic fixtures.
- SQLite is canonical after cutover; Markdown and LanceDB must be fully rebuildable.
- Chat memory budget: 5,000 estimated tokens, split 1,200 core, 2,400 themes/facts, 700 history, 700 raw excerpts.
- Pulse memory budget: 3,000 estimated tokens, split 700 core, 1,500 themes/facts, 800 history/raw.
- Personal, emotional, and health facts may consolidate automatically at high confidence; credentials and secrets must never be persisted, embedded, projected, or logged.
- Archive is reversible and searchable. Permanent deletion removes raw content, exclusive evidence/facts, projections, and embeddings in one canonical operation.
- Preserve unrelated WIP. Run implementation in an isolated worktree created from commit `8ba61c5` or its descendant.
- Do not migrate live data or enable the cutover flag until backup, isolated migration, reconciliation, rollback, tests, build, and authenticated smoke all pass.

---

## File Structure

New memory-v2 units live under `lib/server/memory-v2/`:

- `database.ts`: open/configure SQLite and transaction boundary.
- `schema.ts`: ordered SQL migrations and schema versioning.
- `types.ts`: canonical row/domain types and operation schemas.
- `conversationRepository.ts`: active/archive/restore/permanent-delete lifecycle.
- `memoryRepository.ts`: topics, facts, versions, evidence, conflicts, audit.
- `secretFilter.ts`: deterministic secret detection/redaction decision.
- `importLegacy.ts`: read-only JSON importer and reconciliation report.
- `projector.ts`: deterministic thematic Markdown projections.
- `derivedIndex.ts`: LanceDB v2 write/delete/rebuild/search.
- `jobRepository.ts`: durable idempotent outbox/job queue.
- `consolidator.ts`: Responses extraction and validated operation application.
- `contextAssembler.ts`: hybrid retrieval, reranking, budgets, prompt envelope.
- `service.ts`: narrow facade consumed by API routes, tools, Chat, and Pulse.

UI code is split rather than expanding `SettingsDrawer.tsx` further:

- `components/settings/memory/MemoryWorkspace.tsx`: four-view shell.
- `components/settings/memory/CoreMemoryView.tsx`: always-on core.
- `components/settings/memory/TopicMemoryView.tsx`: thematic dossiers.
- `components/settings/memory/MemoryHistoryView.tsx`: versions/conflicts/rollback.
- `components/settings/memory/ArchivedConversationsView.tsx`: search/restore/delete.
- `hooks/useMemoryWorkspace.ts`: query/mutation adapter for memory-v2 APIs.

---

### Task 1: SQLite Foundation and Canonical Schema

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`
- Create: `lib/server/memory-v2/database.ts`
- Create: `lib/server/memory-v2/schema.ts`
- Create: `lib/server/memory-v2/types.ts`
- Test: `lib/server/memory-v2/database.test.ts`

**Interfaces:**
- Produces: `openMemoryDatabase(options?: { path?: string }): MemoryDatabase`
- Produces: `withMemoryTransaction<T>(db, work): T`
- Produces: `migrateMemorySchema(db): void`
- Produces: canonical IDs and unions used by every later task.

- [ ] **Step 1: Install SQLite dependency**

Run:

```bash
npm install better-sqlite3 && npm install --save-dev @types/better-sqlite3 tsx
```

Expected: `package.json` and lockfile contain the runtime driver, types, and
the TypeScript CLI runner. Add `data/memory-v2.sqlite*` and
`data/memory-topics/` to `.gitignore` before any database is opened.

- [ ] **Step 2: Write failing schema tests**

Create tests using a `mkdtemp` database. Assert WAL, foreign keys, schema
version, every required table, uniqueness of one current fact version, and
cascade behavior for conversation messages/attachments.

```ts
const db = openMemoryDatabase({ path: join(tempDir, "memory.sqlite") });
expect(db.pragma("journal_mode", { simple: true })).toBe("wal");
expect(listTables(db)).toEqual(expect.arrayContaining([
  "conversations", "conversation_messages", "conversation_attachments",
  "memory_topics", "memory_facts", "memory_fact_versions",
  "memory_evidence", "memory_conflicts", "memory_operations",
  "memory_audit_log", "memory_jobs",
]));
```

- [ ] **Step 3: Run tests and verify RED**

Run: `npm test -- lib/server/memory-v2/database.test.ts`  
Expected: FAIL because the module does not exist.

- [ ] **Step 4: Implement database and migrations**

Use `Database` from `better-sqlite3`, set `journal_mode=WAL`,
`foreign_keys=ON`, `busy_timeout=5000`, and apply ordered migrations inside
`BEGIN IMMEDIATE`. Define row types without leaking driver objects:

```ts
export type ConversationLifecycle = "active" | "archived";
export type MemoryFactState = "current" | "superseded" | "conflicted" | "archived" | "removed";
export type MemorySensitivity = "standard" | "personal" | "sensitive";

export interface MemoryDatabase {
  raw: Database.Database;
  close(): void;
}
```

The schema stores ISO timestamps, JSON only for bounded metadata, and content
in normalized message/version rows. Add indexes for lifecycle/time, topic
slug/aliases, fact state/topic, evidence source, job status/availability, and
audit entity/time.

- [ ] **Step 5: Run focused validation**

Run: `npm test -- lib/server/memory-v2/database.test.ts && npx tsc --noEmit`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add .gitignore package.json package-lock.json lib/server/memory-v2
git commit -m "feat(memory): add sqlite canonical schema"
```

---

### Task 2: Read-Only Legacy Import and Reconciliation

**Files:**
- Create: `lib/server/memory-v2/importLegacy.ts`
- Create: `lib/server/memory-v2/importLegacy.test.ts`
- Create: `scripts/memory-v2-migrate.ts`
- Create: `test/fixtures/memory-v2/conversations.json`
- Create: `test/fixtures/memory-v2/memories.json`
- Create: `test/fixtures/memory-v2/memory-suggestions.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: `openMemoryDatabase`, canonical schema types.
- Produces: `importLegacySnapshot(input, db): LegacyImportReport`
- Produces: `reconcileLegacySnapshot(input, db): LegacyReconciliationReport`
- Produces: `npm run memory:migrate -- --source <dir> --database <path> --dry-run`.

- [ ] **Step 1: Write synthetic legacy fixtures in tests**

Build fixture objects in memory, including completed/interrupted messages,
attachments, active/inactive memories, suggestions, duplicate IDs, and a
conversation already archived by fixture metadata.

```ts
const report = importLegacySnapshot(fixture, db);
expect(report).toMatchObject({ conversations: 2, messages: 4, memories: 2 });
expect(reconcileLegacySnapshot(fixture, db).mismatches).toEqual([]);
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- lib/server/memory-v2/importLegacy.test.ts`  
Expected: FAIL because importer is absent.

- [ ] **Step 3: Implement idempotent importer**

Map every legacy memory to one topic, fact, initial version, and evidence
record while preserving the legacy memory ID in metadata. Preserve
conversation/message/attachment IDs and timestamps exactly. Use UPSERT only
when content hashes match; report an error on same ID with different content.

```ts
export interface LegacyImportReport {
  conversations: number;
  messages: number;
  attachments: number;
  memories: number;
  suggestions: number;
  skipped: number;
  hashes: Record<string, string>;
}
```

- [ ] **Step 4: Implement CLI with safe defaults**

Add `"memory:migrate": "tsx scripts/memory-v2-migrate.ts"` to package scripts.
The CLI defaults to dry-run, requires explicit paths, refuses a database
inside the source directory, writes no source files, and prints counts/hashes
without content. `--apply` imports into the target database; it never changes
runtime flags or renames legacy files.

- [ ] **Step 5: Verify idempotency and reconciliation**

Run: `npm test -- lib/server/memory-v2/importLegacy.test.ts && npm run memory:migrate -- --source test/fixtures/memory-v2 --database /tmp/gaucho-memory-plan.sqlite --dry-run`  
Expected: tests PASS; dry-run prints a content-free report and exits 0.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json scripts/memory-v2-migrate.ts test/fixtures/memory-v2 lib/server/memory-v2/importLegacy.ts lib/server/memory-v2/importLegacy.test.ts
git commit -m "feat(memory): add safe legacy importer"
```

---

### Task 3: Canonical Conversation Lifecycle

**Files:**
- Create: `lib/server/memory-v2/conversationRepository.ts`
- Test: `lib/server/memory-v2/conversationRepository.test.ts`
- Modify: `app/api/conversations/data.ts`
- Modify: `app/api/conversations/[id]/route.ts`
- Modify: `app/api/conversations/route.ts`
- Modify: `types/index.ts`
- Test: `app/api/conversations/[id]/route.test.ts`
- Test: `app/api/conversations/route.test.ts`

**Interfaces:**
- Produces: `listConversations({ lifecycle }): Conversation[]`
- Produces: `archiveConversation(id): Conversation`
- Produces: `restoreConversation(id): Conversation`
- Produces: `permanentlyDeleteConversation(id): DeletionReport`
- Preserves existing create/get/update signatures through the API adapter.

- [ ] **Step 1: Write repository lifecycle tests**

```ts
await archiveConversation(db, "conv-1");
expect(listConversations(db, { lifecycle: "active" })).toHaveLength(0);
expect(listConversations(db, { lifecycle: "archived" })[0].id).toBe("conv-1");
await restoreConversation(db, "conv-1");
expect(getConversation(db, "conv-1")?.lifecycle).toBe("active");
```

Also assert permanent delete removes messages/attachments and returns exact
counts while archive preserves them byte-for-byte.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- lib/server/memory-v2/conversationRepository.test.ts`  
Expected: FAIL because repository is absent.

- [ ] **Step 3: Implement repository and compatibility adapter**

Deserialize SQLite rows into the existing `Conversation` type and add:

```ts
export interface Conversation {
  // existing fields unchanged
  lifecycle?: "active" | "archived";
  archivedAt?: Date;
}
```

Keep legacy JSON access behind `MEMORY_V2_ENABLED !== "true"`. When enabled,
all writes go only to SQLite; do not dual-write and create two authorities.

- [ ] **Step 4: Change HTTP semantics**

`DELETE /api/conversations/[id]` archives by default. Add authenticated
`POST /api/conversations/[id]/restore` and
`DELETE /api/conversations/[id]?permanent=true`. Permanent deletion invokes
the canonical transaction and returns a `DeletionReport`; it must not call
the old LanceDB cleanup directly.

- [ ] **Step 5: Run route and repository tests**

Run: `npm test -- lib/server/memory-v2/conversationRepository.test.ts app/api/conversations/route.test.ts app/api/conversations/[id]/route.test.ts && npx tsc --noEmit`  
Expected: PASS in legacy and v2 flag modes.

- [ ] **Step 6: Commit**

```bash
git add types/index.ts lib/server/memory-v2/conversationRepository.ts lib/server/memory-v2/conversationRepository.test.ts app/api/conversations
git commit -m "feat(memory): add archive-first conversation lifecycle"
```

---

### Task 4: Versioned Facts, Topics, Audit, and Secret Boundary

**Files:**
- Create: `lib/server/memory-v2/secretFilter.ts`
- Create: `lib/server/memory-v2/secretFilter.test.ts`
- Create: `lib/server/memory-v2/memoryRepository.ts`
- Create: `lib/server/memory-v2/memoryRepository.test.ts`

**Interfaces:**
- Produces: `inspectMemoryContent(text): SecretInspection`
- Produces: `applyMemoryOperation(db, operation): AppliedMemoryOperation`
- Produces: `rollbackMemoryOperation(db, auditId): AppliedMemoryOperation`
- Produces: `listCoreFacts`, `listTopics`, `getTopicDossier`, `listHistory`.

- [ ] **Step 1: Write secret-filter tests**

Use synthetic values only. Detect OpenAI-style keys, bearer tokens, PEM private
keys, common password assignments, and high-entropy credential fields; do not
flag ordinary medical terms, dates, medication names, or emotional content.

```ts
expect(inspectMemoryContent("OPENAI_API_KEY=sk-proj-synthetic-not-real").allowed).toBe(false);
expect(inspectMemoryContent("Tenho consulta de saúde na terça").allowed).toBe(true);
```

- [ ] **Step 2: Write operation-state tests**

Cover create, reinforce, supersede, temporal update, conflict, topic alias,
merge, core promotion, and rollback. Assert one current version, append-only
history, evidence preservation, and content-free operational logs.

- [ ] **Step 3: Run tests and verify RED**

Run: `npm test -- lib/server/memory-v2/secretFilter.test.ts lib/server/memory-v2/memoryRepository.test.ts`  
Expected: FAIL because modules are absent.

- [ ] **Step 4: Implement strict operation union**

```ts
export type MemoryOperation =
  | { type: "create_fact"; topicId: string; content: string; factType: string; sensitivity: MemorySensitivity; confidence: number; evidence: EvidenceInput[] }
  | { type: "reinforce_fact"; factId: string; confidence: number; evidence: EvidenceInput[] }
  | { type: "supersede_fact"; factId: string; content: string; validFrom?: string; confidence: number; evidence: EvidenceInput[] }
  | { type: "open_conflict"; factId: string; competingContent: string; confidence: number; evidence: EvidenceInput[] }
  | { type: "move_fact"; factId: string; topicId: string }
  | { type: "promote_core"; factId: string }
  | { type: "merge_topics"; sourceTopicId: string; targetTopicId: string };
```

Validate content before transactions. Audit rows store authorized before/after
inside SQLite; application logs receive only operation type, IDs, duration,
and outcome.

- [ ] **Step 5: Run focused validation**

Run: `npm test -- lib/server/memory-v2/secretFilter.test.ts lib/server/memory-v2/memoryRepository.test.ts && npx tsc --noEmit`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/server/memory-v2/secretFilter* lib/server/memory-v2/memoryRepository*
git commit -m "feat(memory): add versioned thematic facts"
```

---

### Task 5: Rebuildable Markdown and LanceDB Projections

**Files:**
- Create: `lib/server/memory-v2/projector.ts`
- Create: `lib/server/memory-v2/projector.test.ts`
- Create: `lib/server/memory-v2/derivedIndex.ts`
- Create: `lib/server/memory-v2/derivedIndex.test.ts`
- Modify: `lib/server/memory/indexStore.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `projectTopicMarkdown(db, topicId, outputDir): ProjectionResult`
- Produces: `rebuildAllTopicMarkdown(db, outputDir): ProjectionResult[]`
- Produces: `rebuildDerivedMemoryIndex(db, options): RebuildReport`
- Produces: `searchDerivedMemory(query, filters): RetrievedMemoryItem[]`.

- [ ] **Step 1: Write deterministic projection tests**

Assert stable order, atomic replacement, current facts only in the main
section, short timeline, aliases, provenance IDs, and no raw conversations.

```ts
const first = await projectTopicMarkdown(db, topicId, tempDir);
const second = await projectTopicMarkdown(db, topicId, tempDir);
expect(readFileSync(first.path, "utf8")).toBe(readFileSync(second.path, "utf8"));
```

- [ ] **Step 2: Write derived-index lifecycle tests**

Mock embeddings and LanceDB. Assert records carry canonical ID, source kind,
topic, temporal state, sensitivity, and lifecycle; rebuild replaces the v2
table atomically and permanent deletion removes every record for source IDs.

- [ ] **Step 3: Run tests and verify RED**

Run: `npm test -- lib/server/memory-v2/projector.test.ts lib/server/memory-v2/derivedIndex.test.ts`  
Expected: FAIL because projections are absent.

- [ ] **Step 4: Implement projections**

Write Markdown to `data/memory-topics/.tmp/<slug>-<uuid>.md`, fsync, then rename
to `data/memory-topics/<slug>.md`. Use a separate LanceDB table
`memory_items_v2`; do not mutate `conversation_chunks` until cutover.

```ts
export type DerivedSourceKind = "fact" | "fact_history" | "topic" | "conversation_chunk";
export interface RetrievedMemoryItem {
  sourceKind: DerivedSourceKind;
  canonicalId: string;
  topicId?: string;
  text: string;
  score: number;
  state: MemoryFactState | ConversationLifecycle;
  sensitivity: MemorySensitivity;
  timestamp: string;
}
```

- [ ] **Step 5: Verify rebuild and legacy isolation**

Run: `npm test -- lib/server/memory-v2/projector.test.ts lib/server/memory-v2/derivedIndex.test.ts lib/server/memory/indexStore.test.ts && npx tsc --noEmit`  
Expected: PASS; legacy table tests remain unchanged.

- [ ] **Step 6: Commit**

```bash
git add .gitignore lib/server/memory-v2/projector* lib/server/memory-v2/derivedIndex* lib/server/memory/indexStore.ts
git commit -m "feat(memory): add rebuildable memory projections"
```

---

### Task 6: Durable Jobs and Automatic Consolidation

**Files:**
- Create: `lib/server/memory-v2/jobRepository.ts`
- Create: `lib/server/memory-v2/jobRepository.test.ts`
- Create: `lib/server/memory-v2/consolidator.ts`
- Create: `lib/server/memory-v2/consolidator.test.ts`
- Create: `app/api/memory/jobs/run/route.ts`
- Create: `app/api/memory/jobs/run/route.test.ts`
- Modify: `lib/chat/memoryRefresh.ts`
- Test: `lib/chat/memoryRefresh.test.ts`

**Interfaces:**
- Produces: `enqueueMemoryJob(db, input): MemoryJob`
- Produces: `claimNextMemoryJob(db, workerId, now): MemoryJob | null`
- Produces: `runMemoryConsolidationJob(job, dependencies): ConsolidationReport`
- Produces: authenticated/internal runner route for due jobs.

- [ ] **Step 1: Write queue tests**

Cover idempotency key, atomic claim, expired lease recovery, bounded attempts,
backoff, completion, and permanent failure.

```ts
const first = enqueueMemoryJob(db, { type: "consolidate", conversationId: "c1", checkpoint: "m4" });
const second = enqueueMemoryJob(db, { type: "consolidate", conversationId: "c1", checkpoint: "m4" });
expect(second.id).toBe(first.id);
```

- [ ] **Step 2: Write consolidator contract tests**

Mock Responses output as strict JSON operations. Assert only unprocessed delta
is sent, invalid JSON/schema writes nothing, secrets reject the individual
operation, high-confidence valid operations apply, and low-confidence or
conflicted operations become review items.

- [ ] **Step 3: Run tests and verify RED**

Run: `npm test -- lib/server/memory-v2/jobRepository.test.ts lib/server/memory-v2/consolidator.test.ts`  
Expected: FAIL because modules are absent.

- [ ] **Step 4: Implement queue and consolidator**

Use the existing default OpenAI client and a strict JSON schema response.
Store the effective model and prompt version on the operation, but never the
full prompt in logs.

```ts
export interface ConsolidationPayload {
  operations: MemoryOperation[];
  review: Array<{ reason: "low_confidence" | "conflict" | "sensitivity_uncertain"; operation: MemoryOperation }>;
}
```

`refreshConversationMemoryLayer` enqueues after every terminal status; only
completed assistant output is eligible for fact extraction, while interrupted,
failed, and aborted conversations remain indexable evidence.

- [ ] **Step 5: Secure the runner route**

Reuse the internal Pulse runner token comparison pattern. Process at most two
jobs per invocation and return content-free counts. Missing token must never
trust hostname alone.

- [ ] **Step 6: Run focused validation**

Run: `npm test -- lib/server/memory-v2/jobRepository.test.ts lib/server/memory-v2/consolidator.test.ts app/api/memory/jobs/run/route.test.ts lib/chat/memoryRefresh.test.ts && npx tsc --noEmit`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/server/memory-v2/jobRepository* lib/server/memory-v2/consolidator* app/api/memory/jobs lib/chat/memoryRefresh*
git commit -m "feat(memory): add durable automatic consolidation"
```

---

### Task 7: Budgeted Context Assembler and Canonical Memory Tools

**Files:**
- Create: `lib/server/memory-v2/contextAssembler.ts`
- Create: `lib/server/memory-v2/contextAssembler.test.ts`
- Create: `lib/server/memory-v2/service.ts`
- Modify: `lib/server/memory/toolExecutor.ts`
- Test: `lib/server/memory/toolExecutor.test.ts`
- Modify: `lib/openai/contextBuilder.ts`
- Test: `lib/openai/contextBuilder.test.ts`

**Interfaces:**
- Produces: `assembleMemoryContext(input): Promise<AssembledMemoryContext>`
- Produces: `formatMemoryContext(context): string`
- Produces: service facade used by APIs, tools, Chat, and Pulse.

- [ ] **Step 1: Write ranking and budget tests**

Use deterministic fake lexical/vector candidates. Cover topic aliases, exact
terms, semantic score, recency, confidence, temporal state, sensitive
relevance, conflicts, and item-boundary truncation.

```ts
const result = await assembleMemoryContext({
  query: "Como ficou o projeto de memória?",
  recentTurns: [],
  profile: "chat",
  excludeConversationId: "current",
}, dependencies);
expect(result.estimatedTokens).toBeLessThanOrEqual(5000);
expect(result.history.every((item) => item.requestedByTemporalIntent)).toBe(true);
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- lib/server/memory-v2/contextAssembler.test.ts`  
Expected: FAIL because assembler is absent.

- [ ] **Step 3: Implement hybrid ranking**

Normalize query and topic aliases; union exact SQLite FTS candidates with
LanceDB candidates; score deterministically; filter non-current facts unless
temporal intent is detected; then allocate blocks under the exact budgets in
Global Constraints.

```ts
export interface AssembledMemoryContext {
  core: MemoryContextItem[];
  themes: MemoryContextItem[];
  history: MemoryContextItem[];
  excerpts: MemoryContextItem[];
  estimatedTokens: number;
  trace: { candidateCount: number; selectedCount: number; topicIds: string[] };
}
```

- [ ] **Step 4: Repoint tools to canonical service**

`remember_memory` creates a high-priority canonical operation with current
conversation evidence. `search_memory` returns typed current/history/archive
results. Keep the public function-tool names and two-round orchestrator
contract unchanged.

- [ ] **Step 5: Make contextBuilder accept a formatted v2 envelope**

Remove responsibility for deciding relevance from `contextBuilder`; it only
places the already-budgeted envelope under a policy that distinguishes
current facts, historical evidence, and conflicts. Preserve legacy behavior
when `MEMORY_V2_ENABLED` is false.

- [ ] **Step 6: Run focused validation**

Run: `npm test -- lib/server/memory-v2/contextAssembler.test.ts lib/server/memory/toolExecutor.test.ts lib/openai/contextBuilder.test.ts && npx tsc --noEmit`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/server/memory-v2/contextAssembler* lib/server/memory-v2/service.ts lib/server/memory/toolExecutor* lib/openai/contextBuilder*
git commit -m "feat(memory): add budgeted context assembler"
```

---

### Task 8: Server-Side Chat and Pulse Integration

**Files:**
- Modify: `lib/server/chatRequest.ts`
- Test: `lib/server/chatRequest.test.ts`
- Modify: `app/api/chat/route.ts`
- Test: `app/api/chat/route.test.ts`
- Modify: `hooks/useChat.ts`
- Modify: `lib/pulse/context.ts`
- Create: `lib/pulse/context.test.ts`
- Modify: `lib/pulse/runner.ts`

**Interfaces:**
- Consumes: `assembleMemoryContext`, `formatMemoryContext`.
- Extends: `ChatRequestBody` with `conversationId` and `memoryQuery`.
- Produces: same provider SSE/JSON contracts as before.

- [ ] **Step 1: Write route assembly tests**

Mock the assembler and every provider. Assert OpenAI, DeepSeek, and Gemini all
receive the same formatted memory envelope; quiz/document modes keep their
mode instructions; assembler failure falls back to no retrieved context and
does not fail chat.

- [ ] **Step 2: Write Pulse budget tests**

Assert Pulse uses profile `pulse`, stays at or below 3,000 estimated tokens,
does not append the full global prompt, and keeps routine instructions first.

- [ ] **Step 3: Run tests and verify RED**

Run: `npm test -- app/api/chat/route.test.ts lib/pulse/context.test.ts`  
Expected: FAIL because route/Pulse do not call v2 assembler.

- [ ] **Step 4: Move automatic retrieval into the server route**

`useChat` sends `conversationId` and the current user text as `memoryQuery`
and stops calling `searchMemoryContext` automatically. It builds the base
prompt without legacy memories when v2 is enabled. The route assembles and
appends memory before provider routing, so all providers share the same
contract.

```ts
export type ChatRequestBody = {
  // existing fields
  conversationId?: string;
  memoryQuery?: string;
};
```

- [ ] **Step 5: Replace Pulse-specific memory selection**

Keep persona preferences and routine instructions, but obtain core/themes/
history from the shared assembler. Do not change the approved Pulse model,
reasoning, verbosity, image, or web-search contracts.

- [ ] **Step 6: Run integration validation**

Run: `npm test -- app/api/chat/route.test.ts lib/server/chatRequest.test.ts lib/pulse/context.test.ts lib/pulse/runner.test.ts lib/openai/contextBuilder.test.ts && npx tsc --noEmit`  
Expected: PASS for flag off and flag on.

- [ ] **Step 7: Commit**

```bash
git add lib/server/chatRequest* app/api/chat/route* hooks/useChat.ts lib/pulse/context* lib/pulse/runner.ts
git commit -m "feat(memory): integrate server-side recall"
```

---

### Task 9: Four-View Memory Workspace and Archived Conversations

**Files:**
- Create: `app/api/memory/core/route.ts`
- Create: `app/api/memory/topics/route.ts`
- Create: `app/api/memory/topics/[id]/route.ts`
- Create: `app/api/memory/history/route.ts`
- Create: `app/api/memory/audit/[id]/rollback/route.ts`
- Create: `app/api/conversations/[id]/restore/route.ts`
- Create: `lib/storage/memoryWorkspace.ts`
- Create: `hooks/useMemoryWorkspace.ts`
- Create: `components/settings/memory/MemoryWorkspace.tsx`
- Create: `components/settings/memory/CoreMemoryView.tsx`
- Create: `components/settings/memory/TopicMemoryView.tsx`
- Create: `components/settings/memory/MemoryHistoryView.tsx`
- Create: `components/settings/memory/ArchivedConversationsView.tsx`
- Create: `components/settings/memory/MemoryWorkspace.test.tsx`
- Modify: `components/settings/SettingsDrawer.tsx`
- Modify: `components/workspace-v2/ConversationRailV2.tsx`
- Modify: `hooks/useConversations.ts`
- Modify: `hooks/queries/useConversationQuery.ts`

**Interfaces:**
- Consumes: memory-v2 service facade and conversation lifecycle APIs.
- Produces: authenticated CRUD/rollback endpoints and four-view UI.

- [ ] **Step 1: Write API authorization and contract tests**

Every route requires app auth. Assert summaries omit full sensitive content
until detail is requested, rollback returns a new audit/version ID, archived
listing excludes active conversations, and permanent delete requires the
explicit query plus confirmation payload.

- [ ] **Step 2: Write UI behavior tests**

```tsx
render(<MemoryWorkspace initialView="core" />);
expect(screen.getByRole("tab", { name: "Núcleo" })).toHaveAttribute("aria-selected", "true");
await user.click(screen.getByRole("tab", { name: "Arquivadas" }));
expect(await screen.findByText("Restaurar conversa")).toBeVisible();
```

Cover core budget display, topics, history, conflict badge, provenance detail,
rollback, archive search, restore, and permanent-delete confirmation copy.

- [ ] **Step 3: Run tests and verify RED**

Run: `npm test -- components/settings/memory/MemoryWorkspace.test.tsx app/api/memory`  
Expected: FAIL because UI/routes are absent.

- [ ] **Step 4: Implement API/client adapters**

Return serialized dates and bounded summaries. Mutations invalidate only
relevant TanStack keys. Permanent deletion sends `{ confirmPermanent: true }`
and displays the returned deletion counts without exposing removed content.

- [ ] **Step 5: Implement four-view UI and rail semantics**

Extract the current memory block from `SettingsDrawer.tsx` into
`MemoryWorkspace`. Change conversation menu copy from `Excluir` to `Arquivar`.
Do not group old active conversations under a fake `Arquivadas` date section;
archived status now comes only from lifecycle. Restore brings a conversation
back to the main rail without changing messages.

- [ ] **Step 6: Run visual-layer validation**

Run: `npm test -- components/settings/memory/MemoryWorkspace.test.tsx components/workspace-v2/WorkspaceLayoutV2.test.tsx app/api/memory app/api/conversations && npx tsc --noEmit`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/api/memory app/api/conversations lib/storage/memoryWorkspace.ts hooks/useMemoryWorkspace.ts hooks/useConversations.ts hooks/queries/useConversationQuery.ts components/settings/memory components/settings/SettingsDrawer.tsx components/workspace-v2/ConversationRailV2.tsx
git commit -m "feat(memory): add thematic memory workspace"
```

---

### Task 10: Evaluations, Cutover, Documentation, and Production Proof

**Files:**
- Create: `lib/server/memory-v2/evaluation.ts`
- Create: `lib/server/memory-v2/evaluation.test.ts`
- Create: `test/fixtures/memory-v2/continuity-cases.json`
- Create: `scripts/memory-v2-evaluate.ts`
- Modify: `.env.example`
- Modify: `docs/API.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/INFRASTRUCTURE.md`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify when a new routed endpoint requires catalog change: `/etc/apache2/APACHE.md`

**Interfaces:**
- Produces: content-safe migration/evaluation reports.
- Produces: `MEMORY_V2_ENABLED=true` cutover with documented rollback.

- [ ] **Step 1: Write synthetic continuity evaluations**

Cases cover current preference, superseded preference, temporal recall,
archived-only fact, uncertain contradiction, paraphrase deduplication, and
permanent deletion. Fixtures contain invented people/projects and no real
Anders data.

```ts
expect(report.currentFactAccuracy).toBe(1);
expect(report.staleFactRate).toBe(0);
expect(report.duplicateRate).toBe(0);
expect(report.permanentDeleteRecallRate).toBe(0);
expect(report.maxMemoryTokens).toBeLessThanOrEqual(5000);
```

- [ ] **Step 2: Run full offline validation before live data**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build && git diff --check`  
Expected: all change-related checks PASS. Record any unrelated lint failure as
`PRE_EXISTING_FAILURE` only after proving it is outside touched files.

- [ ] **Step 3: Create verified live backup**

Read `/etc/apache2/APACHE.md`, confirm `/chat` and port 3040, stop no service,
and copy live JSON plus LanceDB into a timestamped backup directory outside
the repo. Record SHA-256 manifest and verify it before migration. Never print
contents or secrets.

- [ ] **Step 4: Run isolated live migration and comparison**

Run importer against the backup into a staging SQLite path, rebuild staging
Markdown/LanceDB, then run reconciliation and synthetic evaluation. Expected:
zero ID/hash/count mismatches; budgets and recall gates pass. Do not toggle
the runtime flag on mismatch.

- [ ] **Step 5: Prove rollback in staging**

Start an isolated app process on a disposable port with v2 enabled against
staging, exercise list/search/archive/restore without touching production,
then start it again with v2 disabled and verify legacy data remains readable.

- [ ] **Step 6: Document contracts and enable production**

Document endpoints, schema ownership, jobs, budgets, backup, rebuild,
rollback, and deletion semantics. Set `MEMORY_V2_ENABLED=true` in the private
production env only after all previous gates. If `/chat/api/*` catch-all
already covers the new routes, update only the APACHE route catalog, not the
vhost.

- [ ] **Step 7: Deploy and authenticated smoke**

Restart `chatgpt.service`; verify local and public health. In installed Google
Chrome, authenticate without logging credentials and verify: core view,
topic view, history, archive/restore of a clearly temporary conversation,
current-fact recall, archived-fact recall, and no console/network errors.
Remove the temporary conversation permanently in the same smoke and verify it
is no longer recalled.

- [ ] **Step 8: Final verification and commit**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build && git diff --check`  
Expected: PASS, health local `healthy`, health public HTTP 200, evaluation
gates PASS, temporary smoke data removed.

```bash
git add .env.example README.md AGENTS.md docs lib/server/memory-v2/evaluation* scripts/memory-v2-evaluate.ts test/fixtures/memory-v2
git commit -m "feat(memory): cut over thematic continuity system"
```

Do not include `.env.production`, SQLite databases, Markdown projections,
LanceDB data, backups, or any private runtime content in Git.

---

## Execution Mode

Execute inline with `superpowers-on-demand:executing-plans` and
`superpowers-on-demand:test-driven-development`. Every behavior change follows
strict RED → minimal GREEN → refactor: a test must fail for the intended
reason before production code is written, and the focused test must pass
before broader validation. The project rules
do not authorize subagents for this implementation, and the shared runtime
state plus live migration gates require one context owner. Complete Tasks 1-2
first as the initial deliverable: SQLite foundation and isolated importer,
with no production behavior change. Present that delivery for review before
advancing to the canonical runtime and cutover tasks.
