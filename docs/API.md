# API Reference

**Last updated:** 2026-04-01  
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
  "model": "gpt-5.3-chat-latest",
  "instructions": "You are a helpful assistant.",
  "maxOutputTokens": 32768,
  "temperature": 0.7,
  "topP": 1,
  "verbosity": "medium",
  "codeInterpreterEnabled": false,
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
| `model` | string | `gpt-5.3-chat-latest` | Model ID from modelConfig |
| `instructions` | string | — | System prompt (built by contextBuilder) |
| `maxOutputTokens` | number | 1024 | Max response tokens |
| `temperature` | number | 0.7 | Omit for reasoning models |
| `topP` | number | 1 | Omit for reasoning models |
| `verbosity` | string | — | Sent as `text.verbosity` for GPT-5 models that support it |
| `codeInterpreterEnabled` | boolean | false | Adds the built-in `code_interpreter` tool with `container.type = "auto"` |
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

## GET /api/memories

Lista as memórias persistidas no servidor.

**File:** `app/api/memories/route.ts`

### Response

```json
[
  {
    "id": "mem-1",
    "content": "Prefere respostas narrativas.",
    "category": "preferences",
    "isActive": true,
    "priority": 10,
    "createdAt": "2026-04-02T00:00:00.000Z",
    "updatedAt": "2026-04-02T00:00:00.000Z"
  }
]
```

## POST /api/memories

Cria uma nova memória.

### Request

```json
{
  "content": "Prefere respostas narrativas.",
  "category": "preferences",
  "isActive": true,
  "priority": 10
}
```

## PUT /api/memories/[id]

Atualiza uma memória existente.

## DELETE /api/memories/[id]

Remove uma memória existente.

---

## GET /api/persona

Retorna as instruções customizadas persistidas no servidor.

## PUT /api/persona

Atualiza `contextAboutUser` e `responsePreferences`.

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

Configured in `proxy.ts`. Limits per endpoint:

| Endpoint | Default limit |
|----------|--------------|
| `/api/chat` | 20 req/min |
| `/api/transcribe` | 10 req/min |

Configurable via environment variables: `RATE_LIMIT_CHAT_RPM`, `RATE_LIMIT_TRANSCRIBE_RPM`.

Rate limit headers returned:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

## Authentication (optional)

Enable with `AUTH_ENABLED=true`. Browser access is protected with an HTTP-only JWT cookie issued by `/api/auth/login`.
