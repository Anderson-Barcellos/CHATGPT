# Registro técnico — GPT-6 e uso de 16/09

**Estado:** implementação validada em worktree isolada; pronta para revisão. Produção, proxy e dados privados não foram alterados. Branch `codex/gpt6-usage-audit-20260924`, base `2e0e37b`, plano `docs/plans/2026-09-24-gpt6-e-auditoria-de-uso.md`.

## Resultado e decisões

- Chat, Studio, Pulse, DeepSeek web context, SoundCase e imagem auxiliar do Grok usam `gpt-6-sol`/`gpt-6-luna` nas novas chamadas. Astra, Sol e Luna aparecem nas escolhas; Terra saiu. Luna continua default. Perfis e rotinas com IDs GPT-5.6 são aceitos e encaminhados para GPT-6; o conteúdo histórico não é reescrito.
- `DECISÃO:` Terra legado resolve para Sol, por ser a opção intermediária atual. Preferências por modelo antigas são hidratadas no novo ID, inclusive quando o modelo antigo não era o selecionado no último uso; Sol antigo tem precedência sobre Terra antigo se ambos tiverem ajustes.
- `DECISÃO:` o botão `pro` é omitido em GPT-6 Sol/Luna, conforme documentação da OpenAI que o associa à família GPT-5.6. `max` continua disponível; Astra mantém reasoning/verbosity `medium` no chat e no Pulse.
- `DECISÃO:` preços de Sol/Luna e limite de contexto do Luna foram atualizados conforme catálogo oficial; tarifa longa começa acima de 272 mil tokens de entrada. O estimador local não contabiliza cache writes, ferramentas ou tier de processamento e não é fonte de fatura.

## Levantamento de 16/09/2026

Fonte local: linhas válidas do log Apache HTTPS `ultrassom_ssl_access.log*`, horário `-0300`, agrupadas por rota/método/status sem expor IP, URL com identificador, query ou conteúdo. O dia **local** 16/09 e o dia **UTC** 16/09 deram os mesmos números nos pontos de criação abaixo:

| Ponto | Eventos observados | O que significa |
| --- | ---: | --- |
| `POST /chat/api/chat` | 1 (200) | Um pedido ao chat; a rota pode gerar várias chamadas upstream quando há tools. O log não registra modelo ou tokens. |
| `POST /chat/api/chat/background` | 0 | Nenhum novo job de chat em background por essa rota. |
| `POST /chat/api/studio/assist` | 2 (200) | Dois pedidos ao assistente do Studio; modelo e tokens não aparecem no acesso HTTP. |
| `POST /chat/api/soundcase/projects/{id}/versions` | 1 (201) | Uma versão criada; não mede chunks de TTS executados por worker interno. |
| `POST /chat/api/realtime/tts-call` | 2 (201) | Duas sessões solicitadas; a duração/uso upstream não consta no acesso HTTP. |
| `POST /chat/api/soundcase/realtime-call` | 1 (201) | Uma sessão solicitada; idem. |
| `POST /chat/api/chat/background/reconcile` | 32 locais / 30 UTC (200) | Consultas de estado do job, não criação de 32 respostas novas. |

`pulse.log` registrou 1.309 ticks no dia local, com `dueCount=0`, `startedCount=0` e zero runs. O arquivo atual `data/conversations.json` tem zero mensagens datadas de 16/09 em São Paulo; somente os campos de data, papel, status e uso foram agregados, sem emitir conteúdo. Esse snapshot não prova ausência de conversa removida, falha de persistência ou consumo upstream. `app.log`/`error.log` não fornecem registros completos por chamada com chave, modelo, tokens e custo.

Inventário de possíveis custos OpenAI no app: Responses do chat e loops de tools; background; assistente do Studio; Pulse (texto e imagem); SoundCase (direção, capa, chunks TTS e realtime); transcrição e TTS legados; memory index/suggestions; web context auxiliar do DeepSeek; geração de imagem solicitada pelo Grok; chave restrita do runner/terminal/notebook Studio. O SDK OpenAI também fala com xAI/DeepSeek em adaptadores específicos; essas chamadas não são custo OpenAI, exceto quando usam explicitamente o cliente OpenAI para imagem ou contexto.

Anders identificou o Playground da OpenAI como origem provável do gasto. A [documentação da OpenAI](https://help.openai.com/en/articles/10478918-reviewing-api-usage-and-costs) confirma que o Playground consome e cobra como chamadas de API. Os logs locais sustentam que não houve volume elevado de pedidos ao **chat deste app** no dia, mas não atribuem o valor da fatura nem a chave não ativa. Para fechar a atribuição por chave/projeto/modelo e valor, falta o export Usage/Costs da organização; uma chave ausente da lista ativa pode requerer conferência de histórico/audit logs, sem presumir sua origem.

## Validação

| Gate | Resultado |
| --- | --- |
| Testes focados (catálogo, requests, persistência, Studio, Pulse, SoundCase e DeepSeek) | 13 arquivos / 115 testes, exit 0; depois da correção de perfil, 3 arquivos / 26 testes, exit 0. |
| `npm test` após última mudança de código | 194 arquivos / 996 testes, zero falhas, exit 0. Uma rodada anterior falhou em 1 asserção de UI que esperava o botão `pro` antigo; teste alinhado ao novo contrato e suíte repetida. |
| `npx tsc --noEmit` | Exit 0 após geração de `next-env.d.ts` pelo build isolado. A tentativa inicial antes do build parou por falta desse arquivo gerado. |
| `npm run lint` | Exit 0, zero erros, um warning anterior (`_content` não usado em `CommandComposerContainerV2.test.tsx`). |
| `NEXT_PUBLIC_BASE_PATH=/chat npm run build` | Exit 0, 42/42 páginas; warnings de `instrumentation.ts` no Edge e NFT tracing preexistentes. Repetido após a última mudança de código. |
| Chrome/Playwright no Next isolado (`GAUCHO_ISOLATED_RUNTIME=true`, dados e credenciais sintéticos) | Desktop 1440 px e mobile 390 px: três modelos selecionáveis, Terra ausente, `pro` ausente, zero `pageerror`; exit 0. Sem chamada paga. Não há suíte Playwright versionada para executar integralmente. |
| `git diff --check` | Exit 0. |

Primeira tentativa de build exit 1 por symlink `node_modules` fora da raiz do Turbopack; dependências copiadas para a worktree e build repetido com exit 0. Nenhum build rodou no checkout de produção. O primeiro smoke do Next isolado encontrou corrida de criação do `conversations.json` sintético; o smoke foi repetido com sucesso. O servidor QA foi encerrado.

**Limite da conclusão financeira:** sem CSV Usage/Costs não há total em dólares nem confirmação independente do ID da chave. Nenhuma chave foi lida, impressa, criada ou rotacionada.
