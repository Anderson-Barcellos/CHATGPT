# Kickoff - Agenda Google + Notas Locais com STT

> Status: documento historico de kickoff. O andamento vivo desta frente agora fica em `docs/CALENDAR_NOTES_PROGRESS.md`.

## Objetivo

Implementar uma V1 de agenda e capturas no Gaucho Chat sem transformar o app em um cliente Google generico. O desenho fechado e:

- Google Calendar real para compromissos, via OAuth proprio server-side.
- Notas locais no servidor para capturas manuais, trechos do chat e STT.
- `/api/transcribe` reaproveitado como caminho oficial de fala-para-texto.
- Google Keep fora da V1.
- Aba `Agenda` no painel direito, junto de `Atividade` e `Notas`.
- Rascunho + confirmacao antes de criar, alterar ou cancelar eventos.

## Decisoes Fechadas

### Google Calendar

Usar a Calendar API diretamente no backend do Next, com credenciais OAuth do proprio app. O cliente nunca recebe `client_secret`, `refresh_token` ou token bruto.

Rotas de OAuth planejadas:

- `GET /api/integrations/google/auth/start`
- `GET /api/integrations/google/auth/callback`
- `GET /api/integrations/google/status`
- `POST /api/integrations/google/disconnect`

Rotas de agenda planejadas:

- `GET /api/calendar/events`
- `POST /api/calendar/events/draft`
- `GET /api/calendar/events/drafts`
- `POST /api/calendar/events/confirm`

O endpoint de draft recebe uma intencao (`create`, `update`, `cancel`) e normaliza para um objeto pendente. O endpoint de confirmacao e o unico que escreve no Google Calendar.

Escopo inicial recomendado: `https://www.googleapis.com/auth/calendar.events`, porque cobre listagem e escrita de eventos sem pedir controle mais amplo do calendario inteiro. Se a V1 precisar listar calendarios alem de `primary`, reavaliar escopo antes de ampliar.

Configuracao esperada:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI=https://ultrassom.ai/chat/api/integrations/google/auth/callback`
- `GOOGLE_CALENDAR_DEFAULT_ID=primary`
- `GOOGLE_TOKEN_ENCRYPTION_KEY` ou estrategia equivalente de criptografia local

Timezone default: `America/Sao_Paulo`.

### OAuth E Tokens

O fluxo deve usar `access_type=offline` e `include_granted_scopes=true`, para receber refresh token quando o Google permitir e manter acesso server-side sem novo login a cada expiracao.

Storage sugerido:

- `data/google-calendar-token.json`, fora do cliente.
- Permissao `0600` no arquivo, se criado em runtime.
- Criptografar refresh/access token em repouso antes de persistir.
- Adicionar regra explicita no `.gitignore` se o arquivo ainda nao estiver coberto.

O status retornado ao browser deve ser apenas operacional: conectado ou nao, email/calendario quando disponivel, validade aproximada e erro recuperavel. Nao retornar tokens.

### Notas Locais

Notas locais ficam separadas das notas por conversa ja existentes em `workspace.notes`. A ideia e criar uma area global de capturas, com vinculo opcional a conversa e evento.

Rotas planejadas:

- `GET /api/workspace-notes`
- `POST /api/workspace-notes`
- `PUT /api/workspace-notes/[id]`
- `DELETE /api/workspace-notes/[id]`

Storage sugerido: `data/workspace-notes.json`.

Modelo minimo:

```ts
type WorkspaceNoteSource = "manual" | "chat" | "stt" | "calendar";

interface WorkspaceNote {
  id: string;
  title: string;
  body: string;
  source: WorkspaceNoteSource;
  conversationId?: string;
  sourceMessageId?: string;
  calendarEventId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
```

O `ContextPanelV2` continua mantendo as notas da rodada por conversa. A nova camada local entra como capturas persistentes e pesquisaveis, sem quebrar o contrato atual.

### STT

`app/api/transcribe/route.ts` ja existe, valida auth, valida arquivo e usa `gpt-4o-transcribe`. A V1 deve reaproveitar esse endpoint em vez de criar outro caminho de transcricao.

Fluxo esperado:

- UI grava audio curto no painel de Notas ou Agenda.
- Browser envia audio para `/api/transcribe`.
- Texto retornado vira nota local via `POST /api/workspace-notes`.
- Se a captura for de agenda, o texto tambem pode alimentar `/api/calendar/events/draft`.

Nao alterar `/api/transcribe` salvo se aparecer necessidade real de compartilhar util server-side ou melhorar validacao de arquivo.

### Google Keep Fora Da V1

Google Keep nao entra na primeira implementacao. A propria documentacao atual descreve a Keep API como REST API voltada a administradores/ambientes Google Workspace para gerir notas, permissoes e anexos, inclusive cenarios CASB. Para o nosso uso pessoal, isso adiciona escopo e complexidade sem melhorar o primeiro resultado.

Decisao: manter notas locais primeiro; se depois fizer sentido, Keep vira export/import opcional, nao dependencia central.

## Mapa Do Repo Atual

Pontos ja conferidos:

