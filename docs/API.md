# API

**Última atualização:** 2026-07-05
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
  "model": "gpt-5.4-mini",
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
| `model` | string | `gpt-5.4-mini` | Precisa existir em `lib/models/modelConfig.ts` com capacidade `chat` ou `reasoning`; modelos removidos conhecidos caem para esse default |
| `instructions` | string | nenhum | Instruções de sistema |
| `maxOutputTokens` | number | máximo do modelo | Sempre limitado ao `maxOutput` do modelo |
| `temperature` | number | nenhum | Só enviado se o modelo suportar temperatura |
| `topP` | number | nenhum | Só enviado se o modelo suportar temperatura |
| `verbosity` | string | nenhum | Só enviado se o modelo suportar verbosity |
| `codeInterpreterEnabled` | boolean | `false` | Adiciona `code_interpreter` quando o modelo suporta |
| `responseMode` | `default`, `document`, `deepsearch_medium`, `deepsearch_high`, `quiz` | `default` | `quiz` usa fluxo forçado sem streaming; `document` e `deepsearch_*` são presets orquestrados pelo app, enquanto a rota só faz enforcement rígido para `quiz` |
| `stream` | boolean | `true` | Ignorado em `quiz`, que é sempre não-streaming |
| `reasoning` | object | nenhum | Só usado por modelos de reasoning |
| `imageQuality` | `low`, `medium`, `high`, `auto` | `high` | Repassado para `image_generation` |
| `imageSize` | `1024x1024`, `1024x1536`, `1536x1024`, `auto` | `auto` | Repassado para `image_generation` |

### Ferramentas injetadas

Ferramentas injetadas pelo backend:

- `image_generation` com `gpt-image-2`, `partial_images: 2`, `output_format: png`, apenas em `responseMode="default"`.
- `web_search_preview` com localização aproximada `BR` e contexto `medium`, em modos não-quiz.
- `remember_memory` e `search_memory` apenas em `responseMode="default"`, com até duas rodadas de function-call/output para salvar memórias explícitas ou recuperar contexto histórico quando o usuário pedir.
- `code_interpreter` apenas quando `codeInterpreterEnabled=true` e o modelo suporta.

Em `responseMode="quiz"`, as tools são removidas e o backend força:

- modelo `gpt-5.4`;
- reasoning `high`;
- schema JSON estrito de quiz;
- `stream=false`.

Em `responseMode="deepsearch_medium"` e `responseMode="deepsearch_high"`:

- no shell atual, `hooks/useChat.ts` envia o mesmo fluxo de documento/canvas;
- no shell atual, `hooks/useChat.ts` envia `model: "gpt-5.4-mini"`;
- no shell atual, `hooks/useChat.ts` envia reasoning `medium` (`deepsearch_medium`) ou `high` (`deepsearch_high`).

### Streaming

Resposta streaming usa `Content-Type: text/event-stream`.

```text
data: {"type":"response.output_text.delta","delta":"..."}
data: {"type":"response.reasoning_summary_text.delta","delta":"..."}
data: {"type":"response.reasoning_summary_text.done","text":"..."}
data: [DONE]
```

O cliente tambem tolera eventos `response.reasoning_summary_part.added`,
`response.reasoning_summary_part.done` e `response.reasoning_text.done` para nao
perder summaries que cheguem apenas como evento final.
Quando a API retorna `reasoning_tokens` em `response.completed`, mas nao emite
summary textual, a UI preserva um estado visivel de reasoning aplicado sem
inventar resumo.

Desconexão do cliente é propagada para a OpenAI via `request.signal`; abortos retornam HTTP `499`.
Esse comportamento vale para o fluxo streaming normal.

### Background para respostas longas

Os modos `document`, `deepsearch_medium` e `deepsearch_high` usam rotas curtas
de background para sobreviver a troca de aba, reload ou suspensão do navegador.
O app cria a resposta com `background: true`, persiste o `response_id` na
mensagem do assistente e sincroniza quando a aba volta ou durante polling leve.

| Método | Rota | Função |
|---|---|---|
| `POST` | `/api/chat/background` | Inicia uma Response em background e vincula `response_id` à mensagem |
| `POST` | `/api/chat/background/sync` | Recupera a Response por `response_id` e persiste resultado final |
| `POST` | `/api/chat/background/cancel` | Cancela a Response em background e marca a mensagem como abortada |
| `POST` | `/api/chat/background/reconcile` | Reprocessa jobs pendentes salvos e mensagens antigas com `response_id` pendente |

