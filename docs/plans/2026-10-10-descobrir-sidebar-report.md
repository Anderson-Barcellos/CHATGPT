# Descobrir IA na lateral esquerda — registro técnico

Data: 2026-10-10. Estado: fechada por Anders, publicada com restart autorizado.

## Resultado e escopo

Descobrir abre pelo rail e pela paleta dentro do chat como painel sobreposto à esquerda, sem dividir espaço nem reduzir a largura do chat. Tem header fixo, rolagem própria, uma coluna de notícias, preferências recolhíveis e ampliação para toda a área do aplicativo. Abaixo de 1024px ou em paisagem curta com toque, abre como diálogo de tela cheia. Ampliar/reduzir preserva a mesma árvore do feed/player e usa uma âncora de texto para manter a leitura; fechar desmonta o feed e para o áudio. Conversa, composer e Pulse permanecem montados. `/chat/discover` continua independente; Ctrl/Cmd+clique conserva o href.

Worktree: `/root/.cache/gaucho-discover-sidebar-20261010`; branch `codex/discover-sidebar-20261010`; base `9a177d97292abdef107b2ce482bd2f213063e29e`. Plano aprovado e registrado em `9d1e9a2`. Checkout produtivo não editado. Nenhuma API, persistência, curadoria, preferência privada, provider, Studio ou SoundCase foi alterado.

Arquivos de implementação: `components/discover/DiscoverPage.tsx`; `components/workspace-v2/DiscoverPanelV2.tsx`, `WorkspaceLayoutV2.tsx`, `ConversationRailV2.tsx`; `components/command/CommandPalette.tsx`; `stores/uiStore.ts`; `app/globals.css`. Testes nas respectivas áreas e novo driver `scripts/qa-discover-sidebar.mjs`. Contrato documentado em `AGENTS.md` e `docs/ARCHITECTURE.md`.

## Decisões e revisão

- DECISÃO: um implementador foi responsável apenas pelo feed/testes; o principal integrou shell/estado/navegação/QA. Responsabilidades exclusivas, sem edição concorrente dos mesmos arquivos. Relatório do feed: `2026-10-10-descobrir-sidebar-feed-report.md`.
- DECISÃO: ampliar altera CSS da mesma árvore; não usa uma segunda cópia num portal. Isso preserva estado, player e consultas. O diálogo inline usa irmãos inertes, contenção de foco, Escape e bloqueio de propagação dos atalhos do workspace.
- DECISÃO: guardar uma âncora de texto antes de ampliar/reduzir conserva o ponto de leitura apesar da mudança de largura e quebra de linhas.
- DECISÃO: fechamento retorna ao acionador se ainda existir; paleta/drawer desmontados usam controle de navegação visível, evitando o primeiro botão oculto de conversas no desktop.
- DECISÃO: a confirmação posterior de Anders (registrada no §1.1 do plano) substituiu a divisão de espaço por sobreposição. Painel absoluto de 360px, limitado a 32% da área disponível; rails continuam ocupando sua geometria, invisíveis durante a leitura. O QA mede a largura física ao reduzir, confirma que a largura do chat não mudou e inclui Pulse aberto. Na versão intermediária flex, o QA revelou redução incompleta (1266px em viewport de 1280px); diagnóstico histórico em `layout-failure.json` e `sizing-failure.json`. A solução final sobreposta substitui essa versão.
- DECISÃO: o rail compacto não chama `onClose` ao abrir Descobrir, pois nesse contexto o callback abre o drawer. A transição de abertura também fecha o drawer no shell, inclusive pela paleta. O QA descobriu e passou a impedir o reaparecimento indevido de Conversas no tablet.
- DECISÃO: carregamento dinâmico do feed evita consultar notícias antes de abrir. A extração preservou comportamento da página independente, inclusive promoção de cards no desktop.
- DECISÃO: os cenários de UI foram acrescentados num driver dedicado porque não há suíte/configuração Playwright única no projeto. O QA existente de Descobrir também foi executado; scripts de outros produtos e smokes com providers reais não são aplicáveis a esta mudança visual.
- O principal revisou diff e decisões do feed e rodou gates independentes. O implementador revisou shell/store/CSS/testes/QA em somente leitura, incluindo retorno de foco, sobreposição final e correção do drawer compacto, sem impedimentos concretos.

