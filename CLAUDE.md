# 🧉 Gaúcho Chat - Complete Project Reference

> **Cliente IA Multi-Modal de última geração com GPT-5.1, o3, o4-mini, DALL-E e mais**
> Stack: Next.js 16.1.6 (Turbopack) • React 19 • TypeScript • Tailwind v4 • shadcn/ui

## 📍 Quick Access

| Service | Details |
|---------|---------|
| **Production URL** | https://ultrassom.ai/chat |
| **Local Dev** | http://localhost:3040/chat |
| **Port** | 3040 |
| **Base Path** | `/chat` |
| **Service Name** | `chatgpt.service` |
| **Auth Password** | `ultrassom2024` |
| **API Key** | Check `.env.production` |

### Essential Commands
```bash
# Service management
sudo systemctl status chatgpt      # Check status
sudo systemctl restart chatgpt     # Restart
sudo journalctl -u chatgpt -f      # Live logs

# Development
npm run dev                         # Start dev server
npm run build                       # Production build
npm run lint                        # ESLint check
npx tsc --noEmit                    # TypeScript check

# Troubleshooting
sudo fuser -k -9 3040/tcp          # Kill port 3040
tail -f /var/log/chatgpt/error.log # Error logs
```

## 🏗️ Architecture Overview

### Tech Stack Details
- **Framework**: Next.js 16.1.6 with Turbopack (experimental features enabled)
- **UI Library**: React 19 with Server Components
- **Styling**: Tailwind CSS v4 (oklch colors) + shadcn/ui components
- **State Management**:
  - Zustand (client state)
  - TanStack Query (server state)
  - Dexie (IndexedDB persistence)
- **AI Integration**: OpenAI SDK v6 (streaming SSE)
- **Auth**: Apache Basic Auth (htpasswd) + JWT sessions (jose)
- **Deployment**: Systemd service + Apache reverse proxy

### Core Features
- ✅ **Multi-Model Support**: GPT-5.1, GPT-5.1 Pro, GPT-4.1, GPT-4o, o3, o4-mini, DALL-E 3, GPT Image 1.5
- ✅ **Image Generation**: Via Responses API tool (model decides when to generate)
- ✅ **Rich Content Rendering**: Markdown, HTML/JS execution, syntax highlighting
- ✅ **Reasoning Models**: Special handling for o-series with effort levels
- ✅ **Memory System**: Persistent user preferences and context
- ✅ **Custom Instructions**: Additional instructions field (optional)
- ✅ **Fixed System Prompt**: BASE_SYSTEM_PROMPT always sent (lib/prompts/systemPrompt.ts)
- ✅ **Authentication**: Apache Basic Auth (htpasswd) + JWT sessions (jose, httpOnly cookies)
- ✅ **Message Editing**: Edit & resend user messages
- ✅ **Rate Limiting**: Configurable per-endpoint limits
- ✅ **Dark/Light Theme**: System-aware with manual override

## 📁 Project Structure

