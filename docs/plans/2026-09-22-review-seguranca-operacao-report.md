# Registro técnico — segurança e operação

Estado: pronta para revisão. Base `0adcfe3`; aprovação registrada no commit `3cbeea7`. Worktree `codex/review-seguranca-operacao`. Evidências completas em `/root/.cache/gaucho-review-20260922`.

## Decisões e integração

- DECISÃO: auth/health e scripts executados por dois implementadores independentes. Principal mantém runtime/Studio, integração, docs, Git e gates; arquivos exclusivos conforme plano.
- DECISÃO: substituir `stopOrphanedStudioUnits` e seus testes de comportamento destrutivo por verificação de proprietário e lifecycle systemd. Não parar units legadas: seus limites de execução permanecem e eventual limpeza pertence ao deploy autorizado.
- DECISÃO: Studio habilitado exige proprietário comprovado (unit, InvocationID e cgroup) antes de reservar workspace; configuração Studio sem proprietário impede boot. QA desabilita workspace real e não pula locks nem autenticação.
- DECISÃO: locks kernel por recurso canônico (data, SoundCase, SQLite selecionado e Studio habilitado); helper filho detém flock através de FD herdado, liberado ao cair o processo pai. Perda do holder encerra o runtime. Nenhum suporte a cluster acrescentado.
- DECISÃO: corrigir `scripts/test-local.sh` como dependência necessária do contrato de isolamento; preservar domínio/porta/defaults fora do QA.
- DECISÃO: corrigir referência documental antiga ao Path do cookie: Next emite `/`, Apache aplica `/chat`; código do cookie preservado.
- DECISÃO: SQLite em WAL é consultado por cópia temporária de banco+WAL, removida em finally. Abrir o banco vivo readonly alterava SHM; teste com writer aberto confirmou o efeito e depois confirmou contagem e origem inalterada. É uma verificação pontual, não um backup transacional nem prova de completude de restauração.
- DECISÃO: pré-deploy mantém gates de testes/tipos/lint/build; as seções antigas informativas de auditoria npm, inventário de bundles e varredura que imprimia possíveis segredos foram retiradas com a substituição do checklist. Não havia budget/threshold bloqueante nessas seções. Auditoria de dependências externa não foi executada nesta entrega.
- Revisão independente: auth/health revisou boot/locks/Studio e repetiu 7 arquivos/80 testes com exit 0 (`runtime-independent-review.log`). Scripts revisou locks/smokes; `events.once` já rejeita spawn error, sem alteração necessária. QA cria explicitamente diretório de fixtures após provar arquivos ausentes, embora o boot já crie diretórios para seus locks.

## Evidências intermediárias

- Runtime focado: `vitest run instrumentation.test.ts lib/server/runtimeOwnership.test.ts lib/server/studioOrphanUnits.test.ts lib/server/studioWorkspaceRunner.test.ts lib/server/studioTerminal.test.ts lib/server/studioNotebookKernel.test.ts lib/server/studioWorkspaceAuth.test.ts` — exit 0, 7 arquivos/80 testes. Log `runtime-focused.log`.
- `node scripts/qa-runtime-ownership.mjs --systemd` — exit 0, 5 verificações: segundo processo recusado; queda libera lock; perda de holder encerra proprietário; identidade/cgroup reais; sessão sintética encerra junto do serviço dono. Somente units temporárias `gaucho-review-parent-*`/`gaucho-review-child-*` criadas pelo script e removidas na mesma rodada; nenhum serviço real tocado. Log `runtime-integration.log`.
- Worktree nova sem next-env gerado produziu erro de tipagem de imagem no tsc preliminar da frente auth; arquivo da imagem é rastreado. Gerar tipos Next antes do gate integrado, sem alteração de UI.

## Gates e investigação de integração

Até agora: `next typegen` exit 0; `npm test` exit 0, 189 arquivos/975 testes, 0 falhas/skips reportados (57,35 s); `npx --no-install tsc --noEmit` exit 0; `npm run lint` exit 0, zero erros/um warning anterior `_content`. Logs: `typegen.log`, `tests.log`, `tests.exit`, `tsc-final.log`, `lint.log`.

TSC integrado preliminar encontrou uma tipagem nova no harness scripts (`NODE_ENV` string genérica); corrigido para `Partial<NodeJS.ProcessEnv>`, sem mudar comportamento. Resultados finais da build/smoke constam abaixo. Relatórios específicos: `2026-09-22-review-seguranca-operacao-auth-report.md` e `2026-09-22-review-seguranca-operacao-scripts-report.md`.

Primeira build: exit 1 por `TurbopackInternalError: Symlink [project]/node_modules is invalid, it points out of the filesystem root` (`build.log`, `build.exit`). DECISÃO: trocar somente o symlink de dependências da worktree por cópia independente (`cp -a --reflink=auto`), sem instalar/alterar versões ou mudar código. Repetição após corrigir o isolamento, com log próprio.

Build seguinte: exit 0 (`build-final.log`), com warning anterior de tracing Studio. Smoke sobre essa build: exit 1 (`qa-security.log`): Next capturava a rejeição do hook, imprimia erro e mantinha o processo/porta (`qa-server-0-before-failstop.log`). Nenhum bypass de auth observado. DECISÃO: `register()` captura falha e chama `process.exit(1)` explicitamente para cumprir fail-stop de auth/locks/owner. Revisão independente do delta: 1 arquivo/6 testes, exit 0 (`instrumentation-independent-review.log`). Após a correção: suíte inteira 189 arquivos/976 testes, exit 0, 49,20 s (`tests-final.log`/`.exit`); tsc exit 0 (`tsc-validated.log`); lint exit 0, zero erros/um warning anterior (`lint-validated.log`). Nova build/smoke ficam nos logs `*-validated`.