## Gates e evidências

Evidências externas em `/root/.cache/gaucho-discover-sidebar-evidence`. Build e runtime usam configuração sintética explícita; nenhum `.env` de produção foi lido ou copiado. Dependências já instaladas foram reutilizadas por hardlinks; nenhum pacote foi instalado ou alterado.

| Comando | Resultado |
|---|---|
| `npm exec vitest -- run components/discover/DiscoverPage.test.tsx` (implementador) | exit 0, 1 arquivo/12 testes, 0 falhas/skips |
| `npx vitest run components/workspace-v2/DiscoverPanelV2.test.tsx components/workspace-v2/ConversationRailV2.navigation.test.tsx components/command/CommandPalette.test.tsx stores/uiStore.test.ts` | exit 0, 4 arquivos/10 testes; `shell-tests.log` |
| `NEXT_PUBLIC_BASE_PATH=/chat npx next typegen` | exit 0; `typegen.log` |
| `npm test` | final exit 0, 212 arquivos/1.084 testes, 0 falhas/skips; `tests-final.log` |
| `npx tsc --noEmit` | final exit 0; `types-final.log` |
| `npm run lint` | final exit 0, 0 erros, 1 warning preexistente; `lint-final.log` |
| `npm run build` com `/chat`, auth sintética e runtime isolado | final exit 0, 43/43 páginas; build `6fdxaKpSv_W__7S18fxZa`; `build-final.log` |
| `node scripts/qa-discover-sidebar.mjs` | final exit 0, 6/6 cenários sobre a build final; `sidebar-qa.log` e `sidebar-results.json` |
| `DISCOVER_QA_PORT=3148 DISCOVER_QA_OUTPUT=/root/.cache/gaucho-discover-sidebar-evidence/standalone node scripts/qa-discover-controls.mjs` | exit 0, 7/7 verificações; `standalone-qa.log` e `standalone/results.json` |
| `git diff --check` | exit 0 na revisão integrada e no registro final |

Avisos existentes: lint `_content` não usado em `CommandComposerContainerV2.test.tsx:51`; build avisa `process.exit` de `instrumentation.ts` em tracing Edge e NFT amplo via `studioWorkspaceFs.ts`/`next.config.ts`. Nenhum desses arquivos de runtime foi alterado.

O primeiro QA de navegador terminou exit 1 antes de abrir a UI: Playwright procurou headless Chromium revisão 1217 ausente. O driver passou a usar `/usr/bin/google-chrome`, já utilizado pelo QA existente; não instalou dependências. Rodadas posteriores passaram nos seis cenários iniciais, mas esses checks verificavam o atributo de redução e preservação de estado sem medir a largura física. O cenário reforçado com Pulse aberto revelou a regressão de geometria acima (exit 1), reproduzida num diagnóstico focado; ela não foi dispensada. Repetições subsequentes foram motivadas por preferências adicionadas ao QA, retorno de foco e correção dessa geometria.

Na rodada sobreposta, a primeira comparação de largura falhou (exit 1) porque capturava a referência durante a transição de abertura do Pulse. O driver passou a aguardar `getAnimations().finished` do painel antes da medição; o contrato continua sendo igualdade exata da largura do chat. Essa correção só afeta o driver, sem mudança no código compilado.

## Browser

Browser plugin not available: validação via Playwright + Chrome instalado, sem trocar de caminho após falha de plugin. URL temporária `http://127.0.0.1:3148/chat`; porta aprovada por `/etc/apache2/check-port.sh 3148`, bind loopback, serviço produtivo observado ativo. Instância encerrada pelo próprio driver, com limpeza dos diretórios sintéticos que ele criou; nenhuma alteração no Apache ou serviços persistentes.

