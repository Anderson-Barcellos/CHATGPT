# Architectural Overview

## 1. Architecture Detection and Analysis

### Project Type
**Detected Type:** **Next.js Full-Stack Application** (React/Node.js)

The project is a modern web application built using **Next.js 16 (App Router)**, leveraging **TypeScript** for type safety and **React 19** for the user interface. It acts as a sophisticated client for LLMs (OpenAI), with local persistence and state management.

### Architectural Pattern
**Detected Pattern:** **Hybrid Client-Server / Edge Architecture**

- **Client-Side:** Heavy emphasis on client-side interactivity using React hooks, Zustand for global state, and Dexie.js (IndexedDB) for offline-capable local storage.
- **Server-Side:** Uses Next.js API Routes (`app/api/`) as a backend-for-frontend (BFF) layer to proxy requests to AI providers, handle authentication, and manage edge-compatible logic.
- **Component-Based:** strict separation of concerns via React components (`components/`), split into feature domains (`chat`, `canvas`, `settings`).

## 2. Architectural Overview

### Design Principles
1.  **Privacy & Local-First:** The usage of `Dexie.js` implies a design decision to keep conversation history local to the user's browser, enhancing privacy and reducing server storage costs.
2.  **Responsive & Modern UI:** Utilization of `Tailwind CSS 4` and `Radix UI` primitives ensures a high-performance, accessible, and responsive interface that mimics the "native" feel of modern AI chat applications.
3.  **Modular Feature Slicing:** Features like "Canvas", "Chat", and "Settings" are encapsulated, allowing for independent evolution.
4.  **Performance:** Explicit configuration in `next.config.ts` for chunk splitting and `lazy` loading components indicates a focus on Core Web Vitals and fast TTI (Time to Interactive).

### System Boundaries
- **Frontend Boundary:** Browser (React App). Handles UI, local state, and direct user interaction.
- **API Boundary:** Next.js API Routes. Handles secure communication with OpenAI, token management, and telemetry.
- **External Boundary:** OpenAI API (LLM provider), Sentry (Monitoring).

## 3. Technology Stack

### Core
- **Framework:** Next.js 16.1.6
- **Language:** TypeScript 5+
- **Library:** React 19.2.3

### State & Data
- **Global State:** Zustand (`stores/`)
- **Server State / Fetching:** TanStack Query (`@tanstack/react-query`)
- **Persistence:** Dexie.js (`dexie`, `dexie-react-hooks`)

### UI & Styling
- **Styling:** Tailwind CSS 4 (`postcss`, `tailwind-merge`)
- **Components:** Radix UI primitives (`@radix-ui/*`)
- **Icons:** Lucide React
- **Editor:** Monaco Editor (`@monaco-editor/react`) for code blocks.

### Utilities
- **AI Integration:** OpenAI Node.js SDK
- **Date/Time:** Native JS / Utils
- **Security:** `jose` (JWT)

### DevOps
- **Containerization:** Docker
- **Monitoring:** Sentry (`@sentry/nextjs`)
- **Linting:** ESLint
