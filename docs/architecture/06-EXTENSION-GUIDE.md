# Extension & Evolution Guidelines

## 1. How to Add New Features

### adding a New UI Component
1.  **Locate Domain:** Decide if it belongs to `chat`, `canvas`, or `settings`. If generic, put it in `ui`.
2.  **Create Component:** Use Functional Components with TypeScript interfaces.
3.  **Style:** Use Tailwind CSS utility classes. Avoid inline styles.
4.  **Register:** Export from the index file of the directory if applicable.

### Adding a New API Endpoint
1.  **Create Route:** Add a folder in `app/api/` (e.g., `app/api/new-feature/route.ts`).
2.  **Implement Logic:** Use the Web Request/Response API.
3.  **Secure:** Add authentication checks.
4.  **Connect:** Create a fetcher function or React Query hook in `hooks/queries/`.

## 2. Coding Standards

### TypeScript
-   **Strict Mode:** Enabled. No `any` unless absolutely necessary.
-   **Interfaces:** Prefer `interface` over `type` for object definitions.
-   **Imports:** Use absolute imports (e.g., `@/components/...`) defined in `tsconfig.json`.

### React
-   **Hooks:** Use custom hooks to abstract complex logic.
-   **Server Components:** Default to Server Components where interactivity is not needed (App Router default). Add `'use client'` directive only when using hooks or event listeners.

## 3. Architecture Governance

-   **Colocation:** Keep related files close (e.g., specific hooks near the components that use them if they aren't shared).
-   **Unidirectional Data Flow:** Data flows down, actions flow up (or via Store).
-   **Library Constraints:**
    -   Do not add heavy libraries without checking bundle size impact.
    -   Prefer `lucide-react` for icons.
    -   Prefer `radix-ui` for complex interactive primitives.
