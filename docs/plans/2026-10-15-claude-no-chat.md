# Claude no chat — pronta para revisão

## Entrevista e aprovação

Anders confirmou: somente chat; Sonnet 5.5 e Opus 5.5 com medium inicial e opções low/medium/high; busca web, imagens e memória; Documento cai para Luna medium, Deepsearch/Quiz preservados. Credencial indicada: ANTHROPIC_API_KEY em /root/STT/.env. Em 2026-10-15 aprovou: “Implement the proposed plan.”

Objetivo: substituir Gemini/Astra nas novas escolhas do chat por Claude integrado ao fluxo existente. Fora: Studio/Pulse, alteração STT, geração de imagem/code execution Anthropic, deploy/restart/push.

## Catálogo e experiência

### Atualização confirmada na execução

Anders informou que colocou a chave correta no shell do servidor antigo como `CLAUDE_KEY` (corrigiu explicitamente para maiúsculas). Essa origem substitui a chave do STT que retornou 401. Transferência protegida autorizada pelo pedido e concluída sem alterar o antigo/STT; Models API 200 nos dois IDs. O restante do plano permanece igual.

Escopo: lib/models/modelConfig.ts, types/index.ts, stores/settingsStore.ts, lib/chat/documentConfig.ts, componentes de seleção/composer e respectivos testes. Contrato: teto high também no servidor; Luna default; preferências antigas Astra/Gemini no chat resolvem Luna medium sem reescrever históricos. Preservar Astra no Studio/Pulse e demais provedores. Evidência: escolhas e persistência corretas, capacidades incompatíveis ocultas. Testes internos focados e browser desktop/mobile.

## Provedor e ferramentas

Escopo: lib/server/anthropicChat.ts e teste, app/api/chat/route.ts e teste, helpers de memória estritamente necessários. Contrato: Messages API oficial traduzida ao SSE existente; web search/fetch, memória compartilhada (2 rodadas), imagens, cancelamento, falha parcial e uso agregado; thinking assinado preservado nas continuações e nunca reutilizado de outro modelo. Dependência: catálogo. Preservar Responses API OpenAI e orquestração useChat. Evidência: stream, cancelamento, citações, anexos e tools integrados, erros explícitos.

## Credencial e operação

Escopo: fonte privada /etc/chatgpt/anthropic.env 0600, referência /root/.bashrc com backup, drop-in versionado preparado (não ativado) e docs. Extrair somente ANTHROPIC_API_KEY sem imprimir ou executar arquivo. Preservar STT e demais variáveis; parar provisionamento em conflito/ausência. Nenhum restart/deploy.

## Validação e registro

Principal coordena dependências e gates sequenciais: git diff --check; focados; npm test; NEXT_PUBLIC_BASE_PATH=/chat npx next typegen se necessário; npx tsc --noEmit; npm run lint; NEXT_PUBLIC_BASE_PATH=/chat npm run build. Browser Chrome/Playwright com GAUCHO_ISOLATED_RUNTIME=true e dados/credenciais sintéticos, nunca runtime real. Smoke externo mínimo sintético: chave/modelos/tools; falha de acesso é bloqueio explícito. Registro: TEST_LOGS.md, BACKLOG.md, docs/DIARIO-AGENTS.md e docs canônicos. Evidências completas: /root/.cache/gaucho-claude-20261015/evidence.

DECISÃO: checkout contém WIP amplo e é produção. Usar snapshot Git independente em /root/.cache/gaucho-claude-20261015/source com baseline e473f31, copiado apenas dos arquivos versionáveis (sem dados privados/env). Commits de entrega descendem desse snapshot, não devem ser mergeados diretamente no repositório original; diff contra baseline é a entrega aplicável, preservando WIP original.

## Responsabilidades

Provedor: implementador backend, somente adaptador/route/helper e testes relacionados. Catálogo: implementador UI, somente catálogo/types/store/documentConfig/componentes e testes relacionados. Principal: dependências, credenciais, integração, documentação, gates e commits. Nenhum arquivo editado por dois responsáveis simultaneamente. Relatórios: docs/plans/2026-10-15-claude-no-chat-backend-report.md e -catalogo-report.md.
