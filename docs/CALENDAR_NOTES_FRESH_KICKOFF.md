# Kickoff Fresh - Agenda Google + Notas Locais

**Data:** 2026-06-04 20:45
**Projeto:** Gaucho Chat em `/root/CHATGPT`
**Documento vivo relacionado:** `docs/CALENDAR_NOTES_PROGRESS.md`

## Objetivo Da Proxima Sessao

Retomar a frente **Agenda Google + Notas locais com STT** sem rederivar contexto. C1-C5 ja estao implementados e aguardam revisao final do Anders; o proximo foco recomendado e **revisao manual C3-C5 + OAuth Google real em producao**.

## Estado Atual

| Bundle | Estado | Resumo |
|---|---|---|
| C1 - Backend e contratos | Implementado | OAuth Google server-side, token local criptografado, eventos, rascunhos confirmaveis e notas locais globais |
| C2 - Aba Agenda | Implementado | Tab `Agenda`, status Google, eventos, rascunhos pendentes e confirmacao manual |
| C3 - Captura STT | Implementado | Capturas por voz em `Notas`/`Agenda`, transcricao via `/api/transcribe`, persistencia em `/api/workspace-notes` |
| C4 - Texto para rascunho | Implementado | Chat/STT cria rascunho local via `/api/calendar/events/draft-from-text`, sem escrever no Google |
| C5 - Revisao de rascunhos | Implementado | Card de rascunho permite editar, salvar localmente e descartar antes de confirmar |

Regra central preservada: **somente `/api/calendar/events/confirm` escreve no Google Calendar**. `draft`, `draft-from-text`, `drafts/[id]` e `drafts/[id]/discard` operam apenas em rascunhos locais.

## Painel De Retomada

| Frente | Situacao | Acao sugerida |
|---|---|---|
| UI sem Google conectado | Pronta para revisar | Abrir painel `Agenda`, checar status, capturas e rascunhos locais |
| STT para agenda | Pronta para revisar | Testar frase completa e frase incompleta na aba `Agenda` |
| Rascunhos locais | Prontos para revisar | Criar, editar, salvar e descartar um rascunho temporario |
| OAuth Google | Depende de env | Configurar credenciais Google e `GOOGLE_TOKEN_ENCRYPTION_KEY` |
| Escrita no Google | Protegida | Testar apenas depois do OAuth conectado e com evento temporario |

## OAuth Google

Para teste real da API, conferir:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `GOOGLE_CALENDAR_DEFAULT_ID`
- `GOOGLE_CALENDAR_DEFAULT_TIME_ZONE`
- `GOOGLE_TOKEN_ENCRYPTION_KEY`

Redirect URI esperado no Google Cloud: `https://ultrassom.ai/chat/api/integrations/google/auth/callback`.

## Arquivos-Chave

- `components/workspace-v2/AgendaPanelV2.tsx`
- `lib/calendar/eventDrafts.ts`
- `lib/calendar/calendarApi.ts`
- `app/api/calendar/events/drafts/route.ts`
- `app/api/calendar/events/drafts/[id]/route.ts`
- `app/api/calendar/events/drafts/[id]/discard/route.ts`
- `app/api/calendar/events/draft/route.ts`
- `app/api/calendar/events/confirm/route.ts`
- `docs/CALENDAR_NOTES_PROGRESS.md`
- `AGENTS.md`

## Tarefas Abertas

| Item | Status | Observacao |
|---|---|---|
| Revisao manual C3-C5 no browser real | Aberto | Testar captura, rascunho, edicao, salvar e descartar |
| Smoke autenticado com rascunho real | Pendente | Fazer so com cleanup seguro ou evitar |
| Descarte persistente | Fechado em C5 | `POST /api/calendar/events/drafts/[id]/discard` |
| Edicao visual de rascunho | Fechado em C5 | `PATCH /api/calendar/events/drafts/[id]` |
| OAuth Google real | Depende de env | Exige credenciais Google e `GOOGLE_TOKEN_ENCRYPTION_KEY` |

## Validacao Esperada

Seguir a escada do `AGENTS.md`:

- Atualizar checklist visual ao longo do trabalho.
- `git diff --check`.
- Teste focado para storage/rotas/wrappers novos.
- `npx tsc --noEmit`.
- `npm test`.
- `npm run build` se tocar fluxo principal/API/UI.
- Se reiniciar runtime, consultar `/etc/apache2/APACHE.md`, reiniciar `chatgpt.service` e checar health local/publico.

Evitar alterar dados runtime privados como `data/conversations.json`, `data/persona.json`, `data/calendar-event-drafts.json` e `data/workspace-notes.json` salvo necessidade inevitavel com cleanup.

## Como Retomar

1. Ler `AGENTS.md`, `docs/CALENDAR_NOTES_PROGRESS.md` e este arquivo.
2. Conferir `git status --short` para separar trabalho preexistente.
3. Atualizar o checklist visual da sessao.
4. Fazer revisao manual C3-C5 ou configurar OAuth Google real.
5. Ao fim, atualizar `docs/CALENDAR_NOTES_PROGRESS.md` e registrar em `AGENTS.md`.
