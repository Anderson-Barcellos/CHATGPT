# Relatório — auth/health

Status: pronta para revisão da frente. A integração do boot e os gates completos ficam sob coordenação do principal.

## Resultado observável

- Produção exige `AUTH_ENABLED=true` e `AUTH_USERNAME`, `AUTH_PASSWORD` e `JWT_SECRET` não vazios. Fora de produção, somente `AUTH_ENABLED=false` explícito desliga a autenticação.
- `validateRuntimeAuthConfig()` é síncrona, exportada para o boot e só informa nomes de variáveis inválidas. Estado inválido falha fechado: proxy bloqueia a aplicação, `requireAppAuth` devolve `503` e login/check/logout também devolvem `503` sem expor credenciais.
- O readiness `GET /api/health` continua com seus campos existentes e agora inclui a checagem `auth`. A rota exata atravessa o proxy mesmo com configuração inválida para devolver `unhealthy`/`503` com `checks` e `metadata`; caminhos aninhados sob `/api/health` não recebem essa exceção. Aviso de memória continua `degraded`/`200`.
- `GET /api/health/live` é público e confirma somente a capacidade de resposta do processo, sem ler configuração ou armazenamento.
- Readiness não chama `readDataFile`: JSON inexistente, corrompido, com formato incompatível ou sem permissão falha sem criar, recuperar ou renomear arquivos. Com Memory V2 selecionado, a contagem de conversas vem de uma cópia efêmera do SQLite existente e de seu WAL, aberta em `readonly` sem migration; memórias e persona permanecem JSON.

## DECISÃO

`isAuthEnabled()` considera configuração inválida como exigência de autenticação, enquanto `isAuthConfigurationValid()` distingue o erro para responder `503`. Contexto: diversas rotas existentes combinam `isAuthEnabled()` com `isAuthenticatedRequest()`; retornar `false` no estado inválido as abriria. A escolha preserva os chamadores existentes e fecha o bypass sem reescrever suas rotas. Validado por proxy, `requireAppAuth`, login/check e matriz de configuração sintética.

DECISÃO: readiness não abre o SQLite vivo diretamente. Contexto: uma abertura SQLite `readonly` ainda modifica `-shm` quando há writer em WAL. A leitura copia somente o banco e o WAL para diretório temporário, consulta a cópia e a remove em `finally`. Isso mantém a fonte somente-leitura e enxerga a transação WAL pendente. A regressão mantém o writer aberto e confirma contagem e hashes/lista de arquivos inalterados.

## Arquivos da frente

- Alterados: `lib/server/auth.ts`, `lib/server/routeAuth.ts`, `proxy.ts`, `app/api/auth/{login,check,logout}/route.ts`, `app/api/health/route.ts`, testes existentes de auth/proxy.
- Adicionados: `lib/server/healthStorage.ts`, `app/api/health/live/route.ts`, e testes de auth routes, route auth, health storage e health routes.
- Nenhum arquivo ou import existente foi removido; JWT, formato de cookie e stores de runtime foram preservados.

## Validação e evidências

| Comando | Resultado |
| --- | --- |
| `./node_modules/.bin/vitest run lib/server/auth.test.ts lib/server/routeAuth.test.ts app/api/auth/routes.test.ts proxy.test.ts lib/server/healthStorage.test.ts app/api/health/route.test.ts` | saída 0; 6 arquivos, 31 testes aprovados. Inclui proxy + rota para readiness inválido e WAL pendente sem mutação. Log: `/root/.cache/gaucho-review-20260922/auth-focused-final.log`. |
| `npx eslint` sobre os 15 arquivos alterados da frente | saída 0; sem diagnósticos. Log: `/root/.cache/gaucho-review-20260922/auth-lint-final.log`. |
| `git diff --check` | saída 0. |
| `npx tsc --noEmit` | saída 2 no conjunto em estabilização. Após corrigir os cinco diagnósticos próprios, restaram somente avatar/tipagens nas frentes Studio/runtime/scripts; evidência: `/root/.cache/gaucho-review-20260922/auth-tsc-rerun.log`. O principal solicitou não repetir enquanto corrige esses arquivos. |

Limites: não houve build, suíte completa, browser, serviço, restart, alteração de proxy instalado ou leitura de `.env*`/dados runtime. São gates coordenados pelo principal; build no checkout de produção permanece proibida por esta frente.

## Revisão independente do principal

Revisados em leitura: `instrumentation.ts` e teste, `runtimeOwnership.ts` e teste, `studioOrphanUnits.ts` e teste, gate de `studioWorkspaceAuth`, builders de runner/terminal/kernel e `scripts/qa-runtime-ownership.mjs`. Não encontrei impedimento concreto: auth é validada antes dos locks, build/edge não os adquire, QA reserva os recursos compartilhados mas mantém Studio indisponível, e as units novas recebem vínculo com unit/invocação/cgroup validados. Verificação independente: os 7 arquivos de teste desses módulos passaram com 80 testes, saída 0; log `/root/.cache/gaucho-review-20260922/runtime-independent-review.log`. Nenhum arquivo do principal foi editado nesta revisão.
