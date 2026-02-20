# Data Architecture

## 1. Data Persistence (Local-First Strategy)

The application employs a **Local-First** architecture using **Dexie.js**, a wrapper around the browser's **IndexedDB**.

### Database Schema
-   **Conversations Table:** Stores metadata about chat sessions (ID, title, timestamp, model used).
-   **Messages Table:** Stores individual messages linked to a conversation ID.
-   **Memories Table:** Stores long-term user facts injected into the context.

### Rationale
-   **Privacy:** User data remains on their device.
-   **Offline Capability:** The app can function (view history) without internet.
-   **Performance:** No network latency for loading history.

## 2. State Management

The application uses a hybrid state management approach:

### Global Ephemeral State (Zustand)
Used for UI state and active session data that doesn't need strict persistence or needs high-frequency updates.
-   **Store:** `stores/chatStore.ts`
-   **Scope:** Active Conversation ID, Current Message List (in-memory buffer), UI toggles.

### Server State (TanStack Query)
Used for asynchronous data operations, primarily interacting with the local Dexie DB (treating it as an async "server").
-   **Hooks:** `hooks/queries/useChatQuery.ts`, `useConversationQuery.ts`.
-   **Role:** Handles caching, refetching, and synchronization of database reads.

## 3. Data Flow

### Chat Interaction Flow
1.  **User Input:** User types in `InputArea`.
2.  **Optimistic UI:** `useChatStore` updates to show the user's message immediately.
3.  **API Request:** `useChat` hook sends the message + context to `/api/chat`.
4.  **Context Building:** Server (`api/chat`) calls `lib/openai/contextBuilder` to retrieve `Memories` and `CustomInstructions`.
5.  **Stream Handling:** Response streams back to the client.
6.  **Persistence:**
    -   Completed messages are saved to `Dexie` (IndexedDB).
    -   `TanStack Query` invalidates relevant queries to refresh the sidebar list.

## 4. Domain Models

Key TypeScript interfaces (`types/index.ts`):

-   **Message:** `{ id, role: 'user' | 'assistant', content, timestamp }`
-   **Conversation:** `{ id, title, createdAt, updatedAt, messages[] }`
-   **Memory:** `{ id, content, priority, isActive }`