```
/root/CHATGPT/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Home page (ChatShell)
│   ├── login/                    # Auth page
│   │   └── page.tsx              # Login form with password
│   ├── layout.tsx                # Root layout with providers
│   ├── globals.css               # Tailwind + custom styles
│   ├── error.tsx                 # Error boundary
│   └── api/                      # API routes
│       ├── chat/                 # Main chat endpoint (streaming)
│       ├── conversations/        # Conversation CRUD
│       │   ├── route.ts          # GET list / POST create
│       │   ├── [id]/route.ts     # GET / PUT / DELETE by ID
│       │   └── data.ts           # Server-side JSON persistence
│       ├── auth/                 # Login/logout/check
│       │   ├── login/            # POST login (JWT)
│       │   ├── logout/           # POST logout
│       │   └── check/            # GET session check
│       └── health/               # Health check
│
├── components/                    # React components
│   ├── layout/
│   │   └── ChatShell.tsx         # Main app container
│   ├── chat/
│   │   ├── ChatContainer.tsx     # Message list + scroll + welcome
│   │   ├── MessageBubble.tsx     # Individual message UI + edit
│   │   ├── MessageContent.tsx    # Rich content renderer
│   │   ├── InputArea.tsx         # Text input + model selector
│   │   ├── CodeBlock.tsx         # Syntax highlighted code
│   │   ├── ExportMenu.tsx        # Export dropdown (MD/JSON/PDF/Clipboard)
│   │   └── TypingIndicator.tsx   # AI typing animation
│   ├── artifacts/
│   │   └── ArtifactPanel.tsx     # Rich content artifact viewer
│   ├── canvas/
│   │   └── RichContentViewer.tsx # Document/HTML viewer (sandboxed)
│   ├── providers/
│   │   ├── QueryProvider.tsx     # TanStack Query provider
│   │   └── ThemeProvider.tsx     # next-themes provider
│   ├── sidebar/
│   │   └── SidebarModern.tsx     # Conversation list + search
│   ├── settings/
│   │   ├── SettingsDrawer.tsx    # Full settings panel (3 tabs)
│   │   ├── MemoryManager.tsx     # Memory CRUD interface
│   │   ├── CustomInstructions.tsx # User context + preferences
│   │   ├── PersonalizationPanel.tsx # Persona tab wrapper
│   │   └── PromptPreview.tsx     # System prompt preview + token count
│   └── ui/                       # shadcn/ui primitives
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── dropdown-menu.tsx
│       └── ... (30+ components)
│
├── lib/                          # Utilities & business logic
│   ├── models/
│   │   └── modelConfig.ts        # AI model definitions
│   ├── openai/
│   │   ├── buildInput.ts         # Message formatting
│   │   └── contextBuilder.ts     # System prompt assembly
│   ├── prompts/
│   │   └── systemPrompt.ts       # Base intelligent prompt
│   ├── storage/
│   │   ├── db.ts                 # Dexie database schema
│   │   ├── conversations.ts      # Client-side API wrappers (fetch → /api/conversations)
│   │   ├── settings.ts           # Settings persistence (Dexie)
│   │   └── memory.ts             # Memory CRUD (Dexie)
│   ├── security/
│   │   └── rateLimit.ts          # Rate limiting (sliding window, per-endpoint)
│   ├── export/                   # Export utilities
│   │   ├── markdown.ts
│   │   ├── json.ts               # JSON export/import with validation
│   │   ├── pdf.ts
│   │   └── clipboard.ts          # Multi-format clipboard (md/plain/html)
│   ├── performance/
│   │   └── debounce.ts           # useDebounce, useDebouncedSearch hooks
│   ├── utils/
│   │   └── tokenEstimate.ts      # Token estimation (length/4 heuristic)
│   └── utils.ts                  # Common helpers (cn, apiUrl)
│
├── hooks/                        # Custom React hooks
│   ├── useChat.ts                # Main chat logic + SSE streaming
│   ├── useConversations.ts       # Conversation management wrapper
│   ├── useMemories.ts            # Memory CRUD (Dexie live query)
│   ├── useCustomInstructions.ts  # User preferences persistence
│   ├── useExport.ts              # Multi-format export with progress
│   ├── useModelCapabilities.ts   # Model analysis, cost estimation, recommendations
│   ├── useSwipeGesture.ts        # Mobile swipe for sidebar
│   └── queries/
│       ├── index.ts              # Barrel exports
│       └── useConversationQuery.ts # TanStack Query hooks (optimistic updates)
│
├── stores/                       # Zustand stores
│   ├── chatStore.ts              # Messages, active conversation
│   ├── settingsStore.ts          # Model params, preferences
│   └── uiStore.ts                # UI state (theme, mode)
│
├── types/                        # TypeScript definitions
│   ├── index.ts                  # Main types (Message, Conversation, ModelInfo, Memory)
│   ├── canvas.ts                 # Canvas-specific types
│   └── monaco.d.ts               # Monaco editor global types
│
├── middleware.ts                 # Next.js middleware (auth, rate limit)
├── next.config.ts                # Next.js configuration
├── tailwind.config.ts            # Tailwind v4 setup
├── tsconfig.json                 # TypeScript config
├── package.json                  # Dependencies
├── components.json               # shadcn/ui config
│
├── systemd/
│   └── chatgpt.service           # Systemd service file
├── apache-config/                # Apache reverse proxy
├── docs/                         # Extended documentation
├── scripts/                      # Utility scripts
└── .env.production               # Production environment

```

