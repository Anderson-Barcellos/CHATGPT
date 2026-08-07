# Gaucho Studio Python Workspace Implementation Plan

> **For agentic workers:** executar task a task com TDD (RED → GREEN → commit por fatia). Steps usam checkbox (`- [ ]`) para tracking. Spec de referência: `docs/superpowers/specs/2026-08-07-gaucho-studio-python-workspace-design.md`.

**Goal:** Anders edita um projeto Python contínuo que vive em `/root/studio-projects/active/`, roda o arquivo ativo num sandbox systemd com rede liberada e `OPENAI_API_KEY`, acompanha stdout/stderr em tempo real no console com Stop, e gerencia o ciclo de vida por zip (salvar/baixar, restaurar, importar, resetar) — tudo atrás de step-up auth com token efêmero em memória.

**Architecture:** Um núcleo server-side novo (`lib/server/studioWorkspace*.ts`) concentra step-up auth, FS seguro, zip e runner; rotas finas em `/api/studio/workspace/*` compõem auth do app + token. No cliente, um hook novo espelha o padrão do `useStudioWorkspace` para o modo servidor, e o `GauchoStudioShell` ganha alternância Local ↔ Python preservando o v1 intacto. O runner usa unit transient do systemd (`User=studio`, `BindPaths` → `/workspace`) — o Next roda como root (`chatgpt.service`), então chama `systemd-run` diretamente.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Monaco 0.55.1, `jose` 6.1.3 (token HS256, já no projeto), `adm-zip` (dependência nova, pinada), Vitest 4, systemd do host.

**Execution constraint:** executar inline por padrão; subagentes só com autorização explícita de Anders. Task 1 muda estado do host (usuário, pastas, venv) — já aprovada em desenho, executar com Anders ciente da sessão.

**Status de execução (2026-08-07, sessão Claude):** Tasks 1–7 concluídas com TDD e commits por fatia — `7c90676` provisionamento + jaula provada, `aef6b80` step-up auth, `db1735c` file API, `005ef47` zip lifecycle, `50c0bc5` runner SSE, `6bec0a5` cliente modo Python (controller puro `lib/studio/serverWorkspace.ts` + hook fino + shell com alternância/modal/zip), `7351cc1` FIM em python. Gates atuais: 462 testes, tsc, lint, build e `git diff --check` limpos. Falta a Task 8, que depende de Anders: definir `STUDIO_WORKSPACE_PASSWORD` no env do serviço, restart, prova viva da sandbox e smoke autenticado. `PRE_EXISTING_FAILURE`: `npm audit --omit=dev` acusa `pdfjs-dist` GHSA-hq66-cqwq-w95j (advisory nova, independente desta frente; fix é major 6.x — decisão de Anders fora deste escopo).

**Rollout/rollback:** o modo servidor só existe quando `STUDIO_WORKSPACE_PASSWORD` está definida no env do serviço; sem ela, `/api/studio/workspace/status` responde `enabled: false`, as demais rotas respondem `503 studio_workspace_disabled` e a UI esconde a alternância — o app inteiro se comporta como hoje. Rollback = remover a env e reiniciar; units transient morrem sozinhas (`RuntimeMaxSec`); user/pastas/venv podem ficar no host sem efeito. Restart do serviço invalida tokens emitidos (aceitável e desejável).

---

## File map

| Arquivo | Responsabilidade |
|---|---|
| `scripts/studio-workspace-setup.sh` | Provisionamento idempotente: user `studio`, pastas, venv base, template |
| `lib/server/studioWorkspaceAuth.ts` | Senha timing-safe, token jose HS256 60 min, gate composto, gate de habilitação |
| `lib/server/studioWorkspaceFs.ts` | Canonicalização de path, allowlist, tree/read/write/delete/rename com limites |
| `lib/server/studioWorkspaceZip.ts` | Zip com exclusões, extração zip-slip-safe, swap atômico via temp dir |
| `lib/server/studioWorkspaceRunner.ts` | Builder puro do `systemd-run`, spawn + captura streaming, orçamento, lock, stop |
| `lib/studio/workspaceServerProtocol.ts` | Contratos compartilhados: tree entry, eventos SSE de run, archive entry, códigos de erro |
| `app/api/studio/workspace/{status,unlock,tree,file,rename,run,stop,save,archive,restore,import,reset}/route.ts` | Rotas finas autenticadas |
| `hooks/useStudioServerWorkspace.ts` | Token em memória, tree, autosave debounce, run/stop SSE, ciclo de vida zip |
| `components/studio/GauchoStudioShell.tsx` + `StudioExplorer/StudioConsole/StudioEditor` | Alternância de modo, prompt de senha, Explorer/console no modo servidor |
| `lib/studio/types.ts`, `lib/studio/autocomplete.ts`, `lib/server/studioAutocomplete.ts` | `"python"` no contrato de linguagem e do FIM |
| `lib/security/rateLimit.ts`, `proxy.ts` | Famílias novas: unlock (10 RPM) e run (30 RPM) |
| `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/INFRASTRUCTURE.md`, `AGENTS.md`, `BACKLOG.md` | Contratos e diário |

