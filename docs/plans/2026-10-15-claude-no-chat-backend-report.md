# Relatório backend — Claude no chat

## Resultado

O backend do chat agora reconhece os modelos Claude no catálogo compartilhado e os encaminha exclusivamente no streaming do chat padrão. O adaptador `lib/server/anthropicChat.ts` usa a Messages API oficial, converte as mensagens existentes (texto, imagens HTTPS e data URLs compatíveis), preserva `instructions` como `system` e traduz os eventos para `AssistantStreamEvent`.

Busca e fetch usam somente as tools Anthropic `web_search_20260318` e `web_fetch_20260318`, ambas com `allowed_callers: ["direct"]`; não há tool de execução de código. As tools de memória existentes são reaproveitadas por `executeMemoryToolCall`, com no máximo duas continuações. Em cada continuação, todos os blocos do assistente retornados por Claude — inclusive thinking assinado, redacted thinking, tool use, resultados de tools de servidor e citações acumuladas no bloco textual — são enviados de volta sem reescrita. Um mapa persistente de `document_index → URL` dos resultados de `web_fetch` permite expor citações de fetch que chegam como `char_location`, sem inventar URL quando o índice não existe. Thinking histórico vindo do chat nunca é sintetizado nem reutilizado.

O status visual de busca começa em `server_tool_use`, mas só encerra no bloco correlato de resultado `web_search_tool_result` ou `web_fetch_tool_result`; a correlação sobrevive a `pause_turn`, e o encerramento natural da resposta fecha qualquer tool ainda pendente. Portanto, o indicador cobre a busca/fetch efetiva, e não apenas a transmissão dos argumentos.

Erros de entrada incompatível são rejeitados sem descarte silencioso. `max_tokens`, `refusal`, contexto excedido, tool desconhecida e limite de continuações provocam falha do stream, sem `[DONE]` ou `response.completed` falso. O abort do upstream e o cancelamento do leitor encerram a requisição; o timeout do SDK é de 180 segundos. Erros da SDK e inesperados são substituídos por mensagens locais antes de chegar ao `ReadableStream`, sem carregar payload, contexto ou credenciais upstream.

Uso final é agregado entre as rodadas e emitido uma vez: `input_tokens` soma input e cache lido, `cached_tokens` mantém o cache lido separado, e `reasoning_tokens` traz thinking. Assim, o cálculo de custo já consumido pelo cliente recebe o total correto sem duplicar conclusões intermediárias.

## Arquivos da frente

- `lib/server/anthropicChat.ts` e `lib/server/anthropicChat.test.ts`: adaptador, conversão, stream, tools, abort, timeout e testes mockados.
- `app/api/chat/route.ts` e `app/api/chat/route.test.ts`: ramo Claude com 400 para modo/nonstream incompatíveis e 503 sem chave, sem alterar a resolução global de modelos.
- `lib/server/chatRequest.ts`: exportação aditiva de `buildMemoryTools`, preservando o request OpenAI.

Não houve remoções, substituições de import existentes nem alteração do resolver compartilhado de Astra; Pulse e Studio permanecem fora desta frente.

## DECISÃO

`xhigh` e `max` são limitados a `high` no adaptador, enquanto ausência/valor não suportado fica em `medium`. Motivo: o contrato do chat expõe somente `low`/`medium`/`high`, e o teto de servidor evita que preferências persistidas ampliem custo ou esforço fora da interface. A escolha foi coberta por teste unitário.

## Evidências

- `npm test -- lib/server/anthropicChat.test.ts app/api/chat/route.test.ts` — código 0; 2 arquivos, 26 testes aprovados.
- `git diff --check` — código 0.
- `npx eslint lib/server/anthropicChat.ts lib/server/anthropicChat.test.ts app/api/chat/route.ts app/api/chat/route.test.ts lib/server/chatRequest.ts` — código 0.
- `npx tsc --noEmit --pretty false` — código 0 após a integração da frente catálogo.

O smoke externo não é evidência desta frente: o principal confirmou a disponibilidade dos dois IDs na Models API e fará o smoke real de texto, imagem, web e memória com fixtures isoladas, sem esta unidade ler chave ou chamar a API.