## 🔄 Data Flow Architecture

### 1. Chat Message Flow (text + image unified)
```mermaid
User Input → InputArea → sendMessage() → useChat hook → API /chat → OpenAI Responses API
→ SSE Stream (text deltas + image_generation_call events)
→ useChat parser → chatStore → MessageBubble/MessageContent → Display
```
Image generation uses `tools: [{type: "image_generation"}]` in the Responses API.
The model decides when to generate images. Stream events include:
- `response.image_generation_call.partial_image` (progressive preview)
- `response.output_item.done` with `item.type === "image_generation_call"` (final base64)

### 2. State Management Layers
- **UI State** (uiStore): Theme, active mode, artifact viewer state
- **Chat State** (chatStore): Messages, active conversation ID
- **Settings** (settingsStore): Model params, custom instructions, memories (default model: `gpt-5.3-chat-latest`, temperature: `0.8`, topP: `0.95`)
- **Client Persistent** (Dexie/IndexedDB): Settings, memories
- **Server Persistent** (`data/conversations.json`): Conversations (filesystem JSON, accessed via `/api/conversations`)

### 3. Dual Persistence Architecture
```
Client (Dexie IndexedDB) ← Settings, Memories
Client (fetch) → /api/conversations → Server (data/conversations.json)
```
Conversations are stored server-side in a JSON file. Client-side `lib/storage/conversations.ts` wraps fetch calls to the API. Settings and memories use Dexie directly (client-only).

### 4. Authentication Flow
```
Request → Apache Basic Auth (htpasswd) → Reverse Proxy → Next.js app
         ↓ (fallback when Apache auth disabled)
         → POST /api/auth/login → JWT token (jose, 7-day httpOnly cookie)
         → GET /api/auth/check → Validates JWT
Middleware handles: rate limiting, security headers, CORS only
```

## 🎯 Key Components Deep Dive

### ChatContainer (`components/chat/ChatContainer.tsx`)
- Renders message list with virtualization
- Auto-scroll to bottom on new messages
- Loading states and error handling
- Integration with chatStore

### InputArea (`components/chat/InputArea.tsx`)
- **Unified Input**: All messages go through sendMessage() (model decides image vs text)
- **Model Selector**: Dropdown with grouped models
- **Reasoning Controls**: Effort level for o-series
- **Auto-resize**: Textarea grows with content

### MessageContent (`components/chat/MessageContent.tsx`)
- **Rich Rendering**: Markdown, code blocks, tables
- **Document Detection**: Complex content triggers viewer
- **Image Display**: Base64 image rendering
- **Interactive HTML**: Safe iframe execution

### SettingsDrawer (`components/settings/SettingsDrawer.tsx`)
- **Three Tabs**: Tuning, Memory, Persona
- **Additional Instructions**: Optional extra instructions (BASE_SYSTEM_PROMPT is always included)
- **Memory Management**: Add/edit/delete memories
- **Model Info**: Shows current model details

### RichContentViewer (`components/canvas/RichContentViewer.tsx`)
- **Preview/Source**: Toggle between rendered and raw
- **Full-screen**: Maximize for better viewing
- **Export**: Download as HTML/Markdown
- **Safe Execution**: Sandboxed iframe for HTML/JS

## 🚀 Implementation Patterns

### Adding a New AI Model
```typescript
// 1. Add to lib/models/modelConfig.ts
export const MODELS = {
  "new-model-id": {
    id: "new-model-id",
    name: "Display Name",
    family: "model-family",
    description: "Model description",
    contextWindow: 128000,
    maxOutput: 16384,
    pricing: { input: 2.5, output: 10.0 },
    capabilities: ["chat", "vision"],
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsTemperature: true,
    recommendedFor: ["Use case 1", "Use case 2"],
    badge: "New"
  }
};

// 2. Update types if new family
// types/index.ts
export type ModelFamily = "gpt-4.1" | "gpt-4o" | "gpt-5.1" | "o-series" | "gpt-image" | "dall-e" | "new-family";
```

