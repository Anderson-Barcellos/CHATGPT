# Relatório técnico — agendamento do Descobrir IA

## Resultado

O feed agora expõe a preferência persistida `schedule.enabled` e `nextScheduledAt`. A rota autenticada `PUT /api/discover/settings` grava somente o interruptor; não inicia curadoria nem chama provider. O runner diário retorna `paused` antes de ler ou executar o curador quando a automação está desligada. Atualizações manuais permanecem independentes.

## DECISÃO: intervalo civil e estado vencido

O cálculo usa `America/Sao_Paulo` e 08h como instante de referência. Com `lastDailyDate` válido, a data devida é dois dias civis depois; sem histórico, com data inválida ou vencida, a previsão é a próxima passagem futura das 08h. O claim diário só começa às 08h ou depois e grava a data local ao iniciar. Isso mantém o timer como verificador diário, impede chamada antecipada e não cria uma execução paga durante a reativação de um estado vencido.

Validação: `lib/discover/schedule.test.ts` cobre ausência de histórico, intervalo de dois dias, vencimento, pausa e a barreira anterior às 08h.

## DECISÃO: compatibilidade e concorrência

`readDiscoverState` normaliza arquivos antigos sem `schedule` como `{ enabled: true }`. `saveDiscoverSchedule` usa o mesmo lock de `discover.json` dos claims e grava o estado inteiro já normalizado, preservando assuntos, artigos, job e `lastDailyDate`. A pausa tem precedência para o claim diário sob esse lock; jobs já em andamento não são cancelados e claims manuais não consultam a preferência.

Validação: `lib/discover/store.test.ts` cobre legado, concorrência de claims pausados, preservação da pausa e dos artigos ao terminar uma execução já iniciada, ausência de alteração de `lastDailyDate` por manual e a falha que não libera nova diária no dia seguinte.

## DECISÃO: falha de persistência sem vazamento

Depois de validar o corpo, a rota de ajustes captura falhas de gravação ou da releitura necessária para calcular a previsão. Ela responde HTTP 500 com código `discover_schedule_update_failed` e mensagem genérica em PT-BR, sem estado de sucesso ou texto interno de I/O. O log também não inclui o objeto de erro para evitar refletir caminhos ou detalhes sensíveis.

Validação: `app/api/discover/settings/route.test.ts` simula uma falha com caminho sintético e confirma o payload 500 sem vazamento.

## Comandos e evidências

| Comando | Resultado |
|---|---|
| `npx vitest run lib/discover/store.test.ts lib/discover/store.rewrite.test.ts lib/discover/discover.test.ts lib/discover/schedule.test.ts lib/discover/runner.test.ts app/api/discover/route.test.ts app/api/discover/settings/route.test.ts app/api/discover/run-due/route.test.ts` | código 0; 8 arquivos, 24 testes aprovados |
| `npx tsc --noEmit` | código 0 |
| `git diff --check` | código 0 |

O primeiro teste focal revelou uma referência residual a `today` depois da extração da regra de vencimento; a referência foi restaurada no escopo do claim e a suíte foi repetida com sucesso. Não houve bloqueio. `npm test`, lint e build são gates do conjunto estabilizado, coordenados pelo orquestrador; não foram repetidos nesta frente.

Na revisão posterior foram incluídas viradas de mês/ano e dia bissexto no cálculo, além de prova de que `paused` e `not_due` não chegam ao curador. A checagem de tipos aprovada anteriormente não foi repetida porque esta rodada só adicionou testes e um `try/catch` local; o gate completo permanece com a integração estabilizada.

## Arquivos da frente

- `lib/discover/types.ts`, `store.ts`, `runner.ts` e novo `schedule.ts`
- `app/api/discover/route.ts` e novo `app/api/discover/settings/route.ts`
- testes de store, schedule, runner e rotas Discover

Nenhum arquivo foi removido ou substituído; a mudança é aditiva, exceto pela extensão do tipo de claim e do estado normalizado.
