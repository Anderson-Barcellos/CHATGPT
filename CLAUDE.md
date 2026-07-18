# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Sprints de Melhoria

Plano completo do redesign em `/root/.claude/plans/meu-velho-na-verdade-golden-creek.md`. Cada sprint = 1 sessão. Status atual:

| # | Sprint | Status | Risco |
|---|---|---|---|
| S0 | Limpeza + Setup (deletar legado, instalar `framer-motion`/`cmdk`) | ✅ Concluída | Baixo |
| S1 | Token System Unificado `--gc-*` | ✅ Concluída | Alto |
| S2 | Tipografia + Animação + Primitivos Motion | ✅ Concluída | Médio |
| S3 | Hook `useIsMobile` + Breakpoints | ✅ Concluída | Baixo |
| S4 | Refactor `uiStore` + NotesContext | ✅ Concluída | Médio |
| S5 | `CanvasOverlayV2` (draggable/resizable) | ✅ Concluída | **Alto** |
| S6 | Toolbar Flutuante de Seleção | ✅ Concluída | Médio |
| S7 | Command Palette (cmd+k) | ✅ Concluída | Baixo |
| S8 | Monaco Editor Real | ✅ Concluída | Médio |
| S9 | Quick Actions sob Balão | ✅ Concluída | Médio |
| S10 | Reconectar `useExport` ao Shell V2 | ✅ Concluída | Baixo |
| S11 | Mobile Pass | ✅ Concluída | Médio |
| S12 | Polimento Final | ✅ Concluída | Baixo |

**Tag de retorno:** `pre-redesign-s0` (criada em `9d36822`). Reverter o redesign inteiro: `git checkout pre-redesign-s0 -- .`.

**Pré-requisitos:** Antes de começar uma sprint, ler o plan file completo (`/root/.claude/plans/meu-velho-na-verdade-golden-creek.md`) — contém arquivos-alvo, riscos, validação manual e os 3 apêndices (tokens `--gc-*`, escala tipográfica, escala animação).

### Redesign concluído — S0-S12 ✅

> Todas as 13 sprints do plano `meu-velho-na-verdade-golden-creek.md` foram concluídas.
> Para sprints opcionais (S13-S18), ver o plan file em `/root/.claude/plans/meu-velho-na-verdade-golden-creek.md`.

---

## Leitura obrigatória antes de codar

Este `CLAUDE.md` complementa — não substitui — outros docs vivos do repo:

- **`AGENTS.md`** — estado atual do produto, últimas rodadas e pontos de atenção. Sempre conferir antes de mudar UX/markdown/streaming.
- **`README.md`** — highlights de produto, endpoints e estrutura de pastas.
- **`docs/INFRASTRUCTURE.md`** — Apache reverse proxy, systemd, deploy, env vars.
- **`docs/API.md`**, **`docs/ARCHITECTURE.md`**, **`docs/MODELS.md`** — referências específicas.

Se você for tocar em UX/UI ou markdown rendering, leia também a seção *"Lembrete explicito"* em `AGENTS.md`.

## Comandos essenciais

```bash
npm run dev          # dev server, porta 3040 (override com PORT=)
npm run build        # build de produção
npm start            # serve build (usado pelo systemd)
npm run lint         # ESLint via flat config (eslint.config.mjs)
npm test             # vitest --run (one-shot, sem watch)
npx tsc --noEmit     # type-check sem emitir nada
```

### Rodar um único teste

```bash
npx vitest run path/to/file.test.ts                    # arquivo específico
npx vitest run path/to/file.test.ts -t "case name"     # filtro por nome
npx vitest run                                          # todos, modo --run (default)
```

Tests rodam no environment `node` (ver `vitest.config.ts`); o alias `@/*` aponta para a raiz do repo.

### Service em produção

```bash
sudo systemctl restart chatgpt.service  # NUNCA usar `nohup npx next start`
sudo journalctl -u chatgpt.service -f   # tail de logs
sudo fuser -k -9 3040/tcp             # se porta travar
```

Logs em `/var/log/chatgpt/{app,error}.log`. Service unit canônico em `systemd/chatgpt.service`.

### Antes de fechar uma rodada

`AGENTS.md` define o gate: rodar `npm run build` + `npx tsc --noEmit`, e `npm run lint` quando a mudança for ampla. Não declarar tarefa concluída com build quebrado.

## Arquitetura — pontos não-óbvios

### 1. `proxy.ts` é middleware do Next 16

