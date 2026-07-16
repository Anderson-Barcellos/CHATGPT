# Memory RAG Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the Gaucho Chat memory RAG synchronized with canonical conversations and make indexing failures observable.

**Architecture:** Extend the existing LanceDB store with deletion and reconciliation operations, invoke them from the existing conversation and index routes, and harden the existing client helpers. Preserve the current embedding model, chunk format, retrieval prompt, and dynamic memory tools.

**Tech Stack:** Next.js 16 App Router, TypeScript, Vitest, LanceDB, OpenAI embeddings.

## Global Constraints

- Do not modify private runtime JSON as a test fixture.
- Preserve unrelated local changes, especially in `hooks/useChat.ts`.
- Use test-first red/green cycles for every behavior change.
- Do not change retrieval ranking, embedding model, chunk format, or memory suggestion policy.

---

### Task 1: Observable memory client

**Files:**
- Create: `lib/storage/memoryRag.test.ts`
- Modify: `lib/storage/memoryRag.ts`

**Interfaces:**
- Produces: `MemoryIndexResult`, `indexConversationMemory(id)`, and `indexRecentConversationMemories(limit)` returning the server payload and rejecting non-2xx responses.

- [x] Write failing tests proving search and indexing reject structured HTTP failures and successful indexing returns stats.
- [x] Run `npm test -- lib/storage/memoryRag.test.ts` and confirm failures come from swallowed errors or `void` results.
- [x] Reuse `parseApiErrorResponse` for non-2xx responses and return the parsed index payload.
- [x] Re-run the focused test and confirm it passes.

### Task 2: LanceDB cleanup and route integration

**Files:**
- Create: `lib/server/memory/indexStore.test.ts`
- Create: `app/api/memory/index/route.test.ts`
- Modify: `lib/server/memory/indexStore.ts`
- Modify: `app/api/memory/index/route.ts`
- Modify: `app/api/conversations/[id]/route.ts`
- Modify: `app/api/conversations/[id]/route.test.ts`

**Interfaces:**
- Produces: `deleteConversationFromMemoryIndex(id): Promise<number>` and `reconcileMemoryIndex(validIds): Promise<{ removedConversations: number; removedChunks: number }>`.

- [x] Write failing store tests with an in-memory LanceDB table double for targeted deletion and orphan reconciliation.
- [x] Write a failing route test proving RAG chunks are removed before canonical conversation deletion.
- [x] Write a failing bulk-index route test proving reconciliation receives every canonical conversation ID while only the requested recent slice is indexed.
- [x] Run both focused files and confirm the missing cleanup behavior fails.
- [x] Implement minimal store operations and connect them to deletion and bulk indexing.
- [x] Re-run both focused files and confirm they pass.

### Task 3: Interrupted conversation indexing

**Files:**
- Create: `lib/chat/memoryRefresh.test.ts`
- Create: `lib/chat/memoryRefresh.ts`
- Modify: `hooks/useChat.ts`

**Interfaces:**
- Produces: `refreshConversationMemoryLayer(id, status)` to centralize indexing for terminal states and keep suggestions completion-only.

- [x] Write a failing orchestration test covering `completed`, `aborted`, `interrupted`, and `failed` versus `streaming`.
- [x] Run the focused test and confirm the missing policy fails.
- [x] Implement the policy and use it after persisted abort/failure plus reload normalization; suggestions remain completion-only.
- [x] Re-run the focused test and relevant chat tests.

### Task 4: User feedback and production reconciliation

**Files:**
- Modify: `components/settings/SettingsDrawer.tsx`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: `MemoryIndexResult` statistics and reconciliation counts.

- [x] Show indexed chunk count and removed orphan count in the successful manual-index toast.
- [x] Run the full suite, `npx tsc --noEmit`, `npm run build`, and `git diff --check`.
- [x] Restart `chatgpt.service`, verify local/public health, authenticate locally, and invoke bulk indexing once to reconcile the live derived index.
- [x] Verify the live index contains only canonical conversation IDs and repeat semantic search plus `search_memory` streaming round trip.
- [x] Append concise operational evidence to `AGENTS.md` without rewriting existing history.
