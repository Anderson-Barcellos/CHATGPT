# Arquitetura

**Última atualização:** 2026-05-25

## Visão Geral

Celer Chat é um app Next.js com App Router que roda como BFF local para a OpenAI `Responses API`. O cliente React conversa apenas com rotas do próprio app; essas rotas cuidam de auth, rate limit, persistência local e chamadas server-side para OpenAI.

```text
Browser/PWA
  -> Next.js UI em /chat
  -> proxy.ts: auth, rate limit e headers
  -> app/api/*: BFF server-side
  -> OpenAI APIs e JSON store local
```

## Entrada e Shell

- `app/page.tsx` é a entrada autenticada e renderiza `GauchoChatShellV2`.
- `components/workspace-v2/*` contém o shell ativo: rail de conversas, canvas central, composer, painel de atividade/notas e preview de artifacts.
- `components/chat/*` concentra rendering de mensagens, markdown, reasoning, quick actions, TTS e export.
- `components/settings/*` concentra persona, memórias, tuning e preferências de voz.

O shell legado foi removido. Novas mudanças de UI devem seguir `workspace-v2`, tokens `--gc-*` em `app/globals.css` e os padrões atuais de componentes Radix/lucide.

## Fluxo de Chat

1. O composer chama `useChat`.
2. `useChat` monta payload com mensagens, anexos, persona, modelo e opções.
3. `POST /api/chat` valida auth, body e modelo.
4. A rota chama `openai.responses.create()` com streaming quando aplicável.
5. Eventos SSE passam pelo reducer em `lib/chat/streamMachine.ts`.
6. A mensagem do assistente é atualizada incrementalmente e persistida durante o stream.

Detalhes importantes:

- O body do chat é limitado a aproximadamente 10 MB.
- Desconexões do cliente abortam também a chamada upstream.
- Respostas interrompidas são preservadas e voltam como `streamStatus="interrupted"`.
- Anexos persistidos mantêm conteúdo real para reload/edit/resend.

## Auth e Proxy

`proxy.ts` é o middleware do Next 16. Ele:

- remove o `basePath` antes de comparar rotas;
- deixa públicos `/login`, `/api/auth/*`, `/api/health`, `_next` e assets;
- aplica rate limit em `/api/chat`, `/api/transcribe` e `/api/auth/login`;
- retorna `401` JSON para APIs privadas sem sessão;
- redireciona páginas privadas para `/login`.

`app/page.tsx` faz uma segunda checagem server-side antes de renderizar o shell.

Auth é controlada por:

- `AUTH_ENABLED`
- `AUTH_USERNAME`
- `AUTH_PASSWORD`
- `JWT_SECRET`

O cookie de sessão é `auth-token`, assinado com JWT HS256, `HttpOnly`, `SameSite=Lax`, TTL de 7 dias e path derivado de `NEXT_PUBLIC_BASE_PATH`.

## Persistência

Persistência server-side simples:

- `data/conversations.json`
- `data/memories.json`
- `data/persona.json`

Camadas principais:

- `lib/storage/conversations.ts`: CRUD e beacon para conversas.
- `lib/storage/memories.ts`: CRUD de memórias.
- `app/api/persona/route.ts`: persona, instruções customizadas e `ttsPreferences`.
- `lib/storage/conversationPersistence.ts`: retry/normalização de writes.

O cliente também usa stores Zustand e cache local, mas o estado canônico compartilhável fica no servidor JSON.

## Artifacts e Export

Artifacts são gerados a partir das respostas e exibidos pelo `ArtifactPreviewSheet`.

Fluxos relevantes:

- Documentos e quizzes têm preview e download de fonte.
- PDF de documento usa `/api/artifacts/pdf` com Playwright/Chrome server-side.
- Preview HTML no cliente permanece aceito para uso pessoal do app.

## Voz

O TTS padrão usa `/api/tts` com `gpt-4o-mini-tts`.

- Texto é sanitizado e dividido em chunks em `lib/tts/speechText.ts`.
- `hooks/useAssistantTts.ts` faz cache em memória, fila turbo e controle de playback.
- `/api/realtime/tts-call` é laboratório separado com `gpt-realtime-mini` via SDP/WebRTC.

## Modelos

O catálogo vive em `lib/models/modelConfig.ts`. O default atual é `gpt-5.1-chat-latest`. `responseMode="quiz"` força `gpt-5.4` com reasoning `high` e schema JSON.

## Regras Quebráveis

- Não trocar `Responses API` por `chat.completions`.
- Não adicionar rewrite com barra final para `/chat`.
- Não mudar `NEXT_PUBLIC_BASE_PATH=/chat` sem atualizar Apache, systemd e helpers.
- Não colocar `artifact.id` na key dos balões; a key estável é `message.id`.
- Não documentar valores reais de `.env.production` ou `.env.local`.