- `app/api/transcribe/route.ts`: caminho STT existente e autenticado.
- `components/workspace-v2/ContextPanelV2.tsx`: painel direito atual com tabs `Atividade` e `Notas`.
- `stores/uiStore.ts`: `activePanelTab` controla a tab ativa.
- `components/workspace-v2/NotesProvider.tsx` e `hooks/useNotes.ts`: bridge atual para anexar texto selecionado/notas ao painel.
- `docs/API.md`: precisara receber as novas rotas quando forem implementadas.
- `docs/ARCHITECTURE.md`: precisara registrar a nova camada `calendar + workspace-notes`.
- `docs/INFRASTRUCTURE.md`: precisara registrar env vars do Google, sem valores secretos.

Tambem foi confirmado que o repo esta com varias mudancas locais pre-existentes. Qualquer implementacao deve preservar esse estado e tocar apenas os arquivos do bundle ativo.

## Contrato De Rascunho

Toda acao externa deve passar por `CalendarEventDraft`.

```ts
type CalendarDraftAction = "create" | "update" | "cancel";

interface CalendarEventDraft {
  id: string;
  action: CalendarDraftAction;
  calendarId: string;
  eventId?: string;
  summary: string;
  description?: string;
  location?: string;
  start?: { dateTime: string; timeZone: string };
  end?: { dateTime: string; timeZone: string };
  attendees?: Array<{ email: string; displayName?: string }>;
  source: "chat" | "panel" | "stt";
  conversationId?: string;
  sourceMessageId?: string;
  status: "pending" | "confirmed" | "discarded" | "failed";
  createdAt: string;
  updatedAt: string;
}
```

Regras:

- `draft` nunca escreve no Google.
- `confirm` exige draft pendente e autenticacao.
- `cancel` tambem e rascunho antes de executar delete/cancelamento real.
- A UI precisa mostrar o diff humano antes de confirmar `update` ou `cancel`.
- O modelo pode sugerir dados, mas nao ganha autorizacao automatica para escrever.

## UI V1

A aba `Agenda` entra no `ContextPanelV2`, ao lado de `Atividade` e `Notas`.

Conteudo esperado:

- Estado de conexao Google: conectar, conectado, reconectar, desconectar.
- Hoje: eventos do dia.
- Proximos 7 dias: lista compacta.
- Rascunhos pendentes: cards com confirmar, editar e descartar.
- Criacao rapida: titulo, data/hora, duracao, descricao, local.

Notas locais devem aparecer na aba `Notas`, mantendo as notas da rodada e adicionando capturas persistentes abaixo ou em uma subsecao clara. Botao de STT deve gerar uma nota, nao substituir o texto existente sem confirmacao.

## Bundle Ativo Recomendado

### C1 - Fundacao server-side de Google Calendar e notas locais

Objetivo: criar contratos, storage e rotas backend sem ainda redesenhar o painel inteiro.

Arquivos provaveis:

- `lib/google/calendarClient.ts`
- `lib/google/oauth.ts`
- `lib/google/tokenStore.ts`
- `lib/calendar/eventDrafts.ts`
- `lib/storage/workspaceNotes.ts`
- `app/api/integrations/google/*`
- `app/api/calendar/events/*`
- `app/api/workspace-notes/*`
- Testes adjacentes `*.test.ts`

Validacao minima do bundle:

- `npm test`
- `npx tsc --noEmit`
- Smoke manual de `/api/integrations/google/status`
- Smoke sem token mostrando estado desconectado, sem erro 500

## ROADPACK

### Pack A - Backend e contratos (active)

Entregar OAuth, token store seguro, listagem de eventos, rascunhos, confirmacao e notas locais com testes.

### Pack B - Painel Agenda

Adicionar tab `Agenda`, estado conectado/desconectado, lista de eventos e cards de rascunho.

### Pack C - Captura STT e notas globais

Adicionar gravacao/transcricao no painel e persistencia em `workspace-notes`, preservando notas por conversa.

### Pack D - Chat como gerador de rascunhos

Transformar pedidos naturais do chat em rascunhos confirmaveis, sem tool com escrita direta.

## Validacao Antes De Implementar

Antes de codar o primeiro bundle:

- Ler `AGENTS.md` e `CLAUDE.md`.
- Conferir `git status --short` para preservar trabalho local do Anders.
- Conferir `/etc/apache2/APACHE.md` se alguma rota publica/proxy/env de producao entrar no bundle.
- Rodar `npm test` e `npx tsc --noEmit` para separar falha pre-existente de falha introduzida.
- So atualizar `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/INFRASTRUCTURE.md` e `AGENTS.md` quando a implementacao real de rotas/env/UI existir.

## Referencias Oficiais

- Google Calendar `events.insert`: https://developers.google.com/workspace/calendar/api/v3/reference/events/insert
- Google Calendar `events.list`: https://developers.google.com/workspace/calendar/api/v3/reference/events/list
- Google OAuth web server flow: https://developers.google.com/identity/protocols/oauth2/web-server
- Google Keep API overview: https://developers.google.com/workspace/keep/api/guides
