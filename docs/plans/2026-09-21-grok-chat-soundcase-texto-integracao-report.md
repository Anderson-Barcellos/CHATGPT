# Relatório de integração da frente TEXTO — Grok 4.7

## Resultado observável

O adaptador xAI agora preserva os dois contratos da rota `/api/chat`: streaming SSE e resposta JSON com `stream: false`. Os dois caminhos executam o mesmo loop finito de ferramentas, aceitam memória e a ponte de imagem somente quando essas funções foram realmente oferecidas, exigem resposta terminal `completed`, agregam tokens de todas as chamadas Grok e interrompem o upstream quando o request ou o leitor é cancelado.

No modo padrão — inclusive quando `responseMode` é omitido — o Grok pode solicitar `remember_memory`, `search_memory` e `generate_image`. A imagem continua fora da xAI: uma chamada separada usa OpenAI Luna com `image_generation` em `gpt-image-2`, e o resultado volta pelo contrato de imagem que o chat já consome. Documento, Deepsearch e demais modos sem essas funções rejeitam function calls não oferecidas antes de qualquer efeito local.

Pulse mantém Grok para texto, com reasoning `medium`, pesquisa web e sem `verbosity`; citações xAI continuam no run. A imagem de abertura usa explicitamente OpenAI Luna, em vez de enviar por engano `model: grok-4.7` ao cliente OpenAI. Uma execução agendada sem credencial agora termina persistida como `failed` e avança a rotina, sem deixar um run órfão em `running`.

Studio mantém o painel somente-leitura com web search e as células sem ferramentas. Preferências persistidas com `gpt-5.4-mini` passam a resolver para Grok, enquanto o histórico permanece intacto. As extrações Pulse/agenda aceitam o alias legado nos overrides operacionais, fixam Grok/medium e recusam um modelo de provider incompatível antes da chamada.