## Interfaces fixadas

Contratos de dados conforme a spec (`StudioWorkspaceTreeEntry`, `StudioWorkspaceRunEvent`, `StudioArchiveEntry`, limites 1 MB/50 MB/200 MB/2 000 entries/320 chars). Adicionalmente:

```
Header do token:       X-Studio-Workspace-Token
Códigos de erro:       studio_workspace_disabled (503), studio_workspace_locked (401),
                       studio_workspace_invalid_path (400), studio_workspace_run_busy (409),
                       studio_workspace_zip_invalid (400), studio_workspace_too_large (413)
Envs novas:            STUDIO_WORKSPACE_PASSWORD, STUDIO_RUN_TIMEOUT_MS (default 120000)
Env do run (allowlist): OPENAI_API_KEY, PATH (venv primeiro), HOME=/workspace, LANG, PYTHONUNBUFFERED=1
Propriedades da unit (receita PROVADA em 2026-08-07, Task 1 Step 3):
  --uid=studio --unit=gaucho-studio-run-<id>
  --property=BindPaths=/root/studio-projects/active:/workspace
  --property=WorkingDirectory=/workspace --property=ProtectSystem=strict
  --property=ProtectHome=true --property=PrivateTmp=true --property=NoNewPrivileges=true
  --property=MemoryMax=1G --property=CPUQuota=100% --property=TasksMax=64
  --property=RuntimeMaxSec=<timeout+30s> --collect --pipe
  Executável: /opt/studio-venv/bin/python /workspace/<filePath>
  Venv em /opt/studio-venv (não sob /root): o systemd-run valida o executável
  no host antes de montar o namespace e o usuário de sandbox precisa atravessar
  o caminho; ProtectSystem=strict já entrega o venv read-only na jaula.
  Timeout observado: "Finished with result: timeout", SIGTERM, exit 1.
  Stop observado: systemctl stop <unit> leva active → inactive.
Orçamento do console:   2 000 eventos / 512 KiB, entry ≤ 16 KiB, truncamento com aviso explícito
```

---

### Task 1: Provisionar o host e provar a jaula na mão

**Files:** Create: `scripts/studio-workspace-setup.sh`

- [x] **Step 1:** Escrever o script idempotente: cria user de sistema `studio` sem shell de login, `/root/studio-projects/{active,archive}` com dono/permissão adequados, venv base em `/opt/studio-venv` (fora de `/root` — ver "Interfaces fixadas") com `openai httpx rich python-dotenv` congelados em `scripts/studio-venv-requirements.txt`, mountpoint `/workspace`, e o template inicial versionado em `templates/studio-python/` copiado para `active/` quando vazio.
- [x] **Step 2:** Rodar o script e conferir estado real (`id studio`, `ls -la`, `venv/bin/python -c "import openai"`). Observado: uid 995, active dono studio, openai 2.53.0; segunda execução provou idempotência.
- [x] **Step 3 (discovery, decidiu a receita final da unit):** provas vivas executadas em 2026-08-07: escrita em `/workspace` ok (arquivo real dono studio); `/etc` e venv read-only, `/root` negado; rede externa 200; uid 995; `RuntimeMaxSec=5` matou loop em 5,2 s (result: timeout, SIGTERM); stdout via `--pipe`; unit nomeada parou com `systemctl stop`. Ajuste descoberto: venv movido para `/opt/studio-venv` porque o `systemd-run` valida o executável no host antes do namespace.
- [x] **Step 4:** Commit do script.

**Evidence:** saída real dos comandos de prova registrada na sessão de 2026-08-07; a receita da unit deixou de ser hipótese.

### Task 2: Step-up auth e gate de habilitação

