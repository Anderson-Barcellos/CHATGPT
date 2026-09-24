# GPT-6 no app e apuração do gasto de 16/09

## 1. Entrevista e aprovação

Anders pediu atualizar Sol e Luna para GPT-6, retirar Terra das novas escolhas e investigar o gasto OpenAI de um dia 16, inclusive uma chave que não aparece na lista ativa. As respostas confirmaram: alcance em todo o app; dia 16/09/2026; CSV de uso e custos da OpenAI como fonte financeira. Plano aprovado em 2026-09-24 (“Aprovado meu guri!”). Não há pergunta de produto aberta; o CSV ainda precisa ser disponibilizado.

Exemplos observáveis: ao escolher Astra, Sol ou Luna, Anders vê os três no seletor e a chamada usa o ID correspondente; uma preferência ou rotina salva com ID antigo continua abrindo e a próxima execução usa um modelo atual; ao examinar 16/09, Anders vê chamadas, modelos, chaves/projetos e custos conciliados ou lacunas explícitas.

## 2. Objetivo e limites

Atualizar os modelos OpenAI ativos do app e produzir uma apuração verificável da cobrança de 16/09/2026.

**Fica fora:** reescrita dos dados runtime privados, rotação ou criação de chaves, publicação, restart, merge e push. Este checkout principal é produção: toda edição e todo build ocorrem em worktree isolada.

| Decisão | Contrato |
| --- | --- |
| GPT-6 | `gpt-6-astra`, `gpt-6-sol` e `gpt-6-luna` são as novas escolhas OpenAI; Luna continua default. |
| Terra | Sai das novas escolhas, com compatibilidade de leitura para IDs antigos. |
| Reasoning | Não oferecer `pro` para GPT-6 Sol/Luna, pois a documentação o associa a GPT-5.6; preservar efforts suportados. |
| Cobrança | CSV da OpenAI é fonte financeira; comparar UTC da plataforma com America/Sao_Paulo. |

## 3. Grupamentos

### Catálogo GPT-6 e compatibilidade

- **Objetivo:** catálogo, preços locais, defaults e fallback dos IDs legados corretos.
- **Escopo por arquivo:** `lib/models/modelConfig.ts`, `lib/server/chatRequest.ts`, `stores/settingsStore.ts`, testes respectivos e `docs/MODELS.md`.
- **Contratos:** IDs antigos Sol/Luna/Terra resolvem para Sol/Luna GPT-6 em novas chamadas; valores persistidos não são regravados; apenas Astra conserva travas fixas de reasoning/verbosity.
- **Dependências:** nenhuma.
- **Testes:** testes focados de catálogo, defaults, fallback e reasoning; na integração, requests e seletores.
- **Evidência de pronto:** IDs e parâmetros novos passam nos testes e aparecem no fluxo visível.
- **Preservar:** outros providers, histórico e dados runtime.

### Integrações de modelos no app

- **Objetivo:** atualizar Studio, Pulse, DeepSeek, SoundCase e consumidores que ainda nomeiam Sol/Luna/Terra ativos.
- **Escopo por arquivo:** `lib/studio/*`, `lib/pulse/*`, `components/workspace-v2/PulsePanelV2.tsx`, `lib/server/deepseekChat.ts`, `lib/server/soundcase/*`, `lib/server/xaiChat.ts`, `lib/soundcase/types.ts`, documentação de API/arquitetura e testes tocados.
- **Contratos:** IDs antigos continuam aceitos ao restaurar preferências, rotinas e snapshots; nenhuma escrita em `data/*.json` real; overrides de ambiente preservados e IDs legados normalizados antes da chamada OpenAI.
- **Dependências:** catálogo e fallbacks.
- **Testes:** casos focados de Studio/Pulse/helpers e fluxo integrado; smoke visual de seletores com dados sintéticos.
- **Evidência de pronto:** cada fluxo usa ID atual quando invocado e restaura estado legado sem falhar.
- **Preservar:** contratos de outros providers, outputs e conteúdos históricos.

### Auditoria de chamadas e cobrança

- **Objetivo:** responder se o app explica o gasto de 16/09 e o que se sabe da chave não ativa.
- **Escopo por arquivo:** leitura de pontos de chamada do repositório e evidências agregadas disponíveis; relatório `docs/plans/2026-09-24-gpt6-e-auditoria-de-uso-report.md`; estado no `BACKLOG.md` e entrada ao fim de `docs/DIARIO-AGENTS.md`.
- **Contratos:** contagem e custo por chave/projeto/modelo/recurso quando o CSV permitir; comparação da janela UTC com São Paulo; distinguir observado, inferido e não atribuível. CSVs e dados pessoais não entram em Git.
- **Dependências:** CSV de uso e custos disponibilizado por Anders para concluir atribuição financeira; inventário de código é independente.
- **Testes:** validar totais e agrupamentos do CSV contra o total exportado; conferir regras de fuso e ausência de duplicidade; `git diff --check` para documentação.
- **Evidência de pronto:** relatório com totais, evidência e limites da conclusão.
- **Preservar:** segredos, dados runtime e registros privados; nenhuma chamada paga de teste.

## 4. Gates e parada

Com conjunto estabilizado: testes focados, `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` na worktree isolada e Playwright visual aplicável. Executar gates pesados sequencialmente, registrar comando, exit, totais, falhas e skips no relatório. Se o CSV não chegar, entregar o código e o inventário como unidades verificadas, deixando a atribuição financeira bloqueada e explícita. Problemas de contrato, alteração de resultado ou risco material param somente a parte dependente.

Referências oficiais: [modelos GPT-6](https://developers.openai.com/api/docs/models), [reasoning](https://developers.openai.com/api/docs/guides/reasoning), [preços](https://developers.openai.com/api/docs/pricing), [uso e custos](https://help.openai.com/en/articles/10478918-reviewing-api-usage-and-costs).
