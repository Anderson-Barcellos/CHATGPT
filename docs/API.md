# API Reference

**Last updated:** 2026-05-24  
**Base URL:** `https://ultrassom.ai/chat` (respects `NEXT_PUBLIC_BASE_PATH`)

All endpoints are implemented as Next.js route handlers under `app/api/`.

---

## POST /api/chat

Chat completion endpoint with SSE streaming support.

**File:** `app/api/chat/route.ts`

### Request (example)

```json
{
  "input": [
    { "role": "user", "content": "Explique neurite vestibular em tópicos." }
  ],
  "model": "gpt-5.1-chat-latest",
  "instructions": "You are a helpful assistant.",
  "maxOutputTokens": 4096,
  "verbosity": "medium",
  "codeInterpreterEnabled": false,
  "responseMode": "default",
  "stream": true,
  "reasoning": {
    "effort": "medium",
    "summary": "concise"
  }
}
```

### Request fields

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `input` | array | **required** | OpenAI Responses API input payload |
| `model` | string | `gpt-5.1-chat-latest` | Must be an allowed chat/reasoning model from `lib/models/modelConfig.ts` |
| `instructions` | string | — | System instructions |
| `maxOutputTokens` | number | model max output | Clamped to selected model max |
| `temperature` | number | — | Sent only if model supports temperature |
| `topP` | number | — | Sent only if model supports temperature |
| `verbosity` | string | — | Sent as `text.verbosity` only for models that support verbosity |
| `codeInterpreterEnabled` | boolean | `false` | Adds `code_interpreter` tool only when model supports it |
| `responseMode` | `default \| document \| quiz` | `default` | `quiz` uses forced model/schema path |
| `stream` | boolean | `true` | Enables SSE stream for non-quiz mode |
| `reasoning` | object | — | Only sent for reasoning models |

### Streaming response

`Content-Type: text/event-stream`

```text
data: {"type":"response.output_text.delta","delta":"..."}
data: {"type":"response.reasoning_summary_text.delta","delta":"..."}
data: [DONE]
```

### Non-streaming response

Returns raw OpenAI response JSON.

### Runtime notes

- Request body size is limited to ~10MB (`readJsonWithLimit`).
- Client disconnects propagate to OpenAI via `signal: request.signal`.
- Aborted streams return HTTP `499`.
- `quiz` mode forces:
  - model: `gpt-5.4`
  - reasoning effort: `high`
  - strict JSON schema (`quizResponseSchema`)

### Errors

| Status | Meaning |
|--------|---------|
| 400 | Invalid input/model/payload |
| 401 | Unauthorized (when auth enabled) |
| 429 | Rate limited |
| 499 | Client disconnected (stream aborted) |
| 500 | Internal/OpenAI error |

---

## Conversations

### GET /api/conversations

List conversations.

### POST /api/conversations

Create a conversation (`{ title?: string }`).

### GET /api/conversations/[id]

Read a single conversation.

### PUT /api/conversations/[id]

Update conversation data (`title`, `messages`, and/or `workspace`).

### POST /api/conversations/[id]

Alias of `PUT` for beacon compatibility (`navigator.sendBeacon` only sends `POST`).

### DELETE /api/conversations/[id]

Delete conversation.

**Files:** `app/api/conversations/route.ts`, `app/api/conversations/[id]/route.ts`

---

## Memories

### GET /api/memories

List memories.

### POST /api/memories

Create memory.

### PUT /api/memories/[id]

Update memory.

### DELETE /api/memories/[id]

Delete memory.

**Files:** `app/api/memories/route.ts`, `app/api/memories/[id]/route.ts`

---

## Persona

### GET /api/persona

Read persisted custom instructions.

### PUT /api/persona

Update `contextAboutUser`, `responsePreferences`, `customSystemInstructions`, and `ttsPreferences`.

**File:** `app/api/persona/route.ts`

---

## Artifacts / TTS

### POST /api/artifacts/pdf

Render a document artifact as server-side A4 PDF.

**File:** `app/api/artifacts/pdf/route.ts`

### POST /api/tts

Generate assistant speech audio via the server-side TTS proxy.

**File:** `app/api/tts/route.ts`

### POST /api/realtime/tts-call

Create the experimental Realtime mini SDP session used by the lab player.

**File:** `app/api/realtime/tts-call/route.ts`

---

## Authentication

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/check`

**Files:** `app/api/auth/*`

---

## Transcription

### POST /api/transcribe

Audio transcription via `gpt-4o-transcribe`.

**File:** `app/api/transcribe/route.ts`

---

## Health

### GET /api/health

Operational health check.

**File:** `app/api/health/route.ts`