**Files:** Create: `lib/server/studioWorkspaceAuth.ts`, `lib/server/studioWorkspaceAuth.test.ts`, `app/api/studio/workspace/{status,unlock}/route.ts`; Modify: `lib/security/rateLimit.ts`, `proxy.ts`, `.env.example`

- [ ] **Step 1 (RED):** testes de `studioWorkspaceAuth`: comparação de senha em tempo constante; token emitido valida e expira em 60 min (relógio fake); token adulterado/ausente falha; feature desabilitada sem env; gate composto exige auth do app **e** token.
- [ ] **Step 2 (GREEN):** implementar com `jose` (HS256, secret derivado da senha + salt aleatório de processo), `requireStudioWorkspaceAccess(request)` compondo `isAuthEnabled`/`isAuthenticatedRequest` + header, e `isStudioWorkspaceEnabled()`.
- [ ] **Step 3 (RED→GREEN):** rotas `status` (auth do app; retorna `{ enabled, unlocked }`) e `unlock` (senha → token; rate limit família própria 10 RPM; erros sanitizados via `jsonError`).
- [ ] **Step 4:** testes focados verdes; commit.

### Task 3: FS seguro e rotas de arquivo

**Files:** Create: `lib/server/studioWorkspaceFs.ts`, `lib/server/studioWorkspaceFs.test.ts`, `lib/studio/workspaceServerProtocol.ts`, `app/api/studio/workspace/{tree,file,rename}/route.ts`

- [ ] **Step 1 (RED):** testes de `resolveWorkspacePath` (raiz injetável para teste em temp dir): aceita subpaths legítimos; rejeita `..`, absoluto, symlink que escapa, nome fora da allowlist de caracteres, path > 320 chars.
- [ ] **Step 2 (RED):** testes de tree (ordenação, kind, size, editable ≤ 1 MB e detecção de binário), read/write (cria diretórios intermediários), delete e rename dentro da raiz.
- [ ] **Step 3 (GREEN):** implementar com `node:fs/promises` + `realpath` na validação; rotas finas com `requireStudioWorkspaceAccess`.
- [ ] **Step 4:** testes focados verdes; commit.

### Task 4: Ciclo de vida por zip

**Files:** Create: `lib/server/studioWorkspaceZip.ts`, `lib/server/studioWorkspaceZip.test.ts`, `app/api/studio/workspace/{save,archive,restore,import,reset}/route.ts`; Modify: `package.json` (adicionar `adm-zip` pinado + `@types/adm-zip`)

- [ ] **Step 1 (RED):** testes do zip: criação exclui `__pycache__`, `.venv`, `.git`; roundtrip preserva conteúdo byte a byte; extração rejeita zip-slip (`../`), entry symlink, > 2 000 entries, > 200 MB extraído; slug sanitizado; falha no meio da extração não altera o ativo (swap por temp dir + rename).
- [ ] **Step 2 (GREEN):** implementar `createWorkspaceArchive`, `extractWorkspaceArchive` (valida cada entry antes de escrever), `swapActiveWorkspace` atômico e o template de reset (mesmo conteúdo do setup da Task 1, versionado no repo).
- [ ] **Step 3 (RED→GREEN):** rotas: `save` (grava `archive/<slug>.zip` e responde o zip como download), `archive` (lista), `restore`/`reset` (confirmação é responsabilidade da UI; rota executa), `import` (upload ≤ 50 MB via limite de body).
- [ ] **Step 4:** testes focados verdes; commit. Registrar a dependência nova no fechamento.

### Task 5: Runner systemd com SSE, Stop e orçamento

**Files:** Create: `lib/server/studioWorkspaceRunner.ts`, `lib/server/studioWorkspaceRunner.test.ts`, `app/api/studio/workspace/{run,stop}/route.ts`; Modify: `lib/security/rateLimit.ts`, `proxy.ts`

- [ ] **Step 1 (RED):** testes do builder puro `buildRunnerCommand(filePath, unitId, timeoutMs)`: argv exato conforme a receita provada na Task 1; env allowlist exata (nada além dela); rejeita filePath não validado.
- [ ] **Step 2 (RED):** testes do orçamento de saída (2 000 eventos / 512 KiB / entry 16 KiB, truncamento com aviso), do lock um-run-por-vez (`409 studio_workspace_run_busy`) e do mapeamento exit code/timeout/stop → `StudioWorkspaceRunStatus`.
- [ ] **Step 3 (GREEN):** implementar com `child_process.spawn` injetável (mock nos testes): captura incremental de stdout/stderr → eventos, kill por timeout da rota com `RuntimeMaxSec` de backstop, `stop` via `systemctl stop <unit>`.
- [ ] **Step 4 (RED→GREEN):** rota `run` como stream SSE (idioma do assist: `ReadableStream` + eventos serializados do protocolo), evento terminal `status` sempre presente (inclusive em erro), rate limit 30 RPM; rota `stop`.
- [ ] **Step 5:** testes focados verdes; commit.