Next 16 renomeou `middleware.ts` → `proxy.ts`. **Não há `middleware.ts` no repo.** O arquivo `proxy.ts` na raiz exporta `proxy()` + `config.matcher` e roda em todas as rotas não-estáticas, encadeando três responsabilidades num pipeline único:

1. **Auth gate** (se `AUTH_ENABLED=true`): valida cookie JWT `auth-token` via `lib/server/auth.ts`. Login usa `AUTH_USERNAME` + `AUTH_PASSWORD`. Rotas em `PUBLIC_PATHS` passam direto. Rotas `/api/*` retornam 401 JSON; demais redirecionam para `/login`.
2. **Rate limit**: paths em `RATE_LIMITED_PATHS` (`/api/chat`, `/api/transcribe`, `/api/auth/login`, `/api/integrations/google/auth/start`, `/api/calendar/events`, `/api/workspace-notes`) passam por `lib/security/rateLimit.ts`. Login e o início do OAuth Google são rate-limited mesmo sendo públicos.
3. **Security headers**: CSP, HSTS, X-Frame-Options DENY etc. — aplicados em todas as respostas.

Auth tem **dupla checagem**: além do proxy, `app/page.tsx` faz server-side guard via `verifyAuthToken` antes de renderizar. Mexer em auth exige atualizar os dois pontos. Em produção, o cookie precisa sair com `Path=/chat`, sem barra final; `Path=/chat/` reabre o loop mobile entre `/chat` e `/chat/login`.

### 2. OpenAI Responses API e DeepSeek

`app/api/chat/route.ts` usa `openai.responses.create()` para modelos OpenAI — não `chat.completions`. `deepseek-v4-pro` é exceção explícita: passa por `lib/server/deepseekChat.ts`, só no chat padrão streaming, com `DEEPSEEK_API_KEY` server-side e tool local `fresh_web_context` que pode chamar OpenAI `web_search_preview`.

Não trocar o fluxo OpenAI para completions — o painel de reasoning, citações de web search e o fluxo de artefatos dependem dos eventos tipados da Responses API.

Reasoning tem contrato próprio: `lib/chat/reasoningConfig.ts` decide se envia `reasoning`
e protege `summary=off` omitindo o campo. `streamMachine` deve continuar aceitando
`response.reasoning_summary_text.delta`, `response.reasoning_summary_text.done`,
`response.reasoning_summary_part.done` e `response.reasoning_text.done`. Se a API não
emitir summary textual, `ReasoningPanel` ainda usa `reasoning_tokens` em
`response.completed` para mostrar que o raciocínio foi aplicado.

### 3. Quiz é caso especial — preservar branches

`responseMode === "quiz"` em `/api/chat/route.ts` força:
- modelo `QUIZ_FORCED_MODEL` (definido em `lib/artifacts/quizArtifacts.ts`)
- `reasoning.effort = QUIZ_FORCED_REASONING_EFFORT`
- `text.format = quizResponseSchema` (JSON Schema estruturado)
- `tools = []` (sem image_generation/web_search/code_interpreter)
- `stream = false` (sempre não-streaming, mesmo se cliente pedir)

Qualquer refactor em `buildRequestParams` ou `buildTools` precisa manter esses overrides intactos.

### 4. Catálogo de modelos é fonte de verdade

`lib/models/modelConfig.ts` define `MODELS` + helpers (`isReasoningModel`, `modelSupportsTemperature`, `modelSupportsVerbosity`, `modelSupportsCodeInterpreter`). O gate `ALLOWED_MODELS` na rota é derivado daí (apenas modelos com capability `chat` ou `reasoning`).

Adicionar modelo novo → editar `MODELS`, conferir que o `ChatComposer`/`ModelSelector` o exibe e que helpers retornam o flag correto. Modelo padrão atual do chat: `gpt-5.6-luna` com reasoning `low` e modo `standard`; `gpt-5.4-mini` permanece compatível para fluxos internos e seleções antigas migram para Luna no chat padrão.

Os modos `deepsearch_medium` e `deepsearch_high` reaproveitam o pipeline de documento/canvas: Medium força `gpt-5.4-mini/high` e High força `gpt-5.4/high`.

Não remontar reasoning manualmente em componentes: o caminho suportado é
`settingsStore` → `buildReasoningConfig` → `/api/chat` → `streamMachine` → `ReasoningPanel`.

### 5. `useChat.ts` é o orquestrador-mãe

