# Descobrir IA na lateral esquerda

## Entrevista e aprovação
Anders confirmou: alternar com conversas, altura toda e ampliável, ampliação em tela cheia. Em 2026-10-10 autorizou: “Implement the proposed plan.”

Objetivo: abrir notícias no lugar das conversas sem sair do chat; ampliar para toda a área do aplicativo e retornar preservando leitura, conversa e rascunho.

Fica fora: curadoria, modelos, dados persistidos, frequência, Studio, SoundCase, deploy, restart e push.

## Feed reutilizável
- Objetivo: mesma lógica e controles na página e painel.
- Escopo: components/discover/DiscoverPage.tsx, componentes extraídos e testes nessa área.
- Contrato: exportar DiscoverFeed com prop opcional `embedded?: boolean`; embedded usa flex-1/min-h-0/rolagem própria, sem header de página; cards em coluna, preferências recolhíveis; mesma instância ao ampliar/reduzir. Página pública mantém DiscoverPage.
- Dependências: nenhuma. Preservar APIs, tipografia, imagens/fontes, atualização manual, pausa, TTS sob demanda sem Realtime.
- Testes internos: página atual e painel; erros/loading/vazio; mutações; estado ao rerender. Externo: ampliar/reduzir sem recarregar ou reiniciar áudio.
- Evidência: testes e browser; relatório em 2026-10-10-descobrir-sidebar-feed-report.md.

## Integração do shell
- Objetivo: trocar conversas pelo feed e ampliar sem desmontar chat/feed.
- Escopo: components/workspace-v2/WorkspaceLayoutV2.tsx, ConversationRailV2.tsx, novo DiscoverPanelV2.tsx; stores/uiStore.ts; components/command/CommandPalette.tsx; app/globals.css e testes pertinentes.
- Contratos: estado transitório discoverPanelOpen/discoverExpanded no store; rail e paleta abrem painel; links modificados/nova aba continuam /discover. Desktop 360px limitado a 32%; abaixo de 1024px ou mobile landscape usar tela cheia. Ampliado cobre app com semântica modal, foco contido e Escape. Fecha interrompe áudio por desmontagem; ao reduzir mantém instância. Preservar conversa, streaming, rascunho e Pulse.
- Dependências: DiscoverFeed. Testes internos: store, links, integração e preservação. Externo: desktop/mobile, teclado, scroll e áudio mock.

## Validação e fechamento
- Worktree /root/.cache/gaucho-discover-sidebar-20261010, branch codex/discover-sidebar-20261010, base 9a177d9. Produção intocada.
- Gates sequenciais: npm test, npx tsc --noEmit, npm run lint, npm run build, git diff --check. Build /chat isolado; runtime GAUCHO_ISOLATED_RUNTIME=true, fixtures/credenciais sintéticas, sem providers reais.
- Browser plugin not available: usar Playwright disponível. Cenários 1280/1440 desktop, tablet, 320/390 mobile e paisagem curta touch; dark/light, leitura longa, foco/Escape, sem overflow, pageerrors; cenários existentes aplicáveis.
- Evidência em /root/.cache/gaucho-discover-sidebar-evidence; registro técnico em docs/plans/2026-10-10-descobrir-sidebar-report.md. Estado no BACKLOG.md e entrada append-only no docs/DIARIO-AGENTS.md; arquitetura atualizada se necessário.
- Parar parte dependente em mudança de escopo/risco ou gate obrigatório bloqueado. Estado final pronta para revisão, sem publicar. Plano aprovado autoriza commits locais da entrega.