### Task 6: Cliente — modo Python no shell

**Files:** Create: `hooks/useStudioServerWorkspace.ts`, `hooks/useStudioServerWorkspace.test.ts` (ou teste de componente focado); Modify: `components/studio/GauchoStudioShell.tsx`, `StudioExplorer.tsx`, `StudioConsole.tsx`, `StudioEditor.tsx`, `GauchoStudioShell.module.css`, `lib/studio/types.ts` (`"python"` em `StudioFileLanguage`)

- [x] **Step 1 (RED):** testes do hook: token só em memória (nunca storage); `401 studio_workspace_locked` dispara re-prompt e repete a ação pendente; autosave com debounce marca sujo/salvo; parse dos eventos SSE atualiza console e status; árvore recarrega após run terminar. (Implementado como testes do controller puro em `lib/studio/serverWorkspace.test.ts` — environment node.)
- [x] **Step 2 (GREEN):** implementar o hook consumindo as rotas das Tasks 2–5. (Controller puro em `lib/studio/serverWorkspace.ts` + hook fino `useStudioServerWorkspace` via `useSyncExternalStore`.)
- [x] **Step 3:** UI: alternância Local ↔ Python no topo do shell (visível só com `enabled: true` no status); modal de senha; Explorer alimentado pela árvore do servidor; Run/Stop e console reutilizados; ações Salvar (download), Restaurar, Importar e Novo projeto com confirmação destrutiva; indicador "Salvo" refletindo o disco. Monaco em `language: "python"` sem compile (o run é server-side — `compileActiveFile` não se aplica ao modo servidor).
- [x] **Step 4:** testes focados verdes + render sem erro; commit `6bec0a5` (suite completa 460 verdes, tsc, lint e build limpos).

### Task 7: Autocomplete FIM em Python

**Files:** Modify: `lib/studio/autocomplete.ts` + teste, `lib/server/studioAutocomplete.ts` + teste

- [x] **Step 1 (RED→GREEN):** inverter o contrato: `"python"` passa a ser elegível no cliente e aceito no parser da rota; os demais bloqueios (mobile, seleção, cooldown) permanecem. Ajustar os testes que hoje rejeitam `language: "python"`. (Inclui o selector do `registerInlineCompletionsProvider`, que também fixava o contrato antigo.)
- [x] **Step 2:** testes focados verdes; commit `7351cc1` (suite completa 462 verdes).

### Task 8: Integração, prova viva e entrega

**Files:** Modify: `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/INFRASTRUCTURE.md`, `AGENTS.md`, `BACKLOG.md`, `README.md`, `CLAUDE.md` (se contrato mudar)

- [ ] **Step 1:** gates completos: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm audit --omit=dev`, `git diff --check`.
- [ ] **Step 2:** definir `STUDIO_WORKSPACE_PASSWORD` no env do serviço com Anders, reiniciar `chatgpt.service`, health local e público.
- [ ] **Step 3 (prova viva da sandbox, critério de aceite da spec):** rodar pelo Studio um script real que (a) importa módulo local, (b) escreve log em arquivo, (c) chama a API OpenAI com a chave do env, (d) tenta escrever fora de `/workspace` e falha; conferir Stop num loop infinito e timeout; roundtrip salvar → resetar → restaurar byte a byte.
- [ ] **Step 4:** smoke Chrome autenticado do fluxo completo (unlock, edição/autosave, run com SSE ao vivo, zip download); conferir que sem a env o app se comporta como hoje.
- [ ] **Step 5:** atualizar docs (rotas novas em API.md; modos e runner em ARCHITECTURE.md; user/pastas/venv/envs em INFRASTRUCTURE.md), diário no AGENTS.md, BACKLOG com o bundle, commits coerentes. Push só com pedido explícito de Anders.

**Evidence final:** os critérios de aceite da spec, cada um apontando para teste, prova viva ou smoke — incluindo os negativos (escapar do workspace falha; rotas sem cookie+token falham; senha/token/chave ausentes de logs e respostas).
