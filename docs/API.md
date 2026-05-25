# API

**Última atualização:** 2026-05-25  
**Base URL pública:** `https://ultrassom.ai/chat`  
**Base path interno:** `NEXT_PUBLIC_BASE_PATH=/chat`

Todas as rotas abaixo são implementadas como Route Handlers do Next em `app/api/*`. Quando `AUTH_ENABLED=true`, o `proxy.ts` protege as rotas privadas com cookie JWT `auth-token`.

## Chat

### `POST /api/chat`

Proxy server-side para a OpenAI `Responses API`, com suporte a SSE streaming.

**Arquivo:** `app/api/chat/route.ts`

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
  "imageQuality": "high",
  "imageSize": "auto",
  "reasoning": {
    "effort": "medium",
    "summary": "concise"
  }
}
```

| Campo | Tipo | Padrão | Observação |
|---|---|---|---|
| `input` | array | obrigatório | Payload compatível com Responses API |
| `model` | string | `gpt-5.1-chat-latest` | Precisa existir em `lib/models/modelConfig.ts` com capacidade `chat` ou `reasoning` |
| `instructions` | string | nenhum | Instruções de sistema |
| `maxOutputTokens` | number | máximo do modelo | Sempre limitado ao `maxOutput` do modelo |
| `temperature` | number | nenhum | Só enviado se o modelo suportar temperatura |
| `topP` | number | nenhum | Só enviado se o modelo suportar temperatura |
| `verbosity` | string | nenhum | Só enviado se o modelo suportar verbosity |
| `codeInterpreterEnabled` | boolean | `false` | Adiciona `code_interpreter` quando o modelo suporta |
| `responseMode` | `default`, `document`, `quiz` | `default` | `quiz` usa fluxo forçado sem streaming |
| `stream` | boolean | `true` | Ignorado em `quiz`, que é sempre não-streaming |
| `reasoning` | object | nenhum | Só usado por modelos de reasoning |
| `imageQuality` | `low`, `medium`, `high`, `auto` | `high` | Repassado para `image_generation` |
| `imageSize` | `1024x1024`, `1024x1536`, `1536x1024`, `auto` | `auto` | Repassado para `image_generation` |

### Ferramentas injetadas

Em modos não-quiz, o backend adiciona por padrão:

- `image_generation` com `gpt-image-2`, `partial_images: 2`, `output_format: png`.
- `web_search_preview` com localização aproximada `BR` e contexto `medium`.
- `code_interpreter` apenas quando `codeInterpreterEnabled=true` e o modelo suporta.

Em `responseMode="quiz"`, as tools são removidas e o backend força:

- modelo `gpt-5.4`;
- reasoning `high`;
- schema JSON estrito de quiz;
- `stream=false`.

### Streaming

Resposta streaming usa `Content-Type: text/event-stream`.

```text
data: {"type":"response.output_text.delta","delta":"..."}
data: {"type":"response.reasoning_summary_text.delta","delta":"..."}
data: [DONE]
```

Desconexão do cliente é propagada para a OpenAI via `request.signal`; abortos retornam HTTP `499`.

## Auth

### `GET /api/auth/check`

Retorna se a auth está ligada e se o request atual está autenticado.

```json
{
  "authEnabled": true,
  "authenticated": false
}
```

### `POST /api/auth/login`

Valida credenciais e emite cookie JWT `auth-token`.

```json
{
  "username": "seu-usuario",
  "password": "sua-senha"
}
```

O login usa `AUTH_USERNAME`, `AUTH_PASSWORD` e `JWT_SECRET`. O cookie é `HttpOnly`, `SameSite=Lax`, expira em 7 dias e precisa sair com `Path=/chat` em produção.

### `POST /api/auth/logout`

Limpa o cookie de autenticação.

**Arquivos:** `app/api/auth/*`, `lib/server/auth.ts`, `proxy.ts`

## Conversas

| Método | Rota | Função |
|---|---|---|
| `GET` | `/api/conversations` | Lista conversas |
| `POST` | `/api/conversations` | Cria conversa |
| `GET` | `/api/conversations/[id]` | Lê conversa |
| `PUT` | `/api/conversations/[id]` | Atualiza conversa |
| `POST` | `/api/conversations/[id]` | Alias de update para `navigator.sendBeacon` |
| `DELETE` | `/api/conversations/[id]` | Remove conversa |

**Arquivos:** `app/api/conversations/*`, `lib/storage/conversations.ts`

## Memórias

| Método | Rota | Função |
|---|---|---|
| `GET` | `/api/memories` | Lista memórias |
| `POST` | `/api/memories` | Cria memória |
| `PUT` | `/api/memories/[id]` | Atualiza memória |
| `DELETE` | `/api/memories/[id]` | Remove memória |

**Arquivos:** `app/api/memories/*`, `lib/storage/memories.ts`

## Persona

### `GET /api/persona`

Lê persona persistida.

### `PUT /api/persona`

Atualiza:

- `contextAboutUser`
- `responsePreferences`
- `customSystemInstructions`
- `ttsPreferences`

**Arquivo:** `app/api/persona/route.ts`

## Artefatos, Voz e Transcrição

| Método | Rota | Função |
|---|---|---|
| `POST` | `/api/artifacts/pdf` | Renderiza artifact de documento como PDF A4 server-side |
| `POST` | `/api/tts` | Gera áudio `audio/mpeg` com `gpt-4o-mini-tts` |
| `POST` | `/api/realtime/tts-call` | Cria sessão SDP experimental com `gpt-realtime-mini` |
| `POST` | `/api/transcribe` | Transcreve áudio com `gpt-4o-transcribe` |

## Health

### `GET /api/health`

Checa storage local, presença de chave OpenAI e uso de memória. Retorna status `healthy`, `degraded` ou `unhealthy`.

## Erros comuns

| Status | Significado |
|---|---|
| `400` | Payload inválido, input ausente ou modelo não permitido |
| `401` | Auth ligada e request não autenticado |
| `429` | Rate limit |
| `499` | Cliente desconectou durante stream |
| `500` | Erro interno ou erro vindo da OpenAI |