Hook único que conecta:
- `chatStore` (Zustand) — estado ativo da conversa
- `settingsStore` — modelo/effort/verbosity/temperature
- TanStack Query (`hooks/queries/`) — cache de conversations
- `streamMachine` — reducer de eventos SSE
- `lib/openai/buildInput` + `contextBuilder` — montagem do payload (custom instructions + memories + persona)
- `lib/storage/conversations` (server) com retry em `conversationPersistence.ts`

Mudanças em fluxo de envio/persistência devem ser pensadas em `useChat.ts` antes de mexer em componentes.

### 6. Shell único: workspace-v2 (pós-S0)

- **`components/workspace-v2/*`** — shell ATIVO (Gaúcho Chat). `app/page.tsx` renderiza `GauchoChatShellV2`.
- **`components/chat/*`** — peças compartilhadas (balões, reasoning, export, composer).

O shell legado (`components/layout/*`, `components/sidebar/*`, `components/chat/InputArea.tsx`, `components/artifacts/ArtifactPanel.tsx`, `hooks/useSwipeGesture.ts`, `lib/layout/panels.ts`) foi removido na Sprint 0. Tag de retorno `pre-redesign-s0` em `9d36822` se precisar voltar.

### 7. Storage server-side em JSON

- **Server**: `data/conversations.json`, `data/memories.json`, `data/persona.json` — JSON files lidos/escritos por `lib/storage/conversations.ts`, `lib/storage/memories.ts` e `/api/persona`. Endpoints `/api/conversations`, `/api/memories`, `/api/persona` operam sobre eles.
- **Memória semântica/RAG**: `/api/memory/index`, `/api/memory/search` e `/api/memory/suggestions*` vivem em `app/api/memory/*`; implementação em `lib/server/memory/*` e `lib/storage/memoryRag.ts`.
- **Agenda/Notas locais**: `data/google-calendar-token.json`, `data/calendar-event-drafts.json` e `data/workspace-notes.json` são runtime privado e ignorados pelo Git. O token Google é criptografado em `lib/google/tokenStore.ts` e exige `GOOGLE_TOKEN_ENCRYPTION_KEY`.
- **Client**: `useConversations` usa TanStack Query (`hooks/queries/useConversationQuery.ts`) para cache/invalidacao das conversas; `useMemories` faz bootstrap em store Zustand a partir da API/storage server-side.
- **Persistência com retry**: `lib/storage/conversationPersistence.ts` envolve writes server-side com `withConversationPersistenceRetry`.
- **Persistência incremental durante streaming**: `useChat.ts` faz flush síncrono antes do fetch, auto-save throttled a cada 2 s, e beacon no unload via `saveConversationMessagesViaBeacon` (`lib/storage/conversations.ts`). Na carga, mensagens com `streamStatus === "streaming"` são normalizadas para `"interrupted"`. `/api/conversations/[id]` aceita POST além de PUT (necessário para `navigator.sendBeacon`).

### 8. basePath `/chat` é load-bearing

`NEXT_PUBLIC_BASE_PATH=/chat` está em `next.config.ts`, no systemd unit, no Apache vhost e em `lib/utils.ts:apiUrl()`. **Mexer em qualquer um sem atualizar os outros quebra o reverse proxy.** Detalhes em `docs/INFRASTRUCTURE.md`.

Apache vhost canônico: `/etc/apache2/sites-enabled/ultrassom.ai-optimized.conf`. Config local: `apache-config/chat.conf`.

Para `/chat`, a regra crítica de cookie no Apache é `ProxyPassReverseCookiePath / /chat`. Não trocar para `/chat/` — e ela deve viver **DENTRO do `<Location /chat>`**, nunca solta no vhost: no nível do vhost ela reescreve o `Path` dos cookies de TODOS os serviços do ultrassom.ai (incidente 2026-07-11: quebrou a auth de imagens do Sonaris com 401).

### 9. Tools default-on (exceto quiz)

`buildTools` em `lib/server/chatRequest.ts` adiciona tools conforme o modo:

- `responseMode="default"`: `image_generation`, `web_search_preview` (country `BR`, `search_context_size: medium`), `remember_memory`, `search_memory` e `code_interpreter` opcional.
- `document` e `deepsearch_*`: `web_search_preview` e `code_interpreter` opcional; sem imagem nem memory tools.
- `quiz`: `tools = []`.

As memory tools são executadas por `lib/server/chatToolOrchestrator.ts`, com até duas rodadas de function-call/output antes da resposta final. `remember_memory` cria memória ativa só quando o modelo chama a tool; `search_memory` consulta o RAG local. `code_interpreter` continua opt-in via `codeInterpreterEnabled` + capability do modelo.