Essas rotas exigem `conversationId`, `assistantMessageId` e, exceto na criação,
`responseId`. O fluxo não introduz fila externa: a OpenAI mantém a Response e o
servidor local sincroniza o estado em `data/conversations.json`. Para sobreviver
melhor à suspensão agressiva de navegador mobile, o app também mantém metadados
de jobs pendentes em `data/chat-background-jobs.json` e chama `/reconcile` ao
abrir, ao voltar para aba visível e ao carregar conversas com job pendente.

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

Memórias explícitas continuam em `/api/memories/*`. O índice semântico/RAG e sugestões de memória ficam em `/api/memory/*`.

| Método | Rota | Função |
|---|---|---|
| `GET` | `/api/memories` | Lista memórias |
| `POST` | `/api/memories` | Cria memória |
| `PUT` | `/api/memories/[id]` | Atualiza memória |
| `DELETE` | `/api/memories/[id]` | Remove memória |
| `POST` | `/api/memory/index` | Indexa conversas no store vetorial local para busca semântica |
| `POST` | `/api/memory/search` | Busca chunks históricos por query, com `topK` opcional |
| `GET` | `/api/memory/suggestions` | Lista sugestões de memória, opcionalmente por `status` |
| `POST` | `/api/memory/suggestions` | Gera sugestões para uma conversa específica |
| `PATCH` | `/api/memory/suggestions/[id]` | Aceita/rejeita sugestão; aceitar cria memória ativa |

**Arquivos:** `app/api/memories/*`, `app/api/memory/*`, `lib/storage/memories.ts`, `lib/server/memory/*`

## Persona

### `GET /api/persona`

Lê persona persistida.

O painel de Persona também exibe uma prévia somente leitura do prompt principal (`BASE_SYSTEM_PROMPT` + `FIXED_PERSONA_PROMPT`) antes dos campos editáveis.

### `PUT /api/persona` / `POST /api/persona`

Atualiza:

- `contextAboutUser`
- `responsePreferences`
- `customSystemInstructions`
- `ttsPreferences`

`POST` é aceito como alias para autosave forte/flush de saída do navegador
(`sendBeacon`/`keepalive`). `ttsPreferences` persiste `voice`, `mode`,
`speed`, `instructions` e `format` em `data/persona.json`; o default atual
de formato é `flac`.

**Arquivo:** `app/api/persona/route.ts`

## Artefatos, Voz e Transcrição

| Método | Rota | Função |
|---|---|---|
| `POST` | `/api/artifacts/pdf` | Renderiza artifact de documento como PDF A4 server-side, com fonte Lexend embutida e cabeçalho compacto OpenAI + título |
| `POST` | `/api/tts` | Gera áudio clássico com `gpt-4o-mini-tts`; aceita `format` `flac`, `mp3` ou `wav` |
| `POST` | `/api/realtime/tts-call` | Cria sessão SDP/WebRTC experimental com `gpt-realtime-mini` |
| `POST` | `/api/transcribe` | Transcreve áudio com `gpt-4o-transcribe` |

Notas do PDF:

- A rota exige auth quando `AUTH_ENABLED=true`, aceita apenas artifacts `kind: "document"` e limita o body a 5 MB.
- O renderer usa Playwright/Chrome em modo server-side com JavaScript desativado.
- O painel A4 não oferece ação de imprimir; o caminho suportado é exportar PDF ou baixar o arquivo fonte.

## Google Calendar e Notas Locais

Nota atual: a aba visível do produto usa **Pulse nativo** para rotinas recorrentes. As rotas Google/Calendar abaixo ficam como legado operacional até limpeza futura.

Todas as rotas abaixo são privadas quando `AUTH_ENABLED=true`. O browser nunca recebe `client_secret`, `refresh_token`, `access_token` ou token bruto do Google.

## Pulse

Todas as rotas de Pulse são privadas quando `AUTH_ENABLED=true`, exceto o runner interno `/api/pulse/run-due`, protegido por `PULSE_RUNNER_TOKEN` quando configurado e usado pelo timer local do servidor.

Os resultados do Pulse reutilizam o TTS estável do app via `/api/tts` (`gpt-4o-mini-tts`). O endpoint Realtime `/api/realtime/tts-call` segue como opção experimental separada para mensagens do chat e não é o player padrão do Pulse.

