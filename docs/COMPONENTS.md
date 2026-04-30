# Components, Hooks & Stores

**Last updated:** 2026-04-29

## Component Tree

```
layout.tsx
  └── ThemeProvider (next-themes)
      └── QueryProvider (TanStack Query)
          └── page.tsx
              └── GauchoChatShellV2
                  ├── WorkspaceFrameV2
                  │   ├── ConversationRailV2 (desktop + mobile sheet)
                  │   ├── ChatCanvasV2
                  │   │   └── ChatContainer
                  │   │       ├── WelcomeScreen
                  │   │       ├── MessageBubble[]
                  │   │       ├── TypingIndicator
                  │   │       └── Scroll-to-bottom button
                  │   ├── CommandComposerContainerV2
                  │   │   └── CommandComposerV2
                  │   └── ContextPanelV2 (Canvas, Artefato, Atividade, Notas)
                  └── SettingsDrawer
```

## Key Components

### GauchoChatShellV2 (`components/workspace-v2/GauchoChatShellV2.tsx`)
Current main application shell. It wires `useChat`, `useConversations`, settings state, artifact state, splash handling, and recovery state into the workspace v2 layout.

### WorkspaceFrameV2 (`components/workspace-v2/WorkspaceLayoutV2.tsx`)
Three-region workspace frame:
- conversation rail on the left
- chat canvas and command composer in the center
- right-side operational panel with collapse/expand controls

The frame uses `--v2-*` CSS tokens from `app/globals.css` instead of forcing the `dark` class. Light and dark themes therefore diverge through variables rather than component branches.

### ConversationRailV2 (`components/workspace-v2/ConversationRailV2.tsx`)
Conversation navigation for workspace v2:
- create conversation
- search
- filter tabs
- grouped conversation sections
- active state
- guarded switching/deletion while streaming
- internal `ScrollArea` with `min-h-0`/`flex-1` so the rail scrolls inside the fixed-height shell

### ChatContainer (`components/chat/ChatContainer.tsx`)
Renders the message list or `WelcomeScreen` when empty. Handles auto-scroll, scroll-to-bottom button, and suggestion chip injection via native setter pattern.

Message rows are keyed by stable `message.id` only. Do not include `artifact.id` or other completion-time data in the React key: streamed assistant bubbles must stay mounted when `streamStatus` changes or when an artifact is attached, otherwise the streaming buffer can appear to restart from the beginning.

### MessageBubble (`components/chat/MessageBubble.tsx`)
Renders individual messages with:
- role-specific token-backed bubble surfaces (`v2-user-bubble`, `v2-assistant-bubble`)
- attachments
- citations
- timestamps
- edit/delete menu and long-press behavior
- `MessageActions`
- `ReasoningPanel`

The bubble delegates text, streaming, artifacts, images, rich content, document mode, and quiz mode to `MessageContent`.

### MessageContent (`components/chat/MessageContent.tsx`)
Routes message body rendering:
- streaming assistant text through `StreamingMarkdown`
- completed assistant text through `ChatMarkdown`
- document/quiz artifacts through `DocumentCanvas` or `QuizCanvas`
- image generation output through an inline image
- rich Markdown/HTML through panel-opening artifact helpers

Inline artifact visibility is tracked per `artifact.id` without a synchronous state-setting effect. When a document/quiz artifact appears after streaming, the same mounted message component expands it without resetting the buffered text.

When `streamStatus === "interrupted"`, renders an inline orange banner (`AlertTriangle`) with the message "Resposta interrompida — pode regenerar pra completar."

### StreamingMarkdown (`components/chat/StreamingMarkdown.tsx`)
Renders assistant streaming text with the STT-style buffer from `useStreamingTextBuffer`. The hook incrementally reveals `content` while `streamStatus === "streaming"` and keeps a short cursor settle after completion. It expects its parent bubble to remain mounted across completion.

### ContextPanelV2 (`components/workspace-v2/ContextPanelV2.tsx`)
Right-side operational panel with four tabs:
- **Canvas:** default tab; renders the active or latest artifact in a larger reading/production surface using `DocumentCanvas`, `ChatMarkdown`, `HtmlPreview`, or `QuizCanvas`
- **Artefato:** metadata, preview/source, and export-oriented view
- **Atividade:** timeline and conversation execution summary
- **Notas:** per-conversation workspace notes persisted server-side

### CommandComposerContainerV2 (`components/workspace-v2/CommandComposerContainerV2.tsx`)
Container for the current composer. It manages text input, file attachments, speech-to-text, model selection, reasoning selection, document mode, quiz mode, and send/stop behavior.

### SidebarModern (`components/sidebar/SidebarModern.tsx`)
Legacy conversation list used by the older `ChatShell`. It is still present and tested, but workspace v2 uses `ConversationRailV2`.

Features:
- `relativeDate()` helper (agora/5min/2h/3d/2sem/3m)
- Search filtering
- Empty state illustration
- Delete with hover color change

### SettingsDrawer (`components/settings/SettingsDrawer.tsx`)
Full settings panel for tuning, memory, and persona. The tuning tab now renders controls conditionally from the current model capabilities.

---

## Zustand Stores

### uiStore (`stores/uiStore.ts`)

| State | Type | Purpose |
|-------|------|---------|
| `activeMode` | `"chat" \| "image"` | Current mode tab |
| `imageSize` | string | DALL-E image dimensions |
| `imageQuality` | string | DALL-E quality level |

### chatStore (`stores/chatStore.ts`)

| State | Type | Purpose |
|-------|------|---------|
| `activeConversationId` | `string \| null` | Currently active conversation |
| `messages` | `Message[]` | Messages for active conversation |

