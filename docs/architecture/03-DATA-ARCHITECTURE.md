# Data Architecture

## 1. Persistence model (server-side JSON)

Persistence is server-backed via JSON files under `data/`, not browser IndexedDB.

- `data/conversations.json`
- `data/memories.json`
- `data/persona.json`

The API layer serializes/deserializes runtime types and writes through `lib/server/jsonFileStore.ts` with per-file locking (`withDataFileLock`) to avoid concurrent write corruption.

## 2. State management split

### 2.1 Local UI/session state (Zustand)

- `stores/chatStore.ts`: active conversation ID, active message list, streaming flag
- `stores/settingsStore.ts`: model parameters, per-model settings, persona snapshot, memories snapshot
- `stores/uiStore.ts`: mode toggles, panel state, artifact state, text selection state

### 2.2 Async server state (TanStack Query)

`hooks/queries/useConversationQuery.ts` handles:

- conversation list/detail queries
- optimistic create/delete
- cache invalidation after persistence mutations

## 3. Data flow

### Chat flow

1. User submits message from `CommandComposerContainerV2`.
2. `useChat` appends optimistic user + assistant placeholder state to `chatStore`.
3. `useChat` builds request payload (`buildInputFromMessages`, model/reasoning/options) and calls `/api/chat`.
4. SSE events are reduced by `lib/chat/streamMachine.ts` and applied incrementally to the assistant message.
5. Conversation snapshots are persisted through `/api/conversations/[id]` with retry (`withConversationPersistenceRetry`).

### Incremental streaming persistence safeguards

`useChat` applies five protections during streaming:

1. Synchronous flush before fetch.
2. Throttled auto-save during stream.
3. `pagehide` beacon flush (`sendBeacon` with keepalive fallback).
4. Reload normalization from `streaming` to `interrupted`.
5. Upstream abort propagation using `request.signal`.

## 4. Domain models (`types/index.ts`)

- `Message`
- `Conversation`
- `ConversationWorkspace`
- `Memory`
- `CustomInstructions`
- `ModelParameters` / `ModelScopedParameters`
- `MessageArtifact` (`document` | `quiz`)
- `MessageStreamStatus`

These models are serialized at API boundaries via helpers in `lib/storage/serializers.ts`.