### 9b. Agenda Google e notas locais

Rotas server-side novas:

- `/api/integrations/google/status|auth/start|auth/callback|disconnect`
- `/api/calendar/events`, `/api/calendar/events/draft`, `/api/calendar/events/draft-from-text`, `/api/calendar/events/drafts`, `/api/calendar/events/confirm`
- `/api/workspace-notes`, `/api/workspace-notes/[id]`

Regra central: `draft` e `draft-from-text` nunca escrevem no Google. Somente `confirm` chama Calendar API e apenas para draft `pending`. Google Keep segue fora da V1.

### 10. Streaming buffer estável por `message.id`

Os balões do assistente usam **key estável `message.id`** — não incluir `artifact.id` na key, senão o componente remonta no fim do stream e o buffer STT-style de `useStreamingTextBuffer.ts` reinicia visualmente. Isso é registrado em `AGENTS.md` como regra explícita.

Se o usuário recarregar a página durante o stream, a mensagem parcial é preservada no servidor (via beacon no unload) e exibida com `streamStatus === "interrupted"` na próxima carga — o buffer não reinicia porque a mensagem já está persistida com o conteúdo parcial.

### 11. Sistemas do redesign (pós-S0)

- **Tokens `--gc-*`** em `app/globals.css` — substitui `--v2-*`/`--app-*`/`--glass-*`. Breakpoints: `md=768`, `lg=1024 (sidebar)`, `xl=1280 (painel contextual)`.
- **`components/motion/`** — `FadeIn`, `SlideIn`, `Pop`, `Drawer` encapsulam framer-motion com tokens `--gc-duration-*`.
- **`ArtifactPreviewSheet`** — preview principal de artefatos acionado pelo chat canvas; documentos têm exportação PDF A4 server-side e download de fonte, sem ação de imprimir no painel atual.
- **`CommandPalette` + `CommandPaletteProvider`** — cmd+k via `cmdk`. Z-index 300 (acima do canvas 150).
- **`NotesProvider`** — Context em `components/workspace-v2/NotesProvider.tsx`. `appendToNotes` lança toast se painel não montado.
- **`SelectionToolbar`** + `useTextSelection` — toolbar Notion-like ao selecionar texto em balões.
- **`ExportDropdown`** — consome `useExport` internamente; slot `exportControl` em `WorkspaceFrameV2`.
- **`getReasoningLabel`** em `lib/models/modelConfig.ts` — chips do header conectados ao estado real.
- **Densidade mobile `--gc-mobile-*`** em `app/globals.css` — implementação paralela ao fluxo Codex que compacta o shell mobile em cerca de 15% por tokens de espaçamento/altura/radius. Não usar `zoom`, viewport fake ou `transform: scale()` global; ajustar primeiro os tokens.

## Convenções específicas do repo

- **Path alias**: `@/*` → raiz (configurado em `tsconfig.json` e `vitest.config.ts`).
- **Testes adjacentes**: `*.test.ts` mora ao lado do arquivo testado. Não há diretório `/tests`.
- **Erros API**: usar `jsonError(status, message, { code })` de `lib/api/errors.ts` em vez de `Response.json` cru.
- **Stores Zustand minimalistas**: três stores (`chatStore`, `settingsStore`, `uiStore`) com setters explícitos; reducers complexos vivem em `lib/chat/*`, não no store.
- **Stream events**: nunca consumir SSE no componente diretamente — passar pelo reducer (`reduceAssistantStreamEvent` + `assistantStreamStateToMessagePatch`).
- **Imagens permitidas**: domains em `next.config.ts` (`**.openai.com`, `ultrassom.ai`).

## Anti-patterns conhecidos

- Tentar adicionar trailing-slash rewrite a `/chat` no Apache → loop de redirect com basePath do Next.
- Trocar o cookie path para `/chat/` → login funciona em `/chat/login`, mas `/chat` fica sem cookie e entra em loop no mobile.
- Usar `chat.completions` em vez de `responses.create` → quebra reasoning/citations/artifacts.
- Subir o app com `nohup npx next start` em vez de systemd → `ExecStartPre` do unit faz `fuser -k 3040/tcp` antes de subir, então duas instâncias se atropelam.
- Esquecer do `AUTH_ENABLED` ao testar local: com flag `false` o proxy passa direto e `app/page.tsx` não redireciona.