Actions: `setActiveConversationId`, `setMessages`, `addMessage`, `updateMessage`, `clearMessages`

### settingsStore (`stores/settingsStore.ts`)

| State | Type | Purpose |
|-------|------|---------|
| `parameters` | `ModelParameters` | Active model + effective settings for that model |
| `modelSettingsById` | `Record<string, ModelScopedParameters>` | Per-model tuning memory |
| `customInstructions` | `CustomInstructions \| null` | User context + response preferences |
| `memories` | `Memory[]` | Active memories for context injection |

Default model: `gpt-5.3-chat-latest`, temperature: 0.8, topP: 0.95, maxOutputTokens: 16384, verbosity: medium, code interpreter: off

---

## Custom Hooks

### useChat (`hooks/useChat.ts`)
Core chat logic. Manages message send/receive cycle with SSE streaming.

| Return | Type | Purpose |
|--------|------|---------|
| `messages` | `Message[]` | Current conversation messages |
| `isLoading` | boolean | Generation in progress |
| `error` | `string \| null` | Last error message |
| `sendMessage(content)` | function | Send user message and stream response |
| `stopGeneration()` | function | Abort current generation |

Internally handles: `buildInputFromMessages`, `buildReasoningConfig`, `buildSystemPrompt`, SSE parsing, IndexedDB persistence.

**Incremental persistence (5 defensive rings):**
1. Flush user message + assistant placeholder to server synchronously before fetch.
2. Throttled auto-save (2 s interval via `createThrottle`) during the stream loop.
3. `beforeunload`/`pagehide` listener that aborts the `AbortController` and calls `saveConversationMessagesViaBeacon` (POST via `navigator.sendBeacon`, fallback `fetch keepalive`).
4. `useEffect` on mount normalises any message with `streamStatus === "streaming"` to `"interrupted"` and re-persists — recovers from mid-stream reload.
5. (Server-side) `signal: request.signal` forwarded to OpenAI SDK; stream aborts when client disconnects.

### useCustomInstructions (`hooks/useCustomInstructions.ts`)

| Return | Type | Purpose |
|--------|------|---------|
| `contextAboutUser` | `string` | Extra context about the user |
| `responsePreferences` | `string` | Style and formatting preferences |
| `saveContextAboutUser()` | function | Save current draft to the server |

### useMemories (`hooks/useMemories.ts`)

| Return | Type | Purpose |
|--------|------|---------|
| `memories` | `Memory[]` | All memories (sorted by priority) |
| `addMemory(data)` | function | Create new memory |
| `updateMemory(id, updates)` | function | Update memory |
| `deleteMemory(id)` | function | Delete memory |

### useConversations (`hooks/useConversations.ts`)
CRUD operations for conversation list, search, create, delete, switch.

### useExport (`hooks/useExport.ts`)
Export current conversation in Markdown, JSON, PDF, or clipboard formats.

---

## shadcn/ui Components (23)

Located in `components/ui/`:

alert, badge, button, card, collapsible, dialog, dropdown-menu, icons, input, label, scroll-area, select, separator, sheet, slider, switch, tabs, textarea, theme-toggle, tooltip

Plus custom:
- `icons.tsx` — OpenAI SVG logo component (`OpenAIIcon`)
- `theme-toggle.tsx` — Dark/light mode toggle button

---

## TypeScript Types

### Core types (`types/index.ts`)

| Type | Key Fields |
|------|-----------|
| `Message` | id, role, content, timestamp, reasoningSummary?, reasoningText?, imageBase64? |
| `Conversation` | id, title, messages[], createdAt, updatedAt |
| `ModelParameters` | model, maxOutputTokens, temperature, topP, systemPrompt, reasoningEffort, reasoningSummary, verbosity, codeInterpreterEnabled |
| `ModelScopedParameters` | maxOutputTokens, temperature, topP, reasoningEffort, reasoningSummary, verbosity, codeInterpreterEnabled |
| `CustomInstructions` | id, contextAboutUser, responsePreferences |
| `Memory` | id, content, category, isActive, priority, createdAt, updatedAt |
| `ModelInfo` | id, name, family, description, contextWindow, maxOutput, pricing, capabilities[], supportsTemperature, supportsVerbosity, supportsCodeInterpreter, supportsStreaming, badge? |
| `ModelFamily` | `"gpt-5" \| "gpt-4.1" \| "gpt-4o" \| "o-series" \| "dall-e" \| "gpt-image"` |
| `ReasoningEffort` | `"none" \| "low" \| "medium" \| "high" \| "xhigh"` |
| `ReasoningSummary` | `"off" \| "auto" \| "concise" \| "detailed"` |
| `AppMode` | `"chat" \| "image"` |
| `TokenUsage` | inputTokens, outputTokens, cachedTokens?, totalCost |
| `ModelRecommendation` | modelId, reason, confidence |
| `MessageStreamStatus` | `"streaming" \| "completed" \| "aborted" \| "failed" \| "interrupted"` — `aborted` = user stop, `interrupted` = connection drop/reload mid-stream, `failed` = API error |

### Utility: createThrottle (`lib/performance/throttle.ts`)

Imperative (non-React) throttle factory. Returns `{ call, flush, cancel }`.
- `call(value)` — invokes `fn` at most once per `intervalMs`; later calls within the interval are queued and emitted on the next tick
- `flush()` — forces immediate emit of the pending value
- `cancel()` — discards any pending call

Used in `useChat.ts` for the 2 s auto-save during streaming. Reusable for any side-effect throttling (telemetry, auto-save in other flows).