O catálogo registra 500 mil tokens de contexto e as duas faixas de preço do Grok: US$ 2/0,50/6 por milhão abaixo de 200 mil tokens de entrada e US$ 4/1/12 a partir de 200 mil. A regra foi conferida na documentação oficial da xAI: [modelo Grok 4.7](https://docs.x.ai/developers/models/grok-4.7), [release notes](https://docs.x.ai/developers/release-notes) e [Responses API](https://docs.x.ai/developers/rest-api-reference/inference/responses).

## Arquivos desta revisão

- `lib/server/xaiChat.ts` e `lib/server/xaiChat.test.ts`: adaptador stream/nonstream, ferramentas, bridge de imagem, uso, terminais, abort e testes comportamentais.
- `app/api/chat/route.ts` e `app/api/chat/route.test.ts`: restauração de `stream: false` para Grok/alias mini.
- `lib/pulse/runner.ts` e `lib/pulse/runnerStart.test.ts`: provider correto, falha persistida sem chave e imagem OpenAI Luna.
- `lib/models/modelConfig.ts`, `lib/models/modelConfig.test.ts` e `types/index.ts`: tarifa de contexto longo.
- `lib/server/studioAssistant.test.ts`, `lib/studio/workspace.test.ts`, `stores/settingsStore.test.ts` e `stores/settingsStorePersistence.test.ts`: contratos Studio, alias de preferência e preservação de histórico.
- `lib/pulse/extractTask.test.ts` e `lib/calendar/naturalLanguageDraft.test.ts`: provider/modelo/effort/schema dos extratores, só com fixtures sintéticas.

Nenhum módulo ou import funcional foi removido. A recusa `chat_grok_stream_required` saiu da rota e foi substituída pela execução nonstream equivalente, restaurando o comportamento que o mini anterior oferecia. Não houve migração ou regravação de `data/*.json`, leitura de credencial, chamada paga, instalação, commit, push, build, serviço ou proxy.

## DECISÕES

- **Limite de ferramentas:** no máximo duas execuções de ferramentas depois da chamada inicial. Se a terceira resposta ainda pedir uma função, o adaptador falha antes de executá-la. Assim o teto é observável e não permite efeito lateral além do limite.
- **Funções autorizadas por request:** o executor deriva os nomes permitidos da lista `tools` já montada para aquela requisição. Uma function call ausente dessa lista falha antes de memória ou imagem. Isso cobre também respostas alucinadas em modos sem tools locais.
- **Continuação:** mantido `previous_response_id`, pois a Responses API xAI documenta `store: true` como padrão e oferece esse identificador para continuar a conversa. Não foi introduzido replay stateless parcial.
- **Terminal:** somente `response.completed` com `status: completed` produz `[DONE]`. `response.failed`, `response.incomplete`, evento `error` e fim do iterador sem terminal viram erro do stream.
- **Cancelamento:** o `ReadableStream.cancel()` e o signal externo abortam um controller interno compartilhado com todas as chamadas xAI/OpenAI da rodada. Abort durante a imagem é relançado; não vira function output nem inicia nova rodada. O signal externo fecha o leitor com proteção para o caso de o consumidor já tê-lo cancelado.
- **Uso:** somente o evento terminal final é emitido como `response.completed`; seu usage soma todas as rodadas e normaliza tanto `input/output_tokens` quanto aliases antigos `prompt/completion_tokens`. A imagem separada não é somada à métrica Grok.
- **Imagem Pulse:** o modelo da chamada OpenAI é fixado em `gpt-5.6-luna`; o perfil Grok fornece apenas o reasoning efetivo `medium`.

## Validação focada

Comando final decisivo, código de saída `0`:

```text
npm test -- lib/server/xaiChat.test.ts app/api/chat/route.test.ts lib/server/chatRequest.test.ts lib/models/modelConfig.test.ts lib/chat/deepsearchConfig.test.ts lib/chat/responseToMessagePatch.test.ts lib/chat/streamMachine.test.ts lib/pulse/runner.test.ts lib/pulse/runnerStart.test.ts lib/pulse/store.test.ts lib/pulse/storeRuns.test.ts lib/pulse/extractTask.test.ts lib/calendar/naturalLanguageDraft.test.ts lib/server/studioAssistant.test.ts lib/studio/workspace.test.ts stores/settingsStore.test.ts stores/settingsStorePersistence.test.ts

17 arquivos; 114 testes aprovados; 0 falhas; 0 skips.
```

`git diff --check`: código de saída `0`, sem erro.

Gates integrados coordenados pelo orquestrador depois da estabilização:

- `npm test`: código de saída `0`; 183 arquivos e 928 testes aprovados; 0 falhas.
- `npx tsc --noEmit`, primeira passagem: código de saída `2`; quatro diagnósticos nesta frente, todos de tipos em fixtures/normalização (`ResponseStreamEvent`, narrowing de tools, enum sintético de erro e `usage` ausente).
- após a correção exclusivamente tipada, `npm test -- lib/server/xaiChat.test.ts app/api/chat/route.test.ts`: código de saída `0`; 2 arquivos e 20 testes aprovados.
- `npx tsc --noEmit`, passagem final: código de saída `0`, sem diagnósticos.

Falhas intermediárias registradas:

- bateria de 5 arquivos: código `1`, 30 aprovados e 2 falhos; as duas expectativas novas usavam `model` em vez do campo persistido canônico `modelUsed`. A produção já gravava o campo correto; expectativas corrigidas.
- repetição da bateria de 5 arquivos: código `1`, 31 aprovados e 1 falho; restava a mesma troca aplicada no objeto de request em vez do run. Corrigida e `lib/pulse/runnerStart.test.ts` passou com 4/4, código `0`.
- bateria de preferências/Studio: código `1`, 38 aprovados e 1 falho; a expectativa exigia igualdade literal do histórico, mas o parser canônico acrescenta `isSearching: false`. Ajustada para comprovar os campos persistidos sem negar a normalização existente; repetição passou com 39/39, código `0`.

Lint, build e Playwright integrado seguem coordenados com o orquestrador, conforme a divisão da entrega. A suíte completa e o TypeScript já estão aprovados acima; nenhuma repetição da suíte completa foi feita depois da correção apenas tipada.

## Revisão independente dos trechos do orquestrador

Revisão somente leitura de `components/soundcase/SoundCaseGrokRealtimeSettings.tsx`, das classes `realtime*` em `components/soundcase/SoundCase.module.css`, `scripts/qa-grok-soundcase.mjs` e `scripts/qa-grok-catalog.mjs`: sem impedimento encontrado.

Os selects têm labels visíveis, nomes acessíveis explícitos, largura contida e altura mínima de 44 px; o slider também fixa 44 px. O QA SoundCase usa APIs/WebSocket e dados sintéticos, mede os dois selects em desktop/mobile e cobre configuração sem geração, voz, velocidade, snapshot, início/parada, erro de token, persistência, retorno à OpenAI, overflow e `pageerror`. O QA de catálogo cobre Luna padrão, mini ausente, Grok selecionável, medium único/desabilitado, persistência após reload, overflow e `pageerror`. O slider não recebe `boundingBox()` próprio no script, mas sua classe fixa `min-height: 44px`; junto aos 20 cenários SoundCase já aprovados pelo orquestrador, isso não configura bloqueio.

## Pendências de integração

Os gates completos, a repetição dos QAs na build final e o parecer consolidado pertencem ao orquestrador. As duas chamadas reais xAI anteriores retornaram HTTP 200 e comprovaram disponibilidade, mas o modelo recusou a asserção textual artificial `PRONTO`; não houve nova chamada paga nesta revisão.
