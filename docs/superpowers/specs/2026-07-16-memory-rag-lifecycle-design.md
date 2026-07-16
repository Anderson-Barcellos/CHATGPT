# Memory RAG Lifecycle Design

## Goal

Make the existing memory RAG trustworthy without redesigning its retrieval architecture: deleted conversations must not remain searchable, bulk indexing must reconcile stale rows, interrupted exchanges must still index valid user content, and client-side indexing failures must be visible.

## Approved scope

- Preserve the existing OpenAI `text-embedding-3-small` + LanceDB search path.
- Remove a conversation's chunks before its canonical JSON record is deleted.
- Reconcile orphaned conversation IDs whenever the bulk/recent-history index endpoint runs, using the complete canonical conversation list as the validity set even when only a limited recent slice is indexed.
- Index the persisted conversation after explicit abort, failed generation, or reload normalization from `streaming` to `interrupted`; do not generate memory suggestions from incomplete assistant output.
- Make memory index/search client helpers reject non-2xx responses and return index/reconciliation statistics on success.
- Keep active durable memories and suggestion semantics unchanged.

## Data flow

Normal completed responses continue to persist, index, and generate suggestions. Interrupted or failed responses persist first and then request indexing only. Conversation deletion checks that the canonical record exists, deletes its LanceDB chunks, then deletes the JSON record. Bulk indexing prunes all indexed conversation IDs absent from the full canonical list before indexing the requested recent slice.

## Error behavior

Index/search HTTP errors become rejected client promises so existing UI and chat catch paths can surface or log them. A conversation deletion fails rather than reporting success when RAG cleanup fails. Reconciliation reports removed conversation and chunk counts.

## Verification

Add regression coverage for client HTTP errors, delete-route RAG cleanup, orphan reconciliation, and interrupted-path indexing. Run focused tests during red/green cycles, then the full test suite, TypeScript, production build, service restart, health checks, live reconciliation, and a read-only semantic/tool round trip.