As execuções do Pulse usam `gpt-5.4-mini` por padrão, com raciocínio `low`, verbosity `high` e `PULSE_MAX_OUTPUT_TOKENS=25000`. O prompt de execução é enxuto e inclui apenas instruções da rotina, preferências úteis, memórias ativas compactadas e trechos relevantes do histórico recuperados pelo índice semântico. `PULSE_RUN_MODEL`, `PULSE_MAX_OUTPUT_TOKENS` e `PULSE_REASONING_EFFORT` são overrides operacionais; com `web_search`/`image_generation`, `none` e `minimal` são coeridos para `low`.

| Método | Rota | Função |
|---|---|---|
| `GET` | `/api/pulse/tasks` | Lista rotinas recorrentes |
| `POST` | `/api/pulse/tasks/propose` | Interpreta prompt livre e devolve proposta editável de rotina |
| `POST` | `/api/pulse/tasks` | Cria rotina recorrente diária, semanal ou mensal |
| `PATCH` | `/api/pulse/tasks/[id]` | Ativa ou pausa rotina |
| `DELETE` | `/api/pulse/tasks/[id]` | Remove rotina |
| `GET` | `/api/pulse/runs` | Lista execuções e aceita filtro `taskId` |
| `DELETE` | `/api/pulse/runs/[id]` | Remove uma geração/execução do feed Pulse |
| `POST` | `/api/pulse/tasks/[id]/run` | Executa uma rotina manualmente |
| `POST` | `/api/pulse/run-due` | Runner interno que executa rotinas vencidas |

Arquivos runtime privados ignorados pelo Git: `data/pulse-tasks.json` e `data/pulse-runs.json`.

### Integração Google

| Método | Rota | Função |
|---|---|---|
| `GET` | `/api/integrations/google/status` | Retorna estado operacional da conexão, sem expor tokens |
| `GET` | `/api/integrations/google/auth/start` | Inicia OAuth Google com `access_type=offline`, scope `calendar.events` e cookie `state` HttpOnly |
| `GET` | `/api/integrations/google/auth/callback` | Valida `state`, troca `code` por tokens e persiste token criptografado server-side |
| `POST` | `/api/integrations/google/disconnect` | Remove o token local da integração |

### Agenda

| Método | Rota | Função |
|---|---|---|
| `GET` | `/api/calendar/events` | Lista eventos do Google Calendar conectado |
| `POST` | `/api/calendar/events/draft` | Cria rascunho local de `create`, `update` ou `cancel`; não chama o Google |
| `POST` | `/api/calendar/events/draft-from-text` | Transforma linguagem natural em rascunho local `pending`; não chama o Google |
| `GET` | `/api/calendar/events/drafts` | Lista rascunhos locais, com filtro opcional `status` |
| `PATCH` | `/api/calendar/events/drafts/[id]` | Edita rascunho local `pending`; não chama o Google |
| `POST` | `/api/calendar/events/drafts/[id]/discard` | Marca rascunho local `pending` como `discarded`; não chama o Google |
| `POST` | `/api/calendar/events/confirm` | Confirma rascunho `pending` e só então cria/altera/cancela evento no Google |

`/api/calendar/events/draft-from-text` aceita texto vindo do chat ou STT (`source: "chat" | "stt"`), usa extração server-side com saída JSON e retorna `422` quando faltam campos como título, data ou horário.

`PATCH /api/calendar/events/drafts/[id]` aceita edição de `summary`, `start`, `end`, `durationMinutes`, `location` e `description`. A edição é recusada se o rascunho já foi confirmado, descartado ou falhou.

`/api/calendar/events/confirm` aceita `{ "draftId": "...", "sendUpdates": "none" }`; `sendUpdates` pode ser `none`, `externalOnly` ou `all`.

### Notas Locais

| Método | Rota | Função |
|---|---|---|
| `GET` | `/api/workspace-notes` | Lista capturas locais com filtros opcionais `source`, `conversationId`, `calendarEventId` |
| `POST` | `/api/workspace-notes` | Cria nota local (`manual`, `chat`, `stt` ou `calendar`) |
| `PUT` | `/api/workspace-notes/[id]` | Atualiza nota local |
| `DELETE` | `/api/workspace-notes/[id]` | Remove nota local |

Arquivos runtime privados ignorados pelo Git: `data/google-calendar-token.json`, `data/calendar-event-drafts.json` e `data/workspace-notes.json`.

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
