# Cross-Cutting Concerns Implementation

## 1. Authentication & Security

### Authentication
-   **Current State:** The project exposes simple password-based auth through `app/api/auth/*`, JWT cookies (`jose`), and guards in `proxy.ts` plus `app/page.tsx`.
-   **JWT:** The presence of `jose` in `package.json` indicates JSON Web Token handling for stateless session verification.

### Security Boundaries
-   **API Route Protection:** `proxy.ts` guards sensitive routes (like `/api/chat`) to prevent unauthorized usage of the LLM API quota.
-   **Environment Variables:** Sensitive keys (OpenAI API Key) are stored in server-side environment variables (`process.env`), never exposed to the client bundle.

## 2. Error Handling & Resilience

### Client-Side
-   **React Error Boundaries:** `app/error.tsx` provides a global fallback UI if the React tree crashes.
-   **Toast Notifications:** Uses `sonner` for ephemeral user feedback (e.g., "Failed to send message").
-   **Graceful Degradation:** The UI handles loading states (skeletons) via `React.Suspense` or conditional rendering.

### Server-Side
-   **Try/Catch Blocks:** API routes wrap external calls (OpenAI) in try/catch blocks.
-   **Status Codes:** Returns appropriate HTTP 4xx/5xx codes to trigger client-side handling.

## 3. Monitoring & Observability

### Current Tooling
-   **Build/validation:** runtime confidence currently comes from `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
-   **Operational checks:** `systemctl status chatgpt.service` and `/chat/api/health` are the main production sanity checks.

## 4. Configuration Management

-   **Environment Variables:**
    -   `NEXT_PUBLIC_APP_NAME`: Exposed to browser.
    -   `OPENAI_API_KEY`: Server-only.
-   **Runtime Config:** `next.config.ts` handles build-time configuration (headers, webpack optimizations).
