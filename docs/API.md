# API Reference

**Last updated:** 2026-01-30  
**Base URL:** `https://ultrassom.ai/chat`

All endpoints are Next.js API routes under `app/api/`.

---

## POST /api/chat

Chat completion with streaming.

**File:** `app/api/chat/route.ts`

### Request

```json
{
  "input": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hi there!" },
    { "role": "user", "content": "How are you?" }
  ],
  "model": "gpt-5.1-chat-latest",
  "instructions": "You are a helpful assistant.",
  "maxOutputTokens": 32768,
  "temperature": 0.7,
  "topP": 1,
  "stream": true,
  "reasoning": {
    "effort": "medium",
    "summary": "auto"
  }
}
```

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `input` | array | **required** | Conversation history in OpenAI Responses API format |
| `model` | string | `gpt-5.1-chat-latest` | Model ID from modelConfig |
| `instructions` | string | — | System prompt (built by contextBuilder) |
| `maxOutputTokens` | number | 1024 | Max response tokens |
| `temperature` | number | 0.7 | Omit for reasoning models |
| `topP` | number | 1 | Omit for reasoning models |
| `stream` | boolean | true | SSE streaming |
| `reasoning` | object | — | Only sent for reasoning models |

### Response (streaming)

Content-Type: `text/event-stream`

```
data: {"type":"response.output_text.delta","delta":"Hello"}
data: {"type":"response.reasoning_summary_text.delta","delta":"The user..."}
data: {"type":"response.reasoning_text.delta","delta":"Let me think..."}
data: [DONE]
```

### Response (non-streaming)

Returns the raw OpenAI response object as JSON.

### Errors

| Status | Meaning |
|--------|---------|
| 400 | Missing `input` or invalid parameters |
| 429 | Rate limited |
| 500 | OpenAI API error or internal error |

---

## POST /api/canvas

Code analysis and transformation.

**File:** `app/api/canvas/route.ts`

### Request

```json
{
  "code": "function add(a, b) { return a + b; }",
  "action": "refactor",
  "language": "javascript",
  "targetLanguage": "typescript",
  "instructions": "Use modern ES6+ syntax",
  "model": "gpt-5.1-chat-latest",
  "maxOutputTokens": 4096,
  "temperature": 0.7,
  "topP": 1,
  "stream": true,
  "reasoning": { "effort": "medium" }
}
```

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `code` | string | **required** | Source code to process |
| `action` | string | **required** | One of: `analyze`, `refactor`, `test`, `document`, `convert`, `fix` |
| `language` | string | — | Source language hint |
| `targetLanguage` | string | — | **Required** when action is `convert` |
| `instructions` | string | — | Additional instructions |
| `model` | string | `gpt-5.1-chat-latest` | Model ID |
| `stream` | boolean | true | SSE streaming |

### Actions

| Action | Description |
|--------|-------------|
| `analyze` | Code quality, bugs, security assessment |
| `refactor` | Improve readability and performance |
| `test` | Generate unit tests |
| `document` | Generate JSDoc/docstrings |
| `convert` | Convert to another language |
| `fix` | Debug and fix errors |

### Response

Same SSE format as `/api/chat`.

---

## POST /api/images

DALL-E 3 image generation.

**File:** `app/api/images/route.ts`

### Request

```json
{
  "prompt": "A gaucho riding a horse at sunset",
  "size": "1024x1024",
  "quality": "high"
}
```

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `prompt` | string | **required** | Image description |
| `size` | string | `1024x1024` | `1024x1024`, `1536x1024`, `1024x1536` |
| `quality` | string | `medium` | `low`, `medium`, `high` |

### Response

```json
{
  "imageBase64": "iVBORw0KGgo...",
  "mimeType": "image/png",
  "revisedPrompt": "A gaucho in traditional clothing..."
}
```

---

## GET /api/health

Health check endpoint.

**File:** `app/api/health/route.ts`

### Response

```json
{
  "status": "healthy",
  "timestamp": "2026-01-30T17:56:00.000Z",
  "service": "ChatGPT Clone",
  "version": "1.0.0",
  "environment": "production",
  "basePath": "/chat",
  "port": "3040",
  "uptime": 3600,
  "memory": {
    "rss": 134217728,
    "heapTotal": 67108864,
    "heapUsed": 52428800,
    "external": 1048576
  }
}
```

---

## Rate Limiting

Configured in `middleware.ts`. Limits per endpoint:

| Endpoint | Default limit |
|----------|--------------|
| `/api/chat` | 20 req/min |
| `/api/canvas` | 10 req/min |
| `/api/images` | 5 req/min |

Configurable via environment variables: `RATE_LIMIT_CHAT_RPM`, `RATE_LIMIT_CANVAS_RPM`, `RATE_LIMIT_IMAGES_RPM`.

Rate limit headers returned:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

## Authentication (optional)

Enable with `API_KEY_AUTH_ENABLED=true`. Send key via `X-Api-Key` header. Keys defined in `API_KEYS` env var (comma-separated).
