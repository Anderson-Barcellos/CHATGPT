# Core Architectural Components

## 1. Application Layer (`app/`)

The application follows the **Next.js App Router** convention.

- **Layouts (`layout.tsx`):** Defines the root structure, including `ThemeProvider`, `QueryProvider`, and global styles (`globals.css`, `gaucho-theme.css`).
- **Pages (`page.tsx`):** The entry point for the route. In this SPA-like architecture, the main `page.tsx` renders the primary `ChatInterface`.
- **API Routes (`api/`):**
    - `api/chat/`: Handles streaming responses from OpenAI.
    - `api/conversations/`: Persists and retrieves conversation history.
    - `api/memories/`: Persists reusable context snippets for prompt injection.
    - `api/persona/`: Persists user context and response preferences.

## 2. Component Architecture (`components/`)

Components are organized by **Feature Domain** rather than type (Atomic Design variation).

### Feature Domains
1.  **Workspace v2 (`components/workspace-v2/`)**
    -   **Responsibility:** Current primary application shell for Gaucho Chat.
    -   **Key Components:** `GauchoChatShellV2`, `WorkspaceFrameV2`, `ConversationRailV2`, `ChatCanvasV2`, `CommandComposerContainerV2`, `ContextPanelV2`.
    -   **Interaction:** Composes `useChat`, `useConversations`, `useChatStore`, `useSettingsStore`, and `useUIStore` into the visible workspace.
    -   **Layout Rule:** The top-level document keeps global overflow hidden. Scroll must live inside explicit internal viewports (`ScrollArea`, `min-h-0`, `flex-1`) for chat, conversation rail, and panel tabs.

2.  **Chat (`components/chat/`)**
    -   **Responsibility:** Renders the conversation stream and message-level interactions.
    -   **Key Components:** `MessageBubble`, `MessageContent`, `StreamingMarkdown`, `ChatMarkdown`, `ChatContainer`.
    -   **Interaction:** Consumes `useChatStore` for state and `useChat` hook for logic.
    -   **Streaming Invariant:** Assistant message rows are keyed by stable `message.id`. Completion-time data such as `artifact.id` must not be part of the React key, otherwise the bubble remounts when the artifact is attached and the buffered text can visually restart.

3.  **Artifacts (`components/artifacts/`)**
    -   **Responsibility:** Displays rich outputs such as documents, HTML artifacts, and quizzes.
    -   **Key Components:** `DocumentCanvas`, `QuizCanvas`, `ArtifactPanel`.
    -   **Workspace v2 Usage:** `ContextPanelV2` reuses artifact renderers in two ways: the **Canvas** tab provides a larger Markdown/HTML/quiz reading surface, while the **Artefato** tab keeps metadata, preview/source, and export-oriented controls.

4.  **Settings (`components/settings/`)**
    -   **Responsibility:** Manages user preferences, API keys, and model configuration.
    -   **Key Components:** `ModelSelector`, `SettingsDrawer`, `MemoryManager`.

5.  **Legacy Layout & Sidebar (`components/layout/`, `components/sidebar/`)**
    -   **Responsibility:** Older application shell and navigation components retained for compatibility/tests.
    -   **Key Components:** `ChatShell`, `SidebarModern`.
    -   **Current Status:** The active `/` route renders `GauchoChatShellV2` from `components/workspace-v2/`.

6.  **UI Primitives (`components/ui/`)**
    -   **Responsibility:** Low-level, reusable design system components.
    -   **Source:** Likely based on **shadcn/ui** (Radix UI + Tailwind).
    -   **Examples:** `button.tsx`, `dialog.tsx`, `scroll-area.tsx`.

## 3. Core Logic & Libraries (`lib/`)

The `lib/` directory contains the "Business Logic" of the application, decoupled from UI.

-   **OpenAI Integration (`lib/openai/`):**
    -   `contextBuilder.ts`: Orchestrates the construction of the system prompt, injecting user memories and custom instructions.
    -   `systemPrompt.ts`: Defines the base personality and rules for the AI.
-   **Storage (`lib/storage/`):**
    -   `conversations.ts`: Client-side repository helpers for conversation APIs.
    -   `memories.ts`: Client-side repository helpers for memory APIs.
-   **Utils (`lib/utils.ts`):** Common helper functions (e.g., `cn` for Tailwind class merging).
-   **Chat Streaming (`lib/chat/`):**
    -   `useStreamingTextBuffer.ts`: STT-style progressive reveal for assistant text.
    -   `streamMachine.ts`: Reduces Responses API stream events into message patches.
    -   `streamingMarkdown.ts` and `rehypeStreamingCursor.ts`: Cursor visibility and Markdown cursor injection during streaming.
-   **Server Helpers (`lib/server/`):** JWT authentication helpers and JSON file storage.

## 4. Hooks (`hooks/`)

Custom React Hooks enable separation of view logic from rendering.

-   `useChat.ts`: Main controller for chat interactions (sending messages, handling streams).
-   `useMemories.ts`: Interface for the Memory system.
-   `queries/*.ts`: React Query hooks for async state management.