### Creating a New Hook
```typescript
// hooks/useNewFeature.ts
"use client";

import { useState, useCallback, useEffect } from "react";
import { useSettingsStore } from "@/stores/settingsStore";

export function useNewFeature() {
  const [state, setState] = useState(null);
  const { parameters } = useSettingsStore();

  const action = useCallback(async (input: string) => {
    // Implementation
  }, [parameters]);

  return { state, action };
}
```

### API Route Pattern
```typescript
// app/api/newroute/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Validate input
    // Call OpenAI
    // Return response or stream
  } catch (error) {
    return NextResponse.json(
      { error: "Error message" },
      { status: 500 }
    );
  }
}
```

## 🔧 Configuration Files

### Environment Variables (`.env.production`)
```env
# OpenAI
OPENAI_API_KEY=sk-proj-xxxxx

# Authentication
AUTH_ENABLED=true
AUTH_PASSWORD=ultrassom2024
JWT_SECRET=your-secret-key

# App Config
NEXT_PUBLIC_BASE_PATH=/chat
NEXT_PUBLIC_APP_URL=https://ultrassom.ai/chat
PORT=3040
NODE_ENV=production

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60000
```

### Systemd Service (`/etc/systemd/system/chatgpt.service`) (Pasta systemd)
```ini
[Unit]
Description=Celer - Cliente IA Multi-Modal
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/CHATGPT
Environment="NODE_ENV=production"
Environment="PORT=3040"
EnvironmentFile=/root/CHATGPT/.env.production
ExecStartPre=/bin/bash -c '/usr/bin/fuser -k 3040/tcp 2>/dev/null; sleep 1; exit 0'
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=15

[Install]
WantedBy=multi-user.target
```

## 🐛 Common Issues & Solutions

### Port Already in Use
```bash
# Find and kill process on port
sudo fuser -k -9 3040/tcp
sudo systemctl restart chatgpt
```

### Build Failures
```bash
# Clean build
rm -rf .next node_modules/.cache
npm run build
```

### Chunk Loading Errors
```bash
# Clear all caches
rm -rf .next
npm run build
sudo systemctl restart chatgpt
# Client: Ctrl+Shift+R to hard refresh
```

### Authentication Not Working
```bash
# Auth is handled by Apache Basic Auth (not Next.js middleware)
# Check htpasswd file
cat /etc/apache2/.htpasswd-chat

# Test with auth
curl -u anders:ultrassom2024 https://ultrassom.ai/chat
```

### Model Token Errors
- Reasoning models: Never send temperature
- Check `modelSupportsTemperature()` before including
- Use `isReasoningModel()` for conditional params

## 📚 Code Conventions

### TypeScript
- Strict mode enabled
- Explicit return types for functions
- Interface over type for objects
- Proper null checking with optional chaining

### React
- Functional components only
- Custom hooks for logic extraction
- Memoization where needed
- Error boundaries for resilience

### Styling
- Tailwind utilities first
- oklch() for custom colors
- cn() for conditional classes
- No inline styles unless dynamic

### API Design
- RESTful endpoints under /api
- Streaming for long responses
- Proper error codes and messages
- Rate limiting on all endpoints

### Git Workflow
```bash
# Feature branch
git checkout -b feature/new-feature

# Commit with message
git add .
git commit -m "feat: add new feature

- Detail 1
- Detail 2

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push and create PR
git push -u origin feature/new-feature
gh pr create --title "feat: new feature" --body "..."
```

## 🎨 UI/UX Patterns

### Component Structure
- Container → Layout → Content → Actions
- Consistent spacing: p-4, gap-4, mt-4
- Border radius: rounded-lg for cards
- Shadows: shadow-sm default, shadow-lg for modals

