# Síntese da memória pessoal — pronta para revisão

## Entendimento e objetivo
Reduzir o contexto pessoal enviado pelo Gaúcho Chat, preservando fatos originais e recuperando detalhes sob demanda. Baseline: 21.231 caracteres antes de histórico/RAG. Fora: instruções dos CLIs, compactação de conversas, SQLite, contexto próprio de Pulse/Studio/SoundCase. Preservar WIP e dados.

## §1.1 Decisões e aprovação
Anders escolheu perfil e memórias; Luna low; resumo + busca. Aprovou a execução com “Implement the proposed plan.” após o plano nesta conversa. Sem autorização de commit/merge/push. Plano: instruções enxutas; biografia importada editável com backup/idempotência; síntese persistida até 4.000 caracteres com fontes/hash/versão/data/uso; originais atuais como fallback; recuperação pessoal separada do histórico; invalidar alterações/desativações/exclusões; UI com estado/tamanhos/regeneração; validação e publicação.

## Agrupamentos
1. Fontes/instruções: separar biografia e regras; preservar originais, literalidade das preferências e regras customizadas. Aceite: migração não duplica nem sobrescreve. Arquivos: prompts, persona e tipos. Registro: este plano e docs/ARCHITECTURE.md.
2. Serviço de síntese e índice pessoal: Responses gpt-6-luna/low/store:false sem tools, saída estruturada, referências; hash das fontes, concorrência, timeout, retries limitados e persistência de pendências. Alterações durante geração invalidam saída. Busca filtra fontes atuais. Aceite: detalhe omitido recuperável, desativado não reinjetado. Registro: docs/API.md e docs/MODELS.md.
3. Integração: useChat, modos background, ferramentas e Settings; consulta autenticada por envio, rascunho local como fallback, recuperação antes de envio em todos os modelos. Aceite: UI permite editar/pausar/regenerar e ver estados; nenhuma geração por mensagem com cache válido.
4. Validação/publicação: testes focados, npm test, typegen/tsc, lint, build isolado; Chrome desktop/mobile e suíte ativa; smoke Luna real sintético. Somente chatgpt.service, health local/público e fluxo real. Rollback preservado. Registro: BACKLOG e diário.

## Execução
Worktree: /root/worktrees/gaucho-personal-synthesis, HEAD 2824f9d mais WIP existente copiado. Baseline de hashes: /root/.cache/gaucho-personal-synthesis/baseline.json. Evidências fora do repo: /root/.cache/gaucho-personal-synthesis/evidence. Um gate pesado por vez. Nenhuma delegação: instrução vigente proíbe spawn sem convite explícito.

## Paradas
Perda semântica, gate falho ou conflito pessoal material bloqueiam publicação. Não resolver fatos por adivinhação. Entrega termina pronta para revisão; Anders decide fechamento.

## Marco de implementação e validação
Fontes, migração, síntese, índice, APIs, ferramentas, composer e Settings implementados. Backup da persona com 0600. Regeneração manual durante geração em andamento fica enfileirada. Hash vigente é a invalidação durável; próxima consulta retoma após interrupção. Três rodadas máximas por tarefa posterior à resposta, duas tentativas automáticas por revisão com intervalo mínimo de um minuto após falha. Tabela pessoal usa cosseno <= 0,55 e recuperação lexical auxiliar; máximo três trechos de 1.200 caracteres, sempre conferidos contra fontes atuais.

Suite final: 233 arquivos / 1.289 testes, exit 0. Smoke real Luna sintético: 5.509 -> 604 caracteres, 1.259 tokens de entrada e 283 saída, exit 0. Primeira validação Chrome 1440/390 passou edição, pausa, fallback, erro e regeneração. QA do composer confirmou envio com contexto atual, e a repetição de falha encontrou a corrida do pedido manual, corrigida com teste de regressão. Build final e QA de regressão em andamento. Publicação pendente.

Marco final: proteção da consulta auxiliar para documentos longos (6.000 caracteres de busca, input completo preservado), 26 testes focados finais, **1.290 testes em 233 arquivos** na suíte da release; tsc/lint/build exit 0. Seis suítes Chrome completas aprovadas. Build `CD4rlXjmJA8tQhzLgAIf_` publicada em 13/11 às 23h09 BRT, backup `/root/.cache/gaucho-deploy/20261114T020936Z/next-before`. Saúde local/pública e UI pública conferidas. Síntese pessoal real 17.643 -> 2.327 caracteres; fontes anteriores preservadas por hashes. Nada depende de credencial nova ou de migração SQLite. Fechamento depende de Anders; não houve commit/merge/push. Substitui o estado pendente do marco acima.
