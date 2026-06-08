# Kickoff C2 - Aba Agenda e Estado de Conexao

> Status: documento historico de kickoff. C2, C3 e C4 ja foram implementados; o andamento vivo desta frente agora fica em `docs/CALENDAR_NOTES_PROGRESS.md`.

## Objetivo

Implementar o **Bundle C2** da feature Agenda Google + Notas locais com STT: expor a fundacao server-side do C1 no painel direito do Gaucho Chat, com uma nova aba `Agenda` ao lado de `Atividade` e `Notas`.

C2 e uma camada de UI/estado. Nao deve transformar pedidos do chat em eventos automaticamente, nao deve adicionar STT no painel ainda e nao deve ampliar escopos Google.

## Estado Atual

C1 ja entregou backend e contratos:

- `GET /api/integrations/google/status`
- `GET /api/integrations/google/auth/start`
- `GET /api/integrations/google/auth/callback`
- `POST /api/integrations/google/disconnect`
- `GET /api/calendar/events`
- `POST /api/calendar/events/draft`
- `GET /api/calendar/events/drafts`
- `POST /api/calendar/events/confirm`
- `GET|POST /api/workspace-notes`
- `PUT|DELETE /api/workspace-notes/[id]`

Arquivos runtime privados:

- `data/google-calendar-token.json`
- `data/calendar-event-drafts.json`
- `data/workspace-notes.json`

Ponto de acoplamento UI atual:

- `components/workspace-v2/ContextPanelV2.tsx` renderiza tabs `Atividade` e `Notas`.
- `stores/uiStore.ts` controla `activePanelTab`.
- `types/index.ts` define `ActivePanelTab = "activity" | "notes"`.

## Escopo Do C2

Adicionar a aba `Agenda` no painel direito, com:

- Estado de conexao Google: desconectado, configuracao pendente, conectado, erro/reconectar.
- CTA `Conectar Google` apontando para `/api/integrations/google/auth/start`.
- CTA `Desconectar` usando `POST /api/integrations/google/disconnect`.
- Lista `Hoje`, baseada em `/api/calendar/events`.
- Lista `Proximos 7 dias`, baseada em `/api/calendar/events`.
- Lista `Rascunhos pendentes`, baseada em `/api/calendar/events/drafts?status=pending`.
- Cards de rascunho com `Confirmar` e `Descartar/ocultar` visual se o backend ainda nao tiver endpoint de descarte.

Se Google nao estiver conectado, a UI ainda deve mostrar rascunhos locais pendentes, mas bloquear confirmacao real com texto claro.

## Fora De Escopo

- Interpretar pedidos naturais do chat como eventos.
- Adicionar tool/function calling para agenda.
- Adicionar gravacao STT no painel.
- Editar `app/api/transcribe`.
- Adicionar Google Keep.
- Ampliar escopo alem de `calendar.events`.
- Reescrever o painel direito inteiro ou redesenhar o workspace.
- Mexer em `data/conversations.json` ou `data/persona.json`.

## Contrato De UX

A aba `Agenda` precisa ser operacional, compacta e honesta:

- Se `oauthConfigured=false`, mostrar que o app ainda precisa das env vars do Google.
- Se `tokenStoreConfigured=false`, avisar que falta `GOOGLE_TOKEN_ENCRYPTION_KEY`.
- Se `connected=false` e configuracao estiver OK, mostrar `Conectar Google`.
- Se `connected=true`, mostrar eventos e permitir `Desconectar`.
- Se `/api/calendar/events` falhar por nao conectado, nao tratar como crash.
- Se o backend retornar erro Google, mostrar estado recuperavel.

Rascunhos:

- `draft.status=pending`: mostrar como aguardando confirmacao.
- `draft.status=failed`: mostrar erro e manter o rascunho visivel.
- `draft.status=confirmed`: nao precisa aparecer na lista pendente.
- Confirmacao sempre passa por clique explicito no card.

## Formato Visual Recomendado

Dentro de `ContextPanelV2`, manter o padrao atual:

- `TabsTrigger` pequeno, altura `h-8`, alinhado ao shell clinico.
- Cards `gc-clinical-card`/superficies existentes, sem cards dentro de cards.
- Textos curtos: `Hoje`, `Proximos 7 dias`, `Rascunhos`.
- Icones lucide discretos: `CalendarDays`, `Clock`, `Check`, `Plug`, `Unplug`, `RefreshCw`, `AlertTriangle`.
- Mobile deve continuar cabendo no painel atual com scroll interno.

## Arquivos Provaveis

- `types/index.ts`: incluir `ActivePanelTab = "activity" | "notes" | "calendar"`.
- `stores/uiStore.ts`: aceitar tab `calendar`.
- `components/workspace-v2/ContextPanelV2.tsx`: adicionar tab e conteúdo `Agenda`.
- `lib/calendar/calendarApi.ts` ou `lib/storage/calendar.ts`: client wrappers com `apiUrl`.
- `lib/storage/workspaceNotes.ts`: nao tocar salvo se C2 precisar apenas listar notas ligadas a evento; evitar confundir server storage com client wrapper.
- Testes adjacentes para wrappers e renderizacao/estado quando fizer sentido.

## Client Wrappers Sugeridos

Criar uma camada client-side simples para o painel, usando `apiUrl`:

- `getGoogleIntegrationStatus()`
- `disconnectGoogleIntegration()`
- `listCalendarEvents({ timeMin, timeMax })`
- `listCalendarDrafts({ status: "pending" })`
- `confirmCalendarDraft(draftId)`

Esses wrappers devem usar `parseApiErrorResponse` nos erros, como o padrao de `lib/storage/conversations.ts`.

## Validacao Esperada

Antes de fechar C2:

- `git diff --check`
- `npm test`
- `npx tsc --noEmit`
- `npm run build`
- `systemctl restart chatgpt.service`
- Health local: `http://127.0.0.1:3040/chat/api/health`
- Health publico: `https://ultrassom.ai/chat/api/health`
- Smoke sem cookie em rota nova segue retornando `401`.
- Playwright desktop e mobile confirmando:
  - tab `Agenda` existe;
  - estado desconectado/configuracao pendente nao quebra o painel;
  - rascunhos pendentes aparecem quando mockados ou criados localmente;
  - `Atividade` e `Notas` continuam funcionando.

## Riscos

- `ContextPanelV2.tsx` ja concentra bastante logica de notas; se crescer demais, extrair `AgendaPanelV2` dentro de `components/workspace-v2/`, sem refatorar o painel inteiro.
- Se env vars do Google nao estiverem configuradas, a UI deve continuar bonita e util, nao parecer erro fatal.
- Confirmar eventos reais no Google antes de ter UI de diff humano pode ser perigoso; C2 deve mostrar os dados do draft antes do clique.
- Nao esconder falha de token/decrypt: mostrar `Reconectar Google` quando o status indicar token invalido.

## Proximo Bundle Depois Do C2

C3 deve ser `Captura STT e notas globais`: botao de gravar no painel de Notas/Agenda, chamada a `/api/transcribe` e persistencia em `/api/workspace-notes`.

C4 deve ser `Chat como gerador de rascunhos`: transformar linguagem natural em draft local, sempre com confirmacao visual antes de escrever no Calendar.