Validação independente de ferramentas: `bash -n` dos quatro scripts e `systemd-analyze verify systemd/chatgpt.service`, exit 0 (`systemd-independent.log`).

## Resultado final e limites

- `NEXT_PUBLIC_BASE_PATH=/chat npm run build`: exit 0, 42/42 páginas geradas (`build-validated.log`/`.exit`). Dois avisos de tracing Studio anteriores e um aviso estático novo sobre `process.exit` em instrumentation/Edge. O hook retorna antes de executar qualquer inicialização em Edge/build; teste cobre isso. O encerramento é exclusivamente Node e foi comprovado na build. Aviso declarado, não ocultado nem erro de gate.
- `node scripts/qa-security-runtime.mjs`: exit 0, 9 verificações (`qa-security-validated.log`/`.exit`): produção sem auth não inicia; readiness/liveness sem dados; anônimo recusado; storage válido/corrompido sem recovery; segundo Next recusado preservando primeiro; login incorreto/correto/cookie/shell em 1440 e 390 px; encerramento permite reaquisição. Dados/credenciais sintéticos, nenhuma chamada provider. Servidores encerrados e fixtures removidas na mesma rodada.
- Inspeção visual: primeira captura pegou loading/splash por fixture vazia; a fixture passou a oferecer conversa completa e o harness passou a exigir controles de modelo/composer visíveis. Smoke repetido com exit 0; capturas finais `auth-1440.png` e `auth-390.png` conferidas, shell carregado sem regressão visual observada. Apenas script de QA mudou após a build; lint focado validado, sem necessidade de recompilar o app.
- `node scripts/qa-runtime-ownership.mjs --systemd`: 5 verificações já aprovadas; lifecycle não mudou depois. Units sintéticas removidas; nenhuma unit da produção parada.
- Revisão principal dos diffs/contratos e revisão independente dos trechos próprios concluídas sem impedimento. Checkout produtivo continua limpo em `0adcfe3`; serviço observado active/running, sem alegação de publicação da nova versão. Não houve alteração de frontend; QA de catálogo/voz completo não se aplica, login real sintético foi validado em browser.
- Transição operacional: versões antigas sem protocolo de locks e units Studio legadas não são automaticamente coordenadas/encerradas. Drenar execuções e manter um único agendador no futuro corte autorizado. O health não certifica integridade/completude de backup nem disponibilidade de providers. Domínio sonaris.us permanece fora.

Sem bloqueios de implementação pendentes. Fechamento e publicação pertencem a Anders; merge/push/deploy não realizados.

Commits locais de implementação: `ef390d5` (auth/health), `83390ea` (runtime/Studio/QA), `afbb378` (ferramentas/unit/Pulse). Aprovação: `3cbeea7`; documentação de fechamento em commit posterior. `git diff --check` e lint focado final do QA: exit 0 (`qa-lint-final.log`).

Produção preservada: sem leitura de segredos/dados pessoais, chamadas pagas, merge, push, deploy ou restart de serviços existentes.

## Publicação autorizada — 2026-09-22

Anders autorizou publicar para revisão: “Podemos publicar e eu reviso?”. Esta autorização posterior permite a integração e o restart descritos abaixo; o estado da entrega permanece pronta para revisão.

- Pré-checagem em unit efêmera com EnvironmentFile carregado pelo systemd, sem expor valores: auth válida, Studio configurado/proprietário verificado, Memory V2 desligada; exit 0 (`preflight.log`). Nenhuma sessão Studio ou worker Pulse/SoundCase ativo no corte.
- `git merge --ff-only codex/review-seguranca-operacao`: exit 0, main `2584921`. Build isolada já validada `fQ5aGOE2G9BIiCdmil9-L` publicada, sem recompilar; 20 assets antigos retidos. Backup da build `raY9v6DYHbbAxp2R0PApb` em `next-before`, unit anterior em `chatgpt.service.before`.
- `publish.sh`: exit 0 (`publish.log`). Pausa dos timers/path Pulse/SoundCase, parada controlada do app, troca recuperável de build, instalação da unit versionada sem fuser, `systemctl daemon-reload` e `systemctl restart chatgpt.service`. Readiness local healthy, database/openai/memory/auth ok. Agendadores restaurados active/waiting; app active/running. Rollback preparado e não acionado.
- `systemd-run ... public-smoke.mjs`: exit 0 (`public-smoke.log`). Readiness e liveness local/público 200; conversas sem sessão 401; sessão efêmera autenticada; Studio real `{enabled:true,unlocked:false}`. Browser público em 1440/390 px com APIs de dados simuladas, shell/composer visíveis, zero pageerrors, capturas `public-1440.png` e `public-390.png` inspecionadas. JWT apenas em memória, browser com ambiente limitado, nenhuma consulta a conversas reais ou chamada paga. Não testa disponibilidade dos providers.
- Evidências, scripts e backups: `/root/.cache/gaucho-security-deploy-20260922`. APACHE.md atualizado com readiness/liveness e publicação; sem mudança de vhost, reload Apache, domínio ou push. Suites completas já aprovadas na build publicada; somente documentação alterada após a publicação.

DECISÃO: reutilizar a build isolada aprovada, mantendo assets antigos para abas abertas e backup recuperável, evita compilar no checkout que serve produção e preserva exatamente o artefato validado.

Validação documental pós-publicação: `git diff --check`, exit 0.
