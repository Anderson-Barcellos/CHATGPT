# Progresso - Agenda Google + Notas Locais

**Ultima atualizacao:** 2026-06-04 20:45

Este e o quadro vivo da frente Agenda Google + Notas locais com STT. Use este arquivo para atualizar andamento durante os bundles; use `AGENTS.md` para memoria operacional depois de uma rodada significativa.

Para retomar em sessao fresh, comece por `docs/CALENDAR_NOTES_FRESH_KICKOFF.md`.

## Painel Rapido

| Area | Estado | Proximo passo |
|---|---|---|
| Backend Google/Notas | Implementado | Validar env OAuth real e token criptografado em producao |
| UI Agenda | Implementado | Testar no navegador real com Google conectado/desconectado |
| Captura por voz | Implementado | Testar uma frase completa e uma frase incompleta na aba `Agenda` |
| Rascunho por linguagem natural | Implementado | Criar rascunho local e confirmar que nada escreve no Google antes de `Confirmar` |
| Edicao/descarte de rascunho | Implementado | Editar, salvar e descartar um rascunho local no painel `Agenda` |
| OAuth Google real | Pendente de configuracao/env | Configurar credenciais e redirect URI no Google Cloud sem expor segredo |

**Regra de seguranca atual:** `draft`, `draft-from-text`, `drafts/[id]` e `drafts/[id]/discard` mexem apenas no storage local. Somente `/api/calendar/events/confirm` escreve no Google Calendar.

**Teste recomendado agora:** primeiro validar `/chat` com Google desconectado, depois configurar OAuth e testar o ciclo completo com um rascunho temporario claramente descartavel.

## ROADPACK Atual

| Bundle | Status | Resultado atual |
|---|---|---|
| C1 - Backend e contratos | Implementado, aguardando revisao final do Anders | OAuth Google server-side, token local criptografado, eventos, rascunhos confirmaveis e notas locais globais |
| C2 - Aba Agenda | Implementado, aguardando revisao final do Anders | Painel `Agenda`, status Google, eventos, rascunhos pendentes, confirmar/desconectar/atualizar |
| C3 - Captura STT e notas globais | Implementado, aguardando revisao final do Anders | Capturas por voz em `Notas` e `Agenda`, persistencia em `/api/workspace-notes`, listagem e exclusao |
| C4 - Rascunho por linguagem natural | Implementado, aguardando revisao final do Anders | Texto do chat ou STT vira rascunho local via `/api/calendar/events/draft-from-text`, sempre com confirmacao visual antes de escrever no Google |
| C5 - Revisao e edicao de rascunhos antes de confirmar | Implementado, aguardando revisao final do Anders | Rascunhos `pending` agora podem ser editados e descartados de forma persistente antes de qualquer confirmacao no Google |

## Proximo Bundle Candidato

**Revisao manual C3-C5 + OAuth Google real**

Objetivo: validar no navegador real o fluxo voz/notas/rascunhos/edit/save/discard/confirm e, quando houver env Google completo, testar OAuth real em producao.

Motivo: C5 fechou o ciclo local seguro; a proxima incerteza relevante e experiencia manual + credenciais reais do Google.

## Tarefas Em Aberto

| Item | Status | Observacao |
|---|---|---|
| Revisao manual do C3-C5 no browser real do Anders | Aberto | Testar frase completa, frase incompleta, captura por voz, edicao, salvar e descartar na aba `Agenda` |
| Smoke autenticado criando rascunho real | Pendente por escolha conservadora | Evitado para nao deixar rascunho temporario em `data/calendar-event-drafts.json` sem cleanup seguro |
| Endpoint persistente de descartar rascunho | Fechado em C5 | `POST /api/calendar/events/drafts/[id]/discard` marca `discarded` localmente |
| Edicao visual de rascunho antes de confirmar | Fechado em C5 | Card de rascunho ganhou modo inline para titulo, inicio, duracao, local e descricao |
| OAuth Google real em producao | Depende de env | Exige credenciais Google e `GOOGLE_TOKEN_ENCRYPTION_KEY` configuradas sem expor segredo |

## Regra De Atualizacao

Ao iniciar, pausar ou finalizar qualquer bundle desta frente:

- atualizar este arquivo primeiro;
- atualizar `AGENTS.md` no fechamento de rodada significativa;
- atualizar `API.md`/`ARCHITECTURE.md` apenas quando contrato ou arquitetura mudarem.
