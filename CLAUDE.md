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
| S11 | Mobile Pass | **PRÓXIMA** | Médio |
| S12 | Polimento Final | Pendente | Baixo |

**Tag de retorno:** `pre-redesign-s0` (criada em `9d36822`). Reverter o redesign inteiro: `git checkout pre-redesign-s0 -- .`.

**Pré-requisitos:** Antes de começar uma sprint, ler o plan file completo (`/root/.claude/plans/meu-velho-na-verdade-golden-creek.md`) — contém arquivos-alvo, riscos, validação manual e os 3 apêndices (tokens `--gc-*`, escala tipográfica, escala animação).

### KICKOFF — Sprint 11 (Mobile Pass)

> **Branch:** `redesign/s11-mobile`. **Estado base:** S10 mergeado em `main`. **Risco:** Médio.
>
> **Objetivo:** Garantir que o shell funcione bem em mobile (< 768px). Revisar layouts, espaçamentos, tamanhos de fonte e interações touch no `GauchoChatShellV2` e seus filhos.
>
> **Estado pós-S10:**
> - `ExportDropdown` conectado ao header via slot `exportControl`.
> - `window.print()` removido. Shell V2 está completo funcionalmente.
>
> Leia o plan file em `/root/.claude/plans/meu-velho-na-verdade-golden-creek.md` para os detalhes da S11 antes de começar.

---

## Leitura obrigatória antes de codar

Este `CLAUDE.md` complementa — não substitui — outros docs vivos do repo:

