# Celer Chat

Multimodal chat application built with `Next.js 16`, `React 19`, `TypeScript`, `Zustand`, `TanStack Query`, and the OpenAI `Responses API`.

The project focuses on a ChatGPT-like experience with conversation history, reasoning display, model selection, prompt tuning, persistent memory, artifact rendering, and polished mobile/PWA behavior.

## Highlights

- Real-time chat experience with streaming responses and incremental persistence (auto-save throttled during stream, beacon on unload, interrupted-stream recovery on load)
- Dedicated reasoning panel with explicit state transitions
- Conversation history with editing and deletion flows
- Model picker with support for `gpt-5.1-chat-latest` (default), `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-5.1`, `gpt-4.1`, and `o3`
- Persistent memory and custom instructions stored server-side
- Workspace v2 shell with conversation rail, chat canvas, command composer, and right-side operational panel
- Artifact rendering flows, including Markdown, HTML, quiz, source download, print, and PDF export
- Mobile-first shell refinements for Safari and installed PWA usage
- Server-side JSON persistence for conversations, memories, and persona (`data/*.json`)

## Tech Stack

- `Next.js 16` with App Router
- `React 19`
- `TypeScript`
- `Tailwind CSS 4`
- `Zustand`
- `@tanstack/react-query`
- `Radix UI`
- `OpenAI Node SDK`
- `Vitest`

## Project Structure

```text
app/
  api/
    auth/                Authentication endpoints
    chat/                Server-side OpenAI proxy
    conversations/       Conversation CRUD
    memories/            Memory CRUD
    persona/             Custom instructions endpoint
    transcribe/          Audio transcription endpoint
components/
  artifacts/             Artifact viewers and export entry points
  chat/                  Main chat experience (bubbles, reasoning, composer)
  settings/              Persona and memory settings
  workspace-v2/          Gaucho Chat workspace shell, conversation rail, and Canvas panel
hooks/
  useChat.ts             Streaming chat orchestration
lib/
  artifacts/             Artifact generation/parsing helpers
  export/                PDF and export utilities
  models/                Model catalog and selector metadata
data/
  conversations.json     Local conversation persistence
  memories.json          Local memory persistence
  persona.json           Persona bootstrap persistence
```

## Current Product Areas

### Chat

- Streaming responses with reasoning state handling
- Markdown rendering with code, math, and rich formatting support
- Message actions for editing, exporting, and artifact handling
- Stable assistant bubble mounting during stream completion so the buffered text does not restart when an artifact is attached
- Improved mobile composer behavior and safe-area handling

### Sidebar and Navigation

- Workspace v2 conversation rail with clearer active state, filters, search, and fixed internal scrolling
- Safer delete flow for the currently open conversation
- Shared panel sizing between conversation sidebar and settings drawer

### Settings

- Persona/custom instructions and TTS preferences persisted through `/api/persona`
- Memory management persisted through `/api/memories`
- Inline editing and autosave behavior for settings workflows

### Artifacts and Export

- Artifact preview sheet opened from the chat canvas for document-like outputs
- Context panel tracks activity and notes per conversation
- PDF export tuned for cleaner layout and OpenAI-branded header
- Support for document and quiz-oriented artifact rendering

## API Endpoints

- `GET/POST /api/chat`
- `GET/POST /api/conversations`
- `GET/PUT/POST/PATCH/DELETE /api/conversations/[id]`
- `GET/POST /api/memories`
- `PATCH/DELETE /api/memories/[id]`
- `GET/PUT /api/persona`
- `POST /api/artifacts/pdf`
- `POST /api/tts`
- `POST /api/realtime/tts-call`
- `POST /api/transcribe`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/check`
- `GET /api/health`

## Local Development

### Requirements

- `Node.js 20+`
- `npm`

### Install

```bash
npm install
```

### Run in development

```bash
npm run dev
```

The development server uses port `3040` by default.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm test
npx tsc --noEmit
```

## Validation Checklist

Before shipping a change, the repo is typically validated with:

```bash
npm test
npm run build
npx tsc --noEmit
npm run lint
```

Run only the commands that are applicable to the current change if you are doing a narrow, documentation-only update.

## Infrastructure Notes

- The canonical service configuration is documented in `systemd/chatgpt.service`
- Additional infrastructure notes live in `docs/INFRASTRUCTURE.md`
- If you are also managing Apache or reverse proxy behavior, check the repo's infrastructure docs before changing ports or service bindings

## Notes

- Local JSON files in `data/` are used for simple persistence during development and server-side flows
- The repository also contains project-specific operational guidance in `AGENTS.md`
- If you need to adjust the OpenAI model catalog, start with `lib/models/modelConfig.ts`