### Color System (oklch)
- Primary: Blue-green gradient
- Background: Adaptive light/dark
- Borders: border-border (semantic)
- Text: foreground/muted-foreground

### Animations
- Transitions: transition-all duration-200
- Hover states: hover:opacity-90
- Loading: animate-pulse or spinner
- Entry: animate-in with slide/fade

## 🔐 Security Considerations

1. **Authentication (Layer 1)**: Apache Basic Auth (htpasswd at /etc/apache2/.htpasswd-chat)
2. **Authentication (Layer 2)**: JWT sessions via jose (httpOnly cookies, 7-day expiry)
3. **Rate Limiting**: Per-IP and per-endpoint with sliding window (middleware.ts + lib/security/rateLimit.ts)
4. **Input Validation**: All user inputs sanitized (rehype-sanitize for markdown)
5. **API Keys**: Never exposed to client
6. **CSP Headers**: Strict content security policy (middleware.ts)
7. **CORS**: Configured allowed origins only
8. **Security Headers**: HSTS, X-Content-Type-Options, X-Frame-Options (next.config.ts)

## 📈 Performance Optimizations

1. **Code Splitting**: Dynamic imports for heavy components
2. **Image Optimization**: Next.js Image component
3. **Streaming SSR**: Server components where possible
4. **Caching**: TanStack Query for API responses
5. **Bundle Size**: Tree shaking, no unused imports
6. **Database**: IndexedDB for offline capability

## 🚢 Deployment Checklist

```bash
# 1. Update code
git pull origin main

# 2. Install dependencies
npm ci --production

# 3. Build
npm run build

# 4. Test build
npm run start

# 5. Deploy
sudo systemctl restart chatgpt

# 6. Verify
curl http://localhost:3040/chat
sudo systemctl status chatgpt
```

## 📝 Recent Updates (Feb 2026)

### Features Added
- ✅ Image generation via Responses API tool (model decides, no keyword detection)
- ✅ Progressive image preview in stream (partial_image_b64)
- ✅ Message editing (edit & resend with history truncation)
- ✅ Fixed BASE_SYSTEM_PROMPT always sent (no manual config needed)
- ✅ Dual auth: Apache Basic Auth + JWT sessions (jose)
- ✅ Correct max output tokens per model (128K for GPT-5.1, 100K for o3, etc.)
- ✅ Rich content viewer (HTML/JS) with sandboxed iframe
- ✅ Multi-format export (Markdown, JSON, PDF, Clipboard)
- ✅ Server-side conversation persistence (data/conversations.json)
- ✅ Model capabilities analysis hook (useModelCapabilities)
- ✅ Mobile swipe gestures for sidebar
- ✅ GPT-5.1 family support (Instant, Thinking, Pro)

### Improvements
- Removed keyword-based image detection (InputArea.tsx)
- Removed detectIntentFromMessage dead code (systemPrompt.ts)
- Removed useImageGen, useAuth, useMonacoEditor (dead hooks)
- Removed CanvasContainer, MonacoEditor, DiffViewer, SettingsPanel (dead components)
- Settings "Instruções Adicionais" field is now optional (empty default)
- Intelligent prompt base system always active
- Default model: gpt-5.3-chat-latest, temperature: 0.8, topP: 0.95

## 🔗 Related Documentation

| Document | Purpose |
|----------|---------|
| [README.md](README.md) | Public project overview |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Technical architecture |
| [MODELS.md](docs/MODELS.md) | AI model documentation |
| [API.md](docs/API.md) | API endpoint reference |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Deployment guide |
| [FEATURES_IMPLEMENTED.md](FEATURES_IMPLEMENTED.md) | Recent feature details |

## 💡 Tips & Best Practices

1. **Always restart service after .env changes**
2. **Use systemd for production, not npm run dev**
3. **Check logs first when debugging**
4. **Test in incognito for auth issues**
5. **Build before deploy to catch errors**
6. **Monitor memory usage (o3 can be heavy)**
7. **Regular backups of conversations DB**

---

> **Maintained by**: Anders & Claude 🧉
> **Last Updated**: February 9, 2026
> **Version**: 2.0.0
