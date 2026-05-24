# Core Architectural Components

## 1. Application Layer (`app/`)

The project uses the Next.js App Router.

- **`app/layout.tsx`**: global frame (`QueryProvider`, `ThemeProvider`, global CSS, toaster, service-worker registration).
- **`app/page.tsx`**: authenticated entrypoint that renders `GauchoChatShellV2`.
- **`app/api/*`**: BFF routes for chat, conversations, memories, persona, auth, health, and transcription.

## 2. Feature Domains (`components/`)

### 2.1 Workspace v2 (`components/workspace-v2/`)

Current primary shell.

- **Key components:** `GauchoChatShellV2`, `WorkspaceFrameV2`, `ConversationRailV2`, `ChatCanvasV2`, `ArtifactPreviewSheet`, `CommandComposerContainerV2`, `ContextPanelV2`.
- **Layout contract:** document-level overflow is hidden; scroll happens in explicit internal containers (`ScrollArea` + `min-h-0` + `flex-1`).

### 2.2 Chat (`components/chat/`)

Message rendering and interaction pipeline.

- **Key components:** `ChatContainer`, `MessageBubble`, `MessageContent`, `StreamingMarkdown`, `ChatMarkdown`, `ReasoningPanel`, `QuickActionsBar`, `SelectionToolbar`.
- **Streaming invariant:** assistant rows must keep stable key `message.id` to avoid remounting buffered streaming text.

### 2.3 Artifacts (`components/artifacts/`)

Artifact renderers reused by message and panel contexts.

- **Key components:** `DocumentCanvas`, `QuizCanvas`.

### 2.4 Settings (`components/settings/`)

User tuning and preferences.

- **Key component:** `SettingsDrawer`.

### 2.5 UI primitives (`components/ui/`)

shadcn/Radix-based primitives (`button`, `sheet`, `tabs`, `dropdown-menu`, etc.) plus project-specific primitives such as `gpt-logo` and `splash-screen`.

## 3. Core logic (`lib/`)

- **`lib/chat/`**: stream reducer (`streamMachine.ts`), buffered text flow (`useStreamingTextBuffer.ts`), composer and abort helpers.
- **`lib/openai/`**: input/system-prompt builders for Responses API.
- **`lib/storage/`**: client adapters for conversations/memories/persona persistence.
- **`lib/server/`**: auth helpers, request body guards, JSON file store helpers.
- **`lib/models/`**: model catalog and capability helpers.
- **`lib/artifacts/`**: artifact creation/parsing/export helpers.

## 4. Hooks (`hooks/`)

- **`useChat`**: streaming orchestration and recovery logic.
- **`useConversations` + `hooks/queries/useConversationQuery`**: list/detail/mutations and query cache invalidation.
- **`useCustomInstructions`**: autosave persona flow.
- **`useMemories`**: memory CRUD flow.
- **Support hooks:** attachments, speech-to-text, text selection, export.

## 5. Runtime middleware (`proxy.ts`)

Applies authentication gates, selective rate limiting, and security headers before route handlers.
