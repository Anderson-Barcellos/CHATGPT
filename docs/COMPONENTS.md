# Components, Hooks & Stores

**Last updated:** 2026-05-24

## Runtime component tree

```text
app/layout.tsx
  └── QueryProvider
      └── ThemeProvider
          └── app/page.tsx
              └── GauchoChatShellV2
                  ├── WorkspaceFrameV2
                  │   ├── ConversationRailV2
                  │   ├── ChatCanvasV2
                  │   │   ├── ChatContainer
                  │   │   │   └── MessageBubble[]
                  │   │   └── ArtifactPreviewSheet
                  │   ├── CommandComposerContainerV2
                  │   │   └── CommandComposerV2
                  │   └── ContextPanelV2
                  ├── SettingsDrawer
                  ├── SelectionToolbar
                  └── CommandPalette
```

## Key components

### `components/workspace-v2/GauchoChatShellV2.tsx`

Main shell for `/`. Wires chat flow (`useChat`), conversation list, settings, context panel behavior, splash lifecycle, and command palette.

### `components/workspace-v2/WorkspaceLayoutV2.tsx`

Defines the frame and composer layout primitives:

- desktop + tablet + mobile region orchestration
- context panel collapse/expand
- header chips (model, reasoning, mode, artifacts)
- mobile sheets for sidebar/context

### `components/workspace-v2/ConversationRailV2.tsx`

Conversation navigation with:

- search and filter tabs
- grouped sections (`Hoje`, `Ontem`, `Esta semana`, `Arquivadas`)
- pin/unpin and delete actions
- streaming guards while generation is active

### `components/chat/ChatContainer.tsx`

Renders the active message list and manages scroll behavior (including "scroll to bottom" affordances).

### `components/chat/MessageBubble.tsx`

Message row renderer with quick actions, edit/delete controls, artifacts, and reasoning panel support.

Important invariant: assistant bubbles stay keyed by stable `message.id` only.

### `components/chat/MessageContent.tsx`

Routes message body rendering for:

- streaming markdown
- completed markdown
- image outputs
- document/quiz artifact previews
- interrupted/aborted/failed stream states

### `components/workspace-v2/ContextPanelV2.tsx`

Right panel with 2 tabs:

- `Atividade` (timeline/status summary)
- `Notas` (workspace notes per conversation)

### `components/workspace-v2/canvas/ArtifactPreviewSheet.tsx`

Artifact sheet opened from the chat canvas, reusing shared print/PDF/download actions for document and quiz outputs.

### Canvas contract (`lib/artifacts/canvasContract.ts`)

Canvas content editing is explicitly locked (`viewer-only`).

- document artifacts: read-only preview/source
- quiz artifacts: interactive session (answers) without content editing

### `components/settings/SettingsDrawer.tsx`

Settings UI for model tuning, memories, persona instructions, theme toggle, and image-mode options.

## Chat states

`MessageStreamStatus` (`types/index.ts`):

- `streaming`
- `completed`
- `aborted`
- `failed`
- `interrupted`

## Custom hooks (active runtime)

- `hooks/useChat.ts` - chat orchestration, streaming reducer, persistence, abort handling
- `hooks/useConversations.ts` - list/create/delete wrappers
- `hooks/queries/useConversationQuery.ts` - TanStack Query keys + mutations
- `hooks/useCustomInstructions.ts` - persona load/autosave via `/api/persona`
- `hooks/useMemories.ts` - memory CRUD via `/api/memories`
- `hooks/useFileAttachments.ts` - composer file pipeline
- `hooks/useSpeechToText.ts` - microphone/transcription flow
- `hooks/useTextSelection.ts` - selection toolbar behavior
- `hooks/useExport.ts` - markdown/json/pdf/clipboard exports

## Zustand stores

### `stores/chatStore.ts`

Active conversation and in-memory message stream state:

- `activeConversationId`
- `messages`
- `isStreaming`

### `stores/settingsStore.ts`

Model-scoped tuning + persona + memories:

- `parameters`
- `modelSettingsById`
- `customInstructions`
- `memories`

Default model: `gpt-5.1-chat-latest`.

### `stores/uiStore.ts`

UI mode and artifact/panel state:

- `activeMode` (`chat` / `image`)
- `imageSize`, `imageQuality`
- `activePanelTab`
- `activeSelection`
- `artifactOpen`, `activeArtifact`, `artifactMessageId`

## UI primitives in use

`components/ui/` currently contains:

- `badge`, `button`, `card`, `collapsible`, `confirm-dialog`, `dialog`
- `dropdown-menu`, `gpt-logo`, `icons`, `input`, `scroll-area`, `sheet`
- `slider`, `splash-screen`, `switch`, `tabs`, `textarea`, `theme-toggle`, `tooltip`