- **`AGENTS.md`** — estado atual do produto, últimas rodadas e pontos de atenção. Sempre conferir antes de mudar UX/markdown/streaming.
- **`README.md`** — highlights de produto, endpoints e estrutura de pastas.
- **`docs/INFRASTRUCTURE.md`** — Apache reverse proxy, systemd, deploy, env vars.
- **`docs/MODELS.md`**, **`docs/API.md`**, **`docs/COMPONENTS.md`** — referências específicas.

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
sudo systemctl restart chatgpt        # NUNCA usar `nohup npx next start`
sudo journalctl -u chatgpt -f         # tail de logs
sudo fuser -k -9 3040/tcp             # se porta travar
```

Logs em `/var/log/chatgpt/{app,error}.log`. Service unit canônico em `systemd/chatgpt.service`.

### Antes de fechar uma rodada

`AGENTS.md` define o gate: rodar `npm run build` + `npx tsc --noEmit`, e `npm run lint` quando a mudança for ampla. Não declarar tarefa concluída com build quebrado.

## Arquitetura — pontos não-óbvios

### 1. `proxy.ts` é middleware do Next 16

Next 16 renomeou `middleware.ts` → `proxy.ts`. **Não há `middleware.ts` no repo.** O arquivo `proxy.ts` na raiz exporta `proxy()` + `config.matcher` e roda em todas as rotas não-estáticas, encadeando três responsabilidades num pipeline único:

1. **Auth gate** (se `AUTH_ENABLED=true`): valida cookie JWT `auth-token` via `lib/server/auth.ts`. Rotas em `PUBLIC_PATHS` passam direto. Rotas `/api/*` retornam 401 JSON; demais redirecionam para `/login`.
2. **Rate limit**: paths em `RATE_LIMITED_PATHS` (`/api/chat`, `/api/transcribe`, `/api/auth/login`) passam por `lib/security/rateLimit.ts`. Login é rate-limited mesmo sendo público.
3. **Security headers**: CSP, HSTS, X-Frame-Options DENY etc. — aplicados em todas as respostas.

Auth tem **dupla checagem**: além do proxy, `app/page.tsx` faz server-side guard via `verifyAuthToken` antes de renderizar. Mexer em auth exige atualizar os dois pontos.

### 2. OpenAI Responses API (não completions)

`app/api/chat/route.ts` usa `openai.responses.create()` — não `chat.completions`. Eventos SSE são serializados manualmente como `data: ${JSON.stringify(event)}\n\n`, terminando com `data: [DONE]\n\n`. O cliente consome via `extractSsePayloads` + reducer em `lib/chat/streamMachine.ts`.

Não trocar para completions — o painel de reasoning, citações de web search e o fluxo de artefatos dependem dos eventos tipados da Responses API.

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

Adicionar modelo novo → editar `MODELS`, conferir que o `ChatComposer`/`ModelSelector` o exibe e que helpers retornam o flag correto. Modelo padrão atual: `gpt-5.3-chat-latest`.

### 5. `useChat.ts` é o orquestrador-mãe

Hook único que conecta:
- `chatStore` (Zustand) — estado ativo da conversa
- `settingsStore` — modelo/effort/verbosity/temperature
- TanStack Query (`hooks/queries/`) — cache de conversations
- `streamMachine` — reducer de eventos SSE
- `lib/openai/buildInput` + `contextBuilder` — montagem do payload (custom instructions + memories + persona)
- `lib/storage/conversations` (server) + Dexie (client) com retry em `conversationPersistence.ts`

Mudanças em fluxo de envio/persistência devem ser pensadas em `useChat.ts` antes de mexer em componentes.

### 6. Shell único: workspace-v2 (pós-S0)

- **`components/workspace-v2/*`** — shell ATIVO (Gaúcho Chat). `app/page.tsx` renderiza `GauchoChatShellV2`.
- **`components/chat/*`** — peças compartilhadas (balões, reasoning, export, composer).

O shell legado (`components/layout/*`, `components/sidebar/*`, `components/chat/InputArea.tsx`, `components/artifacts/ArtifactPanel.tsx`, `hooks/useSwipeGesture.ts`, `lib/layout/panels.ts`) foi removido na Sprint 0. Tag de retorno `pre-redesign-s0` em `9d36822` se precisar voltar.

### 7. Storage dual: server JSON + client Dexie

- **Server**: `data/conversations.json`, `data/memories.json`, `data/persona.json` — JSON files lidos/escritos por `lib/storage/conversations.ts` e `lib/storage/memories.ts`. Endpoints `/api/conversations`, `/api/memories`, `/api/persona` operam sobre eles.
- **Client**: Dexie IndexedDB em `lib/storage/db.ts` (database `GauchoChatDB`, version 2). `useConversations`/`useMemories` hooks consomem tanto o servidor quanto o cache local.
- **Persistência com retry**: `lib/storage/conversationPersistence.ts` envolve writes server-side com `withConversationPersistenceRetry`.

### 8. basePath `/chat` é load-bearing

`NEXT_PUBLIC_BASE_PATH=/chat` está em `next.config.ts`, no systemd unit, no Apache vhost e em `lib/utils.ts:apiUrl()`. **Mexer em qualquer um sem atualizar os outros quebra o reverse proxy.** Detalhes em `docs/INFRASTRUCTURE.md`.

Apache vhost canônico: `/etc/apache2/sites-enabled/ultrassom.ai-optimized.conf`. Config local: `apache-config/chat.conf`.

### 9. Tools default-on (exceto quiz)

`buildTools` em `/api/chat/route.ts` adiciona por padrão `image_generation` + `web_search_preview` (country `BR`, `search_context_size: medium`). `code_interpreter` é opt-in via `codeInterpreterEnabled` + capability do modelo.

### 10. Streaming buffer estável por `message.id`

Os balões do assistente usam **key estável `message.id`** — não incluir `artifact.id` na key, senão o componente remonta no fim do stream e o buffer STT-style de `useStreamingTextBuffer.ts` reinicia visualmente. Isso é registrado em `AGENTS.md` como regra explícita.

## Convenções específicas do repo

- **Path alias**: `@/*` → raiz (configurado em `tsconfig.json` e `vitest.config.ts`).
- **Testes adjacentes**: `*.test.ts` mora ao lado do arquivo testado (`lib/chat/streamMachine.ts` ↔ `lib/chat/streamMachine.test.ts`). Não há diretório `/tests`.
- **Erros API**: usar `jsonError(status, message, { code })` de `lib/api/errors.ts` em vez de `Response.json` cru.
- **Stores Zustand minimalistas**: três stores (`chatStore`, `settingsStore`, `uiStore`) com setters explícitos; reducers complexos vivem em `lib/chat/*`, não no store.
- **Stream events**: nunca consumir SSE no componente diretamente — passar pelo reducer (`reduceAssistantStreamEvent` + `assistantStreamStateToMessagePatch`).
- **Imagens permitidas**: domains em `next.config.ts` (`**.openai.com`, `ultrassom.ai`).

## Anti-patterns conhecidos

- Tentar adicionar trailing-slash rewrite a `/chat` no Apache → loop de redirect com basePath do Next.
- Usar `chat.completions` em vez de `responses.create` → quebra reasoning/citations/artifacts.
- Subir o app com `nohup npx next start` em vez de systemd → `ExecStartPre` do unit faz `fuser -k 3040/tcp` antes de subir, então duas instâncias se atropelam.
- Esquecer do `AUTH_ENABLED` ao testar local: com flag `false` o proxy passa direto e `app/page.tsx` não redireciona.
