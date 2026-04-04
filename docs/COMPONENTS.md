# Components, Hooks & Stores

**Last updated:** 2026-04-01

## Component Tree

```
layout.tsx
  └── ThemeProvider (next-themes)
      └── QueryProvider (TanStack Query)
          └── page.tsx
              └── ChatShell
                  ├── Header (mode tabs, settings toggle, theme toggle)
                  ├── SidebarModern
                  │   ├── New conversation button
                  │   ├── Search input
                  │   └── Conversation list (relative dates, delete)
                  ├── ChatContainer
                  │   ├── WelcomeScreen (greeting, suggestion chips)
                  │   ├── MessageBubble[] (markdown, code blocks, copy, timestamps)
                  │   ├── TypingIndicator (OpenAI avatar, bounce dots)
                  │   └── Scroll-to-bottom button
                  ├── InputArea
                  │   ├── Auto-resize textarea
                  │   ├── Model dropdown (DropdownMenu)
                  │   ├── Reasoning dropdown (conditional)
                  │   └── Send / Stop buttons
                  └── SettingsDrawer (Sheet)
                      ├── Temperature slider (conditional)
                      ├── Max tokens slider
                      ├── Verbosity selector (GPT-5 only)
                      ├── Code Interpreter switch (conditional)
                      ├── Memory tab
                      └── Persona tab
```

## Key Components

### ChatShell (`components/layout/ChatShell.tsx`)
Main application shell. Manages sidebar toggle, splash screen, settings drawer, export button, and artifact panel.

### ChatContainer (`components/chat/ChatContainer.tsx`)
Renders the message list or WelcomeScreen when empty. Handles auto-scroll, scroll-to-bottom button, and suggestion chip injection via native setter pattern.

### MessageBubble (`components/chat/MessageBubble.tsx`)
Renders individual messages with:
- Markdown via `react-markdown` + `remark-gfm`
- `CodeBlock` sub-component with language header bar and copy button
- `CopyBtn` with tooltip and checkmark feedback
- Timestamps, reasoning summary collapsible
- Fade-in animation

### InputArea (`components/chat/InputArea.tsx`)
Floating card input with:
- Auto-resize textarea (scrollHeight-based)
- Model selector (shadcn DropdownMenu, shows name/badge/description)
- Reasoning effort selector (conditionally visible for reasoning models)
- Send button (gradient) / Stop button (destructive)

### SidebarModern (`components/sidebar/SidebarModern.tsx`)
Conversation list with:
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
| `ModelFamily` | `"gpt-5.1" \| "gpt-5" \| "gpt-4.1" \| "gpt-4o" \| "o-series" \| "dall-e"` |
| `ReasoningEffort` | `"none" \| "low" \| "medium" \| "high" \| "xhigh"` |
| `ReasoningSummary` | `"off" \| "auto" \| "concise" \| "detailed"` |
| `AppMode` | `"chat" \| "image"` |
| `TokenUsage` | inputTokens, outputTokens, cachedTokens?, totalCost |
| `ModelRecommendation` | modelId, reason, confidence |
