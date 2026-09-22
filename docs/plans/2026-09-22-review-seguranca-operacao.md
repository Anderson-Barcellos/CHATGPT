# Gaúcho Chat — correções de segurança e operação

## 1. Entrevista e objetivo

Corrigir os sete achados do review preservando o app e preparando uma versão verificável para a futura migração.

### 1.1 Decisões e aprovação vinculantes

Anders escolheu todos os sete achados, com uma única instância de produção, sem cluster; login obrigatório em produção (configuração desligada/ausente/incompleta impede boot). Desenvolvimento e testes podem desligar explicitamente. Servidor mantém Linux/estrutura. Domínio sonaris.us será adaptado no destino, fora desta entrega. Em 2026-09-22 aprovou: “Implement the plan.”

Base: 0adcfe3. Worktree: /root/CHATGPT/.worktrees/review-seguranca-operacao. Branch: codex/review-seguranca-operacao.

Fica fora: dados reais, migração, ativação Memory V2, modelos/UI, credenciais, domínio/proxy, merge, push, deploy e restart de produção.

## Autenticação obrigatória e health confiável

Objetivo: configuração incompleta não abre app; health não modifica armazenamento.
Escopo por arquivo: lib/server/auth.ts, lib/server/routeAuth.ts, proxy.ts, app/api/auth/*, app/api/health/route.ts, app/api/health/live/route.ts, helper novo de saúde e testes. Instrumentation pertence ao principal.
Contratos: produção exige AUTH_ENABLED=true, AUTH_USERNAME/AUTH_PASSWORD/JWT_SECRET não vazios. Fora de produção apenas false explícito desliga. Validar no boot, nunca no build; erros identificam nomes, nunca valores. Helpers falham fechados; login/check inválidos retornam 503. Preservar JWT/cookies/respostas válidas. /api/health mantém campos atuais como readiness; configuração/storage falhos => unhealthy/503, memória warning pode ser degraded/200. /api/health/live público só indica processo vivo. Leitura estrita sem criação/recovery/rename: JSON ausente/inválido/formato incompatível/acesso insuficiente falha. Memory V2 selecionado: SQLite existente readonly sem migration para conversas; memórias/persona continuam JSON. OpenAI só configuração, sem rede; health não certifica restauração integral.
Dependências: principal integra export validateRuntimeAuthConfig() síncrono ao boot; implementação deve combinar contrato se necessário.
Testes internos: matriz auth, login, anonymous; storage ausente/corrompido/permissões/SQLite; comprovar ausência de mutação.
Testes externos: HTTP/login sintéticos na build isolada.
Evidência de pronto: produção inválida não inicia, readiness 503 sem dados, liveness não escreve.
Preservar: sessões válidas, cookies, step-up Studio, stores fora do health.

## Instância única e propriedade Studio

Objetivo: impedir dois servidores disputando dados; eliminar limpeza wildcard.
Escopo por arquivo: instrumentation.ts, novo lib/server/runtimeOwnership.ts e testes, lib/server/studioOrphanUnits.ts e testes, builders studioWorkspaceRunner.ts/studioTerminal.ts/studioNotebookKernel.ts e testes, gate Studio necessário, units sob coordenação com frente scripts.
Contratos: locks flock no boot Node antes de recovery/atendimento; recursos canônicos data, SoundCase/SQLite externos e Studio quando habilitado; locks em ordem estável, conflito falha e libera aquisições anteriores. Locks durante vida do servidor; saída libera; perda encerra runtime. Build não adquire locks. Flag QA não pula exclusividade; Studio real indisponível em QA. Substituir cleanup cego por vínculo de novas units ao proprietário validado no systemd (unit, invocação e cgroup), com lifecycle. Não inferir propriedade só de nome/env. Units legadas sem dono não são encerradas; documentar transição.
Dependências: auth validada antes da inicialização operacional; locks antes de recovery.
Testes internos: recursos/symlinks, comandos simulados, identificação real de dono, boot/erro.
Testes externos: subprocessos concorrentes, queda/reaquisição/perda; units sintéticas próprias quando viável, sem tocar sessões reais.
Evidência de pronto: segundo servidor falha sem efeitos; primeiro preservado; sessões novas vinculadas; nenhum stop wildcard.
Preservar: sandbox/limites/step-up/stdin/PTY/notebook/Pulse, sem repetição cobrada.

## Ferramentas operacionais seguras

Objetivo: validação não destrói produção, serviço não mata ocupante, Pulse não expõe token argv.
Escopo por arquivo: scripts/pre-deploy.sh, scripts/test-local.sh, scripts/run-pulse-due.sh, systemd/chatgpt.service, helper shell e testes focados necessários.
Contratos: pré-deploy exige checkout isolado e recusa produção antes de mutações mesmo --skip-build; caminhos canônicos e WorkingDirectory vivo. Sem rm .next, instalação silenciosa, leitura de env/credenciais ou impressão de segredos. Falhas propagam exit; argumento desconhecido falha; --skip-build não certifica entrega. test-local opera somente isolado, loopback/porta explicitamente verificada, para se build falhar, GAUCHO_ISOLATED_RUNTIME=true. Remover fuser -k; porta ocupada falha sem sinal. Pulse header por stdin, token ausente falha antes de rede; URL e comportamento preservados.
Dependências: smoke integrado no boot novo; units apenas versionadas.
Testes internos/externos: shell substitutos capturam argv/efeitos; recusa antes de escrita; propagação exit; token só stdin; shell syntax e systemd verify sem instalar.
Evidência de pronto: .next controle intacta; processo ocupante preservado; token ausente de argv/log.
Preservar: porta 3040, /chat, domínio, timers e runner.

## Integração, evidências e fechamento

Principal: runtime/Studio, docs, Git, integração, gates e revisão. Frente auth: arquivos da seção auth; frente scripts: arquivos da seção ferramentas. Nenhum arquivo tem dois responsáveis. Máximo dois implementadores; cada um revisará trecho do principal após sua frente.
Gates sequenciais com conjunto estabilizado: npm test; npx tsc --noEmit; npm run lint; NEXT_PUBLIC_BASE_PATH=/chat npm run build. Testes de scripts/unit e smoke Chrome/Playwright login/HTTP/duas instâncias com dados e credenciais sintéticos. Frontend alterado exige também QA existente aplicável. Sem chamadas pagas/produção. Gate interrompido não conta; repetir uma vez se seguro e sem política específica.
Paradas: isolamento impossível, ownership incerto, gate obrigatório bloqueado, mudança de escopo. Registrar BLOCKED só na parte dependente.
Documentação canônica: API, arquitetura, infraestrutura; BACKLOG estado e diário append-only. Relatório principal: docs/plans/2026-09-22-review-seguranca-operacao-report.md; frentes: mesmo prefixo -auth-report.md e -scripts-report.md. Evidências completas em /root/.cache/gaucho-review-20260922. Commits locais convencionais por unidade coerente; final docs. Pronta para revisão após gates/revisão; publicação separada.
