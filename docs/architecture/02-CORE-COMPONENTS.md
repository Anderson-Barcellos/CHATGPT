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
1.  **Chat (`components/chat/`)**
    -   **Responsibility:** Renders the conversation stream.
    -   **Key Components:** `MessageBubble`, `ChatContainer`, `InputArea`.
    -   **Interaction:** Consumes `useChatStore` for state and `useChat` hook for logic.

2.  **Artifacts (`components/artifacts/`)**
    -   **Responsibility:** Displays rich outputs such as documents and HTML artifacts in a dedicated side panel.
    -   **Key Components:** `ArtifactPanel`, `DocumentCanvas`.

3.  **Settings (`components/settings/`)**
    -   **Responsibility:** Manages user preferences, API keys, and model configuration.
    -   **Key Components:** `ModelSelector`, `SettingsDrawer`, `MemoryManager`.

4.  **Layout & Sidebar (`components/layout/`, `components/sidebar/`)**
    -   **Responsibility:** Application shell and navigation.
    -   **Key Components:** `Sidebar`, `ChatShell`.

5.  **UI Primitives (`components/ui/`)**
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
-   **Server Helpers (`lib/server/`):** JWT authentication helpers and JSON file storage.

## 4. Hooks (`hooks/`)

Custom React Hooks enable separation of view logic from rendering.

-   `useChat.ts`: Main controller for chat interactions (sending messages, handling streams).
-   `useMemories.ts`: Interface for the Memory system.
-   `queries/*.ts`: React Query hooks for async state management.
