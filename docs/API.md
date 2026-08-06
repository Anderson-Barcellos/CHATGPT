# API

**Última atualização:** 2026-08-06
**Base URL pública:** `https://ultrassom.ai/chat`
**Base path interno:** `NEXT_PUBLIC_BASE_PATH=/chat`

Todas as rotas abaixo são implementadas como Route Handlers do Next em `app/api/*`. Quando `AUTH_ENABLED=true`, o `proxy.ts` protege as rotas privadas com cookie JWT `auth-token`.

## Chat

### `POST /api/chat`

Proxy server-side para chat com streaming. Modelos OpenAI usam a `Responses API`; `deepseek-v4-pro` usa o adapter DeepSeek e `gemini-3.6-flash` usa a Interactions API, ambos apenas no chat padrão streaming.

**Arquivo:** `app/api/chat/route.ts`

```json
{
  "input": [
    { "role": "user", "content": "Explique neurite vestibular em tópicos." }
  ],
  "model": "gpt-5.6-luna",
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
| `model` | string | `gpt-5.6-luna` | Precisa existir em `lib/models/modelConfig.ts` com capacidade `chat` ou `reasoning`; modelos removidos conhecidos caem para esse default |
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

Quando `model="deepseek-v4-pro"`, a rota aceita somente `responseMode="default"` com `stream=true`, exige `DEEPSEEK_API_KEY` e usa `fresh_web_context` como tool local. Essa tool consulta a OpenAI com `web_search_preview` quando o DeepSeek pede contexto fresco, mas Documento, Deepsearch e Quiz não usam o provider DeepSeek.

Quando `model="gemini-3.6-flash"`, a rota aceita somente `responseMode="default"` com `stream=true`, exige `GEMINI_API_KEY` e chama a Interactions API com `store=false`, Google Search, URL Context e `thinking_summaries="auto"`. Os níveis aceitos são `minimal`, `low`, `medium` e `high`; Documento, Deepsearch e Quiz permanecem nos fluxos OpenAI.

Em `responseMode="quiz"`, as tools são removidas e o backend força:

- modelo `gpt-5.4`;
- reasoning `high`;
- schema JSON estrito de quiz;
- `stream=false`.

Em `responseMode="deepsearch_medium"` e `responseMode="deepsearch_high"`:

- no shell atual, `hooks/useChat.ts` envia o mesmo fluxo de documento/canvas;
- no shell atual, `hooks/useChat.ts` envia `gpt-5.4-mini` + reasoning `high` em `deepsearch_medium`;
- no shell atual, `hooks/useChat.ts` envia `gpt-5.4` + reasoning `high` em `deepsearch_high`.

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

Desconexão do cliente é propagada para o provider upstream via `request.signal`; abortos retornam HTTP `499`.
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
| `POST` | `/api/chat/background/cancel` | Cancela a Response em background e sincroniza o estado terminal da mensagem |
| `POST` | `/api/chat/background/reconcile` | Reprocessa jobs pendentes salvos e mensagens antigas com `response_id` pendente |

Essas rotas exigem `conversationId`, `assistantMessageId` e, exceto na criação,
`responseId`. O fluxo não introduz fila externa: a OpenAI mantém a Response e o
servidor local sincroniza o estado em `data/conversations.json`. Para sobreviver
melhor à suspensão agressiva de navegador mobile, o app também mantém metadados
de jobs pendentes em `data/chat-background-jobs.json` e chama `/reconcile` ao
abrir, ao voltar para aba visível e ao carregar conversas com job pendente.

## Gaucho Studio

### `GET /api/studio/runner`

Entrega o módulo autenticado do Web Worker usado pelo runner local. A resposta
não é cacheada e possui CSP própria com `connect-src 'none'`; o cliente também
valida um token privado por execução e limita quantidade e volume das mensagens
recebidas do Worker.

### `POST /api/studio/assist`

Assistente contextual do editor em `/studio`. A rota usa a OpenAI Responses API com streaming SSE, `store=false`, reasoning baixo e `tools: []`. Ela não recebe autorização para editar arquivos, executar código, navegar na web, consultar memórias ou acionar o fluxo agente.

```json
{
  "model": "gpt-5.6-luna",
  "prompt": "Sugira uma forma mais segura de validar estes parâmetros.",
  "file": {
    "path": "src/utils/calculadora.ts",
    "language": "typescript",
    "content": "export function calcular(a: number, b: number) { return a + b }"
  },
  "history": []
}
```

Os modelos aceitos ficam em `lib/studio/models.ts`. O body é limitado a 512 KiB, o prompt a 12 mil caracteres e o arquivo a 160 mil caracteres. O cliente apresenta a resposta no chat lateral para cópia manual; nenhuma resposta é aplicada automaticamente ao Monaco.

### `POST /api/studio/autocomplete`

Autocomplete FIM não streaming do Monaco, restrito a TypeScript e JavaScript em desktop. A rota exige a mesma sessão do app, usa `DEEPSEEK_API_KEY` apenas no servidor e aceita somente estes quatro campos:

```json
{
  "filePath": "src/index.ts",
  "language": "typescript",
  "prefix": "function soma(a: number, b: number) {\n  return ",
  "suffix": ";\n}"
}
```

`prefix + suffix` aceita no máximo 32 mil caracteres e `filePath`, 320. Quando o arquivo inteiro cabe, o cliente o envia; acima disso, preserva até 24 mil caracteres antes e 8 mil depois do cursor. O body HTTP é limitado a 256 KiB. O provider usa `deepseek-v4-pro`, até 256 tokens, `temperature=0.1`, timeout de 8 segundos, sem retries automáticos do SDK, e não envia histórico, reasoning ou tools.

```json
{
  "completion": "a + b",
  "finishReason": "stop"
}
```

Somente `finishReason="stop"` produz ghost text; respostas vazias, cercas Markdown ou finais truncados são descartados. A rota retorna `401` sem sessão, `400/413` para corpo inválido, `503` sem credencial, `504` em timeout e `429` com `Retry-After` quando o provider limita o tráfego. Falhas upstream são sanitizadas: o log do SDK fica forçado em `off`, e a rota registra apenas classe/status do erro, nunca prefixo, suffix ou completion.

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
| `POST` | `/api/realtime/tts-call` | Cria sessão SDP/WebRTC experimental com `gpt-realtime-2.1-mini` |
| `POST` | `/api/realtime/tts-call/log` | Recebe telemetria sanitizada do cliente Realtime para diagnóstico local |
| `POST` | `/api/transcribe` | Transcreve áudio com `gpt-4o-transcribe`; streaming NDJSON ativo por padrão e desativável com `TRANSCRIPTION_STREAMING_ENABLED=false` |

Notas do PDF:

- A rota exige auth quando `AUTH_ENABLED=true`, aceita apenas artifacts `kind: "document"` e limita o body a 5 MB.
- O renderer usa Playwright/Chrome em modo server-side com JavaScript desativado.
- O painel A4 não oferece ação de imprimir; o caminho suportado é exportar PDF ou baixar o arquivo fonte.

## Google Calendar e Notas Locais

Nota atual: a aba visível do produto usa **Pulse nativo** para rotinas recorrentes. As rotas Google/Calendar abaixo ficam como legado operacional até limpeza futura.

Todas as rotas abaixo são privadas quando `AUTH_ENABLED=true`. O browser nunca recebe `client_secret`, `refresh_token`, `access_token` ou token bruto do Google.

## Pulse

Todas as rotas de Pulse são privadas quando `AUTH_ENABLED=true`, exceto o runner interno `/api/pulse/run-due`, protegido por `PULSE_RUNNER_TOKEN` quando configurado e usado pelo timer local do servidor.

Os resultados do Pulse e as mensagens do chat reutilizam o mesmo mini-player. Ele abre no TTS estável via `/api/tts` (`gpt-4o-mini-tts`) e permite selecionar manualmente o Realtime experimental via `/api/realtime/tts-call`; nenhuma engine inicia apenas ao abrir o player.

As execuções do Pulse usam `gpt-5.4-mini` + reasoning `medium` por padrão e podem selecionar `gpt-5.6-terra` + `medium` em cada rotina. O modelo e effort efetivos ficam registrados em cada execução. O prompt continua enxuto, com preferências úteis, memórias ativas e histórico relevante. `PULSE_RUN_MODEL`, `PULSE_MAX_OUTPUT_TOKENS` e `PULSE_REASONING_EFFORT` permanecem overrides operacionais; `PULSE_MAX_OUTPUT_TOKENS` é limitado pelo runner entre 8k e 32k; `none` e `minimal` são coeridos para `low` quando há tools.

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
| `500` | Erro interno ou erro vindo do provider upstream |