Viewports: 1440×1000 escuro, 1280×900 claro, 820×1180 touch claro, 390×844 touch escuro, 320×740 touch claro, 1100×440 touch escuro. Casos: identidade/URL/título, UI não vazia, sem overlay de framework, rail e paleta, preferências/assuntos e pausa+busca manual no painel, expansão de notícia longa, rolagem até últimos cards, áudio mock somente após tocar, nenhuma nova geração ao ampliar/reduzir, instância de feed/composer preservada, foco/Tab/Escape, ausência de overflow do documento e feed, zero pageerror/console error/chamadas externas. A página independente passou também pelos testes de pausa persistida, bloqueio do runner pausado, TTS, expansão e navegação Studio mock.

Capturas finais inspecionadas: `feed-top-1440-dark.png`, `sidebar-reduced-with-pulse-1280.png`, `preferences-320-light.png`; capturas anteriores também cobriram leitura ampliada desktop/mobile. As imagens finais confirmam sobreposição, largura reduzida correta, leitura contínua e controles mobile sem overflow. As imagens mostram fixtures sintéticas; textos privados e capas reais não foram acessados. Não houve teste físico de Safari/iPhone ou síntese paga de voz; preservados os mecanismos existentes de viewport e APIs.

## Fechamento

Anders autorizou explicitamente deploy e restart após validação. Código registrado em `a1e078c`; publicação executada com `npm run deploy -- --from /root/.cache/gaucho-discover-sidebar-20261010`, exit 0. Build instalada `6fdxaKpSv_W__7S18fxZa`; backup da anterior em `/root/.cache/gaucho-deploy/20261010T183015Z/next-before`. Preservar origem e backup. Merge e push não autorizados; código permanece na branch da entrega, sem alteração dos fontes da main produtiva.

Agendadores Discover/Pulse/SoundCase e path SoundCase foram pausados durante a troca; workers estavam inativos e não havia unidade Studio ativa. Todos os quatro acionadores retomaram seu estado ativo. `chatgpt.service` reiniciado via systemd: MainPID `1408412`, processo Next `1408428`, active/running. Health local `http://127.0.0.1:3040/chat/api/health` e público `https://ultrassom.ai/chat/api/health`: HTTP 200 e `healthy`, basePath `/chat`. API Discover anônima: 401. Nenhuma alteração de proxy, cookies ou portas; Apache não precisou de reload/configtest.

Assets públicos comparados por SHA-256 com a build validada: `0rmxsdwhg2p_o.js` e `2mq_d5osd0u6j.css`, ambos idênticos. Evidências `deploy.log`, `deploy-exit.json`, `deploy-schedulers.json`, `deploy-schedulers-restored.json` e `publication-checks.json`. Publicação registrada também em `/etc/apache2/APACHE.md` e `docs/INFRASTRUCTURE.md`. Fluxo autenticado foi validado em runtime isolado com fixtures; inspeção da sessão real fica com Anders, sem leitura de suas credenciais ou notícias privadas. Entrega aguarda revisão/fechamento de Anders.

### Aceite e sincronização Git

Em seguida, Anders confirmou “Show de bola! Fechadinho meu velho!” e autorizou commit e push para manter a main em dia. Essa autorização supera os limites de integração/push registrados na etapa de publicação acima. `git fetch origin` terminou com exit 0; `git rev-list --left-right --count origin/main...main` retornou `0 0`, ambas em `9a177d9`. Worktrees limpas. Somente os três commits da entrega (`9d1e9a2`, `a1e078c`, `7d1e5e9`) e o registro de fechamento entram na sincronização, por fast-forward e push normal, sem force-push. Verificação documental: `git diff --check`, exit 0. Nenhum código mudou após a validação publicada; não se repetem build, testes de aplicação ou restart para este fechamento documental. Evidência final de integração/push em `/root/.cache/gaucho-discover-sidebar-evidence/git-closeout.log`.
