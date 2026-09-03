# Repository Closeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-on-demand:subagent-driven-development (recommended) or superpowers-on-demand:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Fechar a organização do /root/CHATGPT preservando todo WIP legítimo, integrando as entregas já aprovadas, removendo resíduos perigosos, zerando lint e advisories conhecidos, reconciliando a documentação e publicando um main verificável.

**Architecture:** O fechamento acontece por unidades reversíveis e commits pequenos: primeiro o WIP de layout vira commit na própria branch; depois layout e Memory V2 E1/E2 entram em main sem ativar cutover; em seguida vêm higiene, lint, dependências e documentação. Deploy, smoke e push só ocorrem depois de todos os gates locais, e worktrees/branches só são removidas quando sua equivalência com main estiver provada.

**Tech Stack:** Git/worktrees, Next.js 16.2.12, React 19.2.3, TypeScript 5.9, Vitest 4.1, ESLint 9, npm audit, Playwright 1.59 com Google Chrome, systemd, Apache 2 e SQLite better-sqlite3 atrás de feature flag.

**Spec:** AGENTS.md

## Global Constraints

- Preservar dados privados em data/*.json, data/memory-index/, data/soundcase/ e /root/studio-projects/active/; nenhum deles pode virar fixture, ser formatado, migrado ou limpo.
- Manter MEMORY_V2_ENABLED desativado; integrar E1/E2 não autoriza migração real, cutover, E3 ou dual-write.
- Preservar a regra mobile já publicada: Studio oculto abaixo de 768px, Chat e SoundCase visíveis, Studio disponível no desktop.
- ProxyPassReverseCookiePath / /chat permanece dentro de <Location /chat>; nenhuma rota ou porta nova será criada.
- O WIP de layout-homogenization deve ser commitado e validado na própria worktree antes de qualquer merge.
- Arquivos não rastreados serão movidos para quarentena recuperável; nenhum rm -rf, git reset, git checkout -- ou limpeza ampla será usado.
- Atualizações de dependência ficam limitadas aos cinco advisories confirmados em 2026-09-03: dompurify, fflate, nanoid e pdfjs-dist; não executar upgrade geral.
- Cada commit usa git add com caminhos explícitos e não inclui dados runtime, segredos ou mudanças de outra tarefa.
- O push autorizado é somente de main para origin/main, depois de fetch, reconciliação de divergência e validação final.
- Subagentes, se usados, ficam em revisão/scouting/testes; o agente principal executa merges, edições compartilhadas, deploy e push.

## File Map

- .worktrees/layout-homogenization/**: entrega L1 existente, a ser apenas validada e commitada antes da integração.
- lib/server/memory-v2/**, scripts/memory-v2-migrate.ts e app/api/conversations/**: E1/E2 da Memory V2, integradas com autoridade exclusiva ainda desativada.
- .gitignore: ignora caches Python e artefatos compilados sem esconder scripts fonte legítimos.
- hooks/useSoundCase.ts: bootstrap assíncrono e estado renderizável da revisão persistida.
- hooks/useSoundCaseRealtime.ts: inicialização segura do fence e criação de audio fora de aliases vindos de refs.
- hooks/useSoundCase.test.ts e hooks/useSoundCaseRealtime.test.ts: regressões dos helpers usados pelos fixes de lint.
- hooks/useFileAttachments.ts: compatibilidade do carregamento de PDFs após pdfjs-dist 6.
- package.json e package-lock.json: versões seguras e overrides transitivos mínimos.
- AGENTS.md, BACKLOG.md, CLAUDE.md, README.md, docs canônicos e /etc/apache2/APACHE.md: estado operacional reconciliado.

---

### Task 1: Checkpoint da entrega L1 na worktree de layout

**Files:**
- Modify/commit existing: .worktrees/layout-homogenization/AGENTS.md
- Modify/commit existing: .worktrees/layout-homogenization/BACKLOG.md
- Modify/commit existing: .worktrees/layout-homogenization/app/globals.css
- Modify/commit existing: .worktrees/layout-homogenization/components/chat/**
- Modify/commit existing: .worktrees/layout-homogenization/components/command/CommandPalette.tsx
- Modify/commit existing: .worktrees/layout-homogenization/components/settings/SettingsDrawer.tsx
- Modify/commit existing: .worktrees/layout-homogenization/components/workspace-v2/**
- Modify/commit existing: .worktrees/layout-homogenization/stores/uiStore.ts
- Create/commit existing: .worktrees/layout-homogenization/stores/uiStore.test.ts

**Interfaces:**
- Consumes: codex/layout-homogenization em 7d036ed mais 22 mudanças já existentes.
- Produces: um único commit L1 autocontido, sem alterações adicionais de produto.

- [ ] **Step 1: Confirmar que o diff corresponde ao contrato L1**

Run:

~~~bash
git -C .worktrees/layout-homogenization status --short
git -C .worktrees/layout-homogenization diff --check
git -C .worktrees/layout-homogenization diff --name-status
git -C .worktrees/layout-homogenization diff -- AGENTS.md BACKLOG.md
~~~

Expected: 22 entradas; BACKLOG.md identifica “ENTREGA L1 — Layout confiável, acessível e consistente”; nenhum arquivo de data/, Studio server-side, Pulse server-side ou provider aparece.

- [ ] **Step 2: Rodar os testes focados da L1**

Run from /root/CHATGPT/.worktrees/layout-homogenization:

~~~bash
npm test -- components/chat/ChatContainer.test.tsx components/chat/MessageContent.test.tsx components/chat/QuickActionsBar.test.tsx components/workspace-v2/WorkspaceLayoutV2.test.tsx stores/uiStore.test.ts
~~~

Expected: PASS para home real, estado vazio honesto, contraste de interrupção, comando único do painel, remoção de status fictícios e estado centralizado.

- [ ] **Step 3: Rodar os gates completos da worktree**

Run from /root/CHATGPT/.worktrees/layout-homogenization:

~~~bash
npm test
npx tsc --noEmit
npm run lint
OPENAI_API_KEY=test-only-build-placeholder NEXT_PUBLIC_BASE_PATH=/chat npm run build
git diff --check
~~~

Expected: todos os gates passam; somente o warning NFT conhecido de studioWorkspaceFs.ts pode permanecer no build.

- [ ] **Step 4: Commitar exatamente a entrega existente**

Run from /root/CHATGPT/.worktrees/layout-homogenization:

~~~bash
git add AGENTS.md BACKLOG.md app/globals.css components/chat/ChatContainer.test.tsx components/chat/ChatContainer.tsx components/chat/MessageBubble.tsx components/chat/MessageContent.test.tsx components/chat/MessageContent.tsx components/chat/QuickActionsBar.test.tsx components/chat/QuickActionsBar.tsx components/chat/SelectionToolbar.tsx components/command/CommandPalette.tsx components/settings/SettingsDrawer.tsx components/workspace-v2/ChatCanvasV2.tsx components/workspace-v2/ContextPanelV2.tsx components/workspace-v2/GauchoChatShellV2.tsx components/workspace-v2/NotesProvider.tsx components/workspace-v2/WorkspaceLayoutV2.test.tsx components/workspace-v2/WorkspaceLayoutV2.tsx components/workspace-v2/canvas/ArtifactPreviewSheet.tsx stores/uiStore.ts stores/uiStore.test.ts
git commit -m "feat(chat): homogenize workspace interactions and accessibility"
~~~

Expected: worktree limpa e commit descendente de 7d036ed.

---

### Task 2: Integrar L1 e Memory V2 E1/E2 no main sem cutover

**Files:**
- Merge from: codex/layout-homogenization
- Merge from: codex/thematic-memory-continuity
- Preserve: components/navigation/ProductNav.tsx, app/globals.css, SoundCase e Gemini 3.7 do main
- Verify: lib/server/memory-v2/**, app/api/conversations/** e scripts/memory-v2-migrate.ts

**Interfaces:**
- Consumes: commit L1 da Task 1 e commits e91c4ad, 9ff2089 e 7e49bb8 da Memory V2.
- Produces: main contendo L1 e E1/E2; JSON continua autoridade porque MEMORY_V2_ENABLED permanece diferente de true.

- [ ] **Step 1: Atualizar referências e provar a divergência esperada**

Run:

~~~bash
git fetch --prune origin
git status --short --branch
git rev-list --left-right --count origin/main...main
git log --oneline main..codex/thematic-memory-continuity
git log --oneline main..codex/layout-homogenization
~~~

Expected: main sem mudanças rastreadas além deste plano; os únicos resíduos são a imagem DeepL, test.py e lib/server/__pycache__/; layout tem um commit novo e Memory V2 tem três commits exclusivos.

- [ ] **Step 2: Criar referências de recuperação antes dos merges**

Run:

~~~bash
git branch backup/layout-l1-20260903 codex/layout-homogenization
git branch backup/memory-v2-e1-e2-20260903 codex/thematic-memory-continuity
~~~

Expected: duas refs locais apontam para os tips exatos; nenhuma árvore de trabalho muda.

- [ ] **Step 3: Integrar a L1 preservando navegação e SoundCase atuais**

Run:

~~~bash
git merge --no-ff codex/layout-homogenization -m "merge: integrate validated workspace L1"
~~~

Expected: a prévia de aplicação já identificou resolução manual em AGENTS.md, components/command/CommandPalette.tsx e components/workspace-v2/WorkspaceLayoutV2.tsx. Em AGENTS.md, manter o diário atual e inserir a entrada L1 na ordem cronológica; em CommandPalette.tsx, preservar o comando SoundCase atual e adotar openContextPanel da L1; em WorkspaceLayoutV2.tsx, preservar ProductNav/SoundCase e aplicar recentConversations, seleção real e abertura centralizada do painel da L1. app/globals.css aplica com offset e deve conservar a regra gc-product-nav-desktop-only. Conferir git diff --cc e ausência de marcadores antes de concluir o merge.

- [ ] **Step 4: Validar a integração L1 antes da memória**

Run:

~~~bash
npm test -- components/chat/ChatContainer.test.tsx components/chat/MessageContent.test.tsx components/chat/QuickActionsBar.test.tsx components/workspace-v2/WorkspaceLayoutV2.test.tsx stores/uiStore.test.ts components/navigation/ProductNav.test.tsx
npx tsc --noEmit
git diff --check
~~~

Expected: PASS e Studio continua desktop-only no ProductNav.

- [ ] **Step 5: Integrar somente os três commits E1/E2 da Memory V2**

Run:

~~~bash
git merge --no-ff codex/thematic-memory-continuity -m "merge: integrate Memory V2 E1 and E2 foundation"
~~~

Expected: nenhuma alteração em .env.production ou dados reais. A prévia de merge identificou conflito manual somente em .gitignore: manter /data/soundcase/ e acrescentar /data/memory-v2.sqlite* e /data/memory-topics/. Se package.json/package-lock.json exigirem reconciliação sem marcador de conflito, preservar todas as dependências atuais e acrescentar better-sqlite3, @types/better-sqlite3 e tsx exigidos por E1/E2; regenerar o lock com npm install --package-lock-only.

- [ ] **Step 6: Provar autoridade exclusiva e migração dry-run**

Run:

~~~bash
npm ci
npm test -- lib/server/memory-v2/database.test.ts lib/server/memory-v2/importLegacy.test.ts lib/server/memory-v2/conversationRepository.test.ts app/api/conversations/route.test.ts app/api/conversations/[id]/route.test.ts app/api/conversations/[id]/restore/route.test.ts
npm run memory:migrate -- --source test/fixtures/memory-v2 --database /tmp/gaucho-memory-closeout.sqlite
npx tsc --noEmit
git diff --check
~~~

Expected: PASS; o dry-run não cria nem altera data/memory-v2.sqlite; modos legacy e v2 continuam mutuamente exclusivos.

---

### Task 3: Quarentenar resíduos e impedir novo cache Python

**Files:**
- Modify: .gitignore
- Move out of repository: deepl-logo-png_seeklogo-470668.png
- Move out of repository: test.py
- Move out of repository: lib/server/__pycache__/

**Interfaces:**
- Consumes: três itens não rastreados confirmados na auditoria.
- Produces: checkout sem resíduos; quarentena recuperável /root/CHATGPT-quarentena-2026-09-03/closeout/ com modo privado.

- [ ] **Step 1: Registrar identidade sem imprimir conteúdo sensível**

Run:

~~~bash
stat --printf='%n %s bytes %y\n' deepl-logo-png_seeklogo-470668.png test.py lib/server/__pycache__
sha256sum deepl-logo-png_seeklogo-470668.png test.py lib/server/__pycache__/studio-kernel-bridge.cpython-312.pyc
git log --all --oneline -- deepl-logo-png_seeklogo-470668.png test.py lib/server/__pycache__
~~~

Expected: nenhuma entrada no histórico Git; não executar test.py e não imprimir seu conteúdo.

- [ ] **Step 2: Adicionar guardas Python ao ignore**

Add under # debug in .gitignore:

~~~gitignore
__pycache__/
*.py[cod]
~~~

- [ ] **Step 3: Mover os resíduos para quarentena privada**

Run:

~~~bash
install -d -m 700 /root/CHATGPT-quarentena-2026-09-03/closeout
mv deepl-logo-png_seeklogo-470668.png /root/CHATGPT-quarentena-2026-09-03/closeout/
mv test.py /root/CHATGPT-quarentena-2026-09-03/closeout/
mv lib/server/__pycache__ /root/CHATGPT-quarentena-2026-09-03/closeout/lib-server-pycache
chmod -R go-rwx /root/CHATGPT-quarentena-2026-09-03/closeout
~~~

Expected: os três caminhos somem do git status; arquivos continuam recuperáveis fora do checkout.

- [ ] **Step 4: Fazer varredura estrutural de segredos**

Run:

~~~bash
git grep -n -I -E '(OPENAI_API_KEY.*print|print\(.*API_KEY|sk-proj-[A-Za-z0-9_-]{20,}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY)' -- ':!docs/superpowers-on-demand/plans/2026-09-03-repository-closeout.md' || true
git status --short
git diff --check
~~~

Expected: nenhum segredo literal ou impressor de credencial em arquivos rastreados; apenas .gitignore e o plano aparecem modificados nesta etapa.

- [ ] **Step 5: Commitar plano e guarda de higiene**

Run:

~~~bash
git add .gitignore docs/superpowers-on-demand/plans/2026-09-03-repository-closeout.md
git commit -m "chore(repo): plan closeout and ignore Python caches"
~~~

---

### Task 4: Corrigir os quatro erros de lint do SoundCase com regressões

**Files:**
- Modify: hooks/useSoundCase.ts
- Modify: hooks/useSoundCase.test.ts
- Modify: hooks/useSoundCaseRealtime.ts
- Modify: hooks/useSoundCaseRealtime.test.ts

**Interfaces:**
- Produces: isSoundCaseDraftDirty(draftText: string, persistedText: string): boolean.
- Produces: createSoundCaseAudioElement(documentRef: Document): HTMLAudioElement.
- Preserves: CAS, recovery local, autoplay prime, fence de sessão e API pública dos hooks.

- [ ] **Step 1: Fixar regressões puras antes do refactor**

Add to hooks/useSoundCase.test.ts:

~~~ts
it("marca dirty somente quando o texto diverge do snapshot persistido", () => {
  expect(isSoundCaseDraftDirty("rascunho", "salvo")).toBe(true);
  expect(isSoundCaseDraftDirty("salvo", "salvo")).toBe(false);
});
~~~

Add to hooks/useSoundCaseRealtime.test.ts and set // @vitest-environment jsdom at the top:

~~~ts
it("cria um elemento de áudio preparado para playback inline", () => {
  const audio = createSoundCaseAudioElement(document);
  expect(audio.autoplay).toBe(true);
  expect(audio.hidden).toBe(true);
  expect(audio.getAttribute("playsinline")).toBe("true");
});
~~~

- [ ] **Step 2: Rodar RED para os helpers ausentes**

Run:

~~~bash
npm test -- hooks/useSoundCase.test.ts hooks/useSoundCaseRealtime.test.ts
~~~

Expected: FAIL porque os dois helpers ainda não são exportados.

- [ ] **Step 3: Tornar o snapshot persistido renderizável**

Add to hooks/useSoundCase.ts:

~~~ts
export function isSoundCaseDraftDirty(draftText: string, persistedText: string): boolean {
  return draftText !== persistedText;
}
~~~

Inside the hook, add const [persistedText, setPersistedText] = useState("");. Whenever persistedTextRef.current is assigned after load/save/delete, assign the same value to setPersistedText(...). Return isDirty: isSoundCaseDraftDirty(draftText, persistedText) so render never reads .current.

- [ ] **Step 4: Remover o setter síncrono do bootstrap do effect**

Replace the bootstrap call to refreshProjects() with:

~~~ts
useEffect(() => {
  let cancelled = false;
  void soundCaseApi.listProjects().then(async (items) => {
    if (cancelled) return;
    setProjects(items);
    const first = [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    if (first) await loadProject(first.id);
  }).catch((cause) => {
    if (!cancelled) setError(readableSoundCaseError(cause, "Não foi possível carregar o SoundCase."));
  }).finally(() => {
    if (!cancelled) setLoading(false);
  });
  return () => { cancelled = true; };
}, [loadProject]);
~~~

- [ ] **Step 5: Isolar criação do áudio e aceitar o padrão de ref nula**

Add outside useSoundCaseRealtime:

~~~ts
export function createSoundCaseAudioElement(documentRef: Document): HTMLAudioElement {
  const audio = documentRef.createElement("audio");
  audio.autoplay = true;
  audio.hidden = true;
  audio.setAttribute("playsinline", "true");
  return audio;
}
~~~

Use if (fenceRef.current === null) for one-time initialization. In prime() and start(), call createSoundCaseAudioElement(document) before assigning the new node to audioRef.current; never mutate an element obtained from audioRef.current.

- [ ] **Step 6: Rodar testes e lint focal**

Run:

~~~bash
npm test -- hooks/useSoundCase.test.ts hooks/useSoundCaseRealtime.test.ts
npx eslint hooks/useSoundCase.ts hooks/useSoundCaseRealtime.ts hooks/useSoundCase.test.ts hooks/useSoundCaseRealtime.test.ts
npx tsc --noEmit
~~~

Expected: PASS e zero erros/warnings nos quatro arquivos.

- [ ] **Step 7: Commitar o hardening React**

Run:

~~~bash
git add hooks/useSoundCase.ts hooks/useSoundCase.test.ts hooks/useSoundCaseRealtime.ts hooks/useSoundCaseRealtime.test.ts
git commit -m "fix(soundcase): satisfy React hook invariants"
~~~

---

### Task 5: Corrigir os cinco advisories sem upgrade geral

**Files:**
- Modify: package.json
- Modify: package-lock.json
- Modify: hooks/useFileAttachments.ts only if PDF.js 6 requires a worker path adjustment
- Test: lib/studio/sanitizeNotebookHtml.test.ts
- Test: lib/export/pdf.test.ts
- Test: lib/export/documentPdf.test.ts

**Interfaces:**
- Produces exact direct versions: dompurify@3.4.14 and pdfjs-dist@6.3.289.
- Produces exact overrides: dompurify@3.4.14, fflate@0.8.3 and nanoid@3.3.18.
- Preserves: HTML sanitization, jsPDF export and PDF text extraction in the composer.

- [ ] **Step 1: Atualizar apenas versões e overrides aprovados**

Change package.json direct dependencies to:

~~~json
"dompurify": "3.4.14",
"pdfjs-dist": "6.3.289"
~~~

Add or update overrides:

~~~json
"dompurify": "3.4.14",
"fflate": "0.8.3",
"nanoid": "3.3.18"
~~~

- [ ] **Step 2: Regenerar o lock e instalar exatamente a árvore declarada**

Run:

~~~bash
npm install --package-lock-only
npm ci
npm ls dompurify fflate nanoid pdfjs-dist
~~~

Expected: árvore sem dompurify<=3.4.12, fflate<=0.8.2, nanoid<3.3.18 ou pdfjs-dist<6.2.108.

- [ ] **Step 3: Provar sanitização, export e build do worker PDF**

Run:

~~~bash
npm test -- lib/studio/sanitizeNotebookHtml.test.ts lib/export/pdf.test.ts lib/export/documentPdf.test.ts
npx tsc --noEmit
NEXT_PUBLIC_BASE_PATH=/chat npm run build
~~~

Expected: PASS; pdfjs-dist/build/pdf.worker.min.mjs resolve no bundle. Se o caminho mudou no major 6, ajustar somente GlobalWorkerOptions.workerSrc em hooks/useFileAttachments.ts para o arquivo exportado pelo pacote e repetir estes gates.

- [ ] **Step 4: Confirmar audit zerado**

Run:

~~~bash
npm audit --omit=dev --audit-level=moderate
~~~

Expected: found 0 vulnerabilities.

- [ ] **Step 5: Commitar a atualização cirúrgica**

Run:

~~~bash
git add package.json package-lock.json
git add hooks/useFileAttachments.ts
git commit -m "fix(deps): resolve runtime security advisories"
~~~

If hooks/useFileAttachments.ts did not change, omit its git add.

---

### Task 6: Reconciliar documentação e estado operacional

**Files:**
- Modify: AGENTS.md
- Modify: BACKLOG.md
- Modify: CLAUDE.md
- Modify: README.md
- Modify: docs/API.md
- Modify: docs/ARCHITECTURE.md
- Modify: docs/INFRASTRUCTURE.md
- Verify/modify: docs/MODELS.md
- Modify: /etc/apache2/APACHE.md

**Interfaces:**
- Consumes: estado final das Tasks 1–5.
- Produces: uma narrativa canônica sobre Gemini 3.7, SoundCase, L1, Memory V2 desativada, dependências e runtime.

- [ ] **Step 1: Corrigir todas as referências ativas ao Gemini antigo**

Replace active Gemini 3.6 Flash / gemini-3.6-flash references with Gemini 3.7 Flash / gemini-3.7-flash in AGENTS.md, CLAUDE.md, README.md, docs/INFRASTRUCTURE.md and /etc/apache2/APACHE.md. Preserve historical changelog entries that explicitly document the old 3.6 rollout.

Run:

~~~bash
rg -n 'Gemini 3\.6 Flash|gemini-3\.6-flash' AGENTS.md CLAUDE.md README.md docs/*.md /etc/apache2/APACHE.md
~~~

Expected: resultados apenas em seções históricas claramente datadas, nunca em Estado atual, tabelas de endpoint/env ou overview.

- [ ] **Step 2: Documentar Memory V2 E1/E2 sem prometer cutover**

Update docs/API.md with archive-by-default, restore and ?permanent=true semantics behind MEMORY_V2_ENABLED=true. Update docs/ARCHITECTURE.md and docs/INFRASTRUCTURE.md to state: E1/E2 are integrated, SQLite/JSON authorities are exclusive, the flag remains disabled in production, the migration CLI defaults to dry-run, and real data was not migrated.

- [ ] **Step 3: Reconciliar BACKLOG e diário**

Set layout L1 in BACKLOG.md to pronta para revisão integrada, record Memory V2 E1/E2 as an integrated disabled foundation rather than an active cutover, and keep Nenhuma FRENTE ativa until Anders closes or activates a delivery. Append one dated entry to AGENTS.md covering the evidence already produced in Tasks 1–5, explicitly leaving deploy and push pending until Task 7 proves them.

- [ ] **Step 4: Validar consistência documental**

Run:

~~~bash
rg -n 'Gemini 3\.[67]|gemini-3\.[67]-flash|MEMORY_V2_ENABLED|SoundCase|layout L1' AGENTS.md BACKLOG.md CLAUDE.md README.md docs/*.md /etc/apache2/APACHE.md
git diff --check
apache2ctl configtest
~~~

Expected: estado atual consistente, históricos preservados e Syntax OK.

- [ ] **Step 5: Commitar docs versionados**

Run:

~~~bash
git add AGENTS.md BACKLOG.md CLAUDE.md README.md docs/API.md docs/ARCHITECTURE.md docs/INFRASTRUCTURE.md docs/MODELS.md
git commit -m "docs: reconcile repository closeout state"
~~~

Do not add /etc/apache2/APACHE.md because it is outside this repository; verify its diff separately.

---

### Task 7: Verificação final, deploy, publicação e limpeza de worktrees

**Files:**
- Verify only: entire repository
- Remove after equivalence proof: .worktrees/layout-homogenization, .worktrees/soundcase and .worktrees/thematic-memory-continuity
- Delete local merged refs after worktree removal: codex/layout-homogenization, codex/soundcase, codex/thematic-memory-continuity and Task 2 backup refs

**Interfaces:**
- Consumes: main completamente commitado das Tasks 1–6.
- Produces: runtime saudável, origin/main sincronizado e somente worktrees/branches ainda necessárias.

- [ ] **Step 1: Rodar a escada local completa**

Run:

~~~bash
npm test
npx tsc --noEmit
npm run lint
npm audit --omit=dev --audit-level=moderate
NEXT_PUBLIC_BASE_PATH=/chat npm run build
git diff --check
git status --short --branch
~~~

Expected: 100% testes, typecheck/lint/audit/build verdes; somente o warning NFT conhecido pode aparecer; main sem mudanças rastreadas ou não rastreadas.

- [ ] **Step 2: Rodar smoke isolado responsivo sem dados persistentes**

Start a temporary production server on port 3940 with AUTH_ENABLED=false, then use /usr/bin/google-chrome-stable through Playwright. Verify /chat, /chat/soundcase and /chat/studio at 390x844 and 1024x844; assert zero pageerror, no horizontal overflow, Studio hidden in ProductNav at 390px and visible at 1024px. For PDF.js, upload a synthetic PDF generated in memory and assert extracted text appears before sending; do not submit a chat message or create runtime data. Stop the temporary server afterward.

- [ ] **Step 3: Reiniciar produção e verificar rota real**

Run:

~~~bash
systemctl restart chatgpt.service
curl --retry 12 --retry-connrefused --retry-delay 1 --fail --silent http://127.0.0.1:3040/chat/api/health
curl --fail --silent --show-error -o /dev/null -w '%{http_code}\n' https://ultrassom.ai/chat/api/health
systemctl is-active chatgpt.service chatgpt-soundcase.path chatgpt-soundcase.timer
apache2ctl configtest
~~~

Expected: local healthy, público 200, três units ativas e Syntax OK.

- [ ] **Step 4: Provar equivalência antes de remover worktrees**

Run:

~~~bash
git -C .worktrees/layout-homogenization status --short
git -C .worktrees/soundcase status --short
git -C .worktrees/thematic-memory-continuity status --short
git merge-base --is-ancestor codex/layout-homogenization main
git merge-base --is-ancestor codex/soundcase main
git merge-base --is-ancestor codex/thematic-memory-continuity main
~~~

Expected: três worktrees limpas e três comandos merge-base com exit 0.

- [ ] **Step 5: Remover apenas worktrees e branches comprovadamente integradas**

Run:

~~~bash
git worktree remove /root/CHATGPT/.worktrees/layout-homogenization
git worktree remove /root/CHATGPT/.worktrees/soundcase
git worktree remove /root/CHATGPT/.worktrees/thematic-memory-continuity
git branch -d codex/layout-homogenization codex/soundcase codex/thematic-memory-continuity
git branch -d backup/layout-l1-20260903 backup/memory-v2-e1-e2-20260903
git worktree prune
~~~

Expected: apenas /root/CHATGPT permanece em git worktree list; nenhum commit exclusivo é perdido.

- [ ] **Step 6: Reconciliar remoto e publicar main**

Run:

~~~bash
git fetch --prune origin
git rev-list --left-right --count origin/main...main
git push origin main
git rev-list --left-right --count origin/main...main
git status --short --branch
~~~

Expected: antes do push, origin/main não tem commits exclusivos; depois, contagem 0 0 e main alinhado ao remoto.

- [ ] **Step 7: Fechamento Superpowers com evidência fresca**

After the first push proves remote divergence 0 0, update the dated AGENTS.md closeout entry with final commit IDs, test count, lint/audit/build status, smoke viewports, health status, remaining worktrees, quarantine path and the known NFT warning. Commit and push that evidence entry, then prove remote divergence 0 0 again. Mark this delivery pronta para revisão; only Anders marks it fechada.
