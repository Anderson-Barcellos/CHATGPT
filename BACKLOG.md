# BACKLOG

## Estado operacional

### Nenhuma FRENTE ativa

O fechamento do repositório e a ENTREGA L1 integrada foram fechados por Anders em 2026-09-03. As candidatas abaixo não estão automaticamente autorizadas; uma nova FRENTE só começa por decisão dele. A FRENTE H (Hardening) foi fechada em 2026-09-05.

#### ENTREGA L1 — Layout confiável, acessível e consistente (`fechada`)

Resultado esperado: preservar o Atmosphere Glass enquanto a home mobile passa a usar conversas reais, os atalhos abrem a aba correta, o Canvas funciona como modal acessível e os estados visuais deixam de prometer informações sem fonte real.

Escopo incluído: home e navegação mobile, painel contextual centralizado, contraste e nomes acessíveis, hit areas touch, Canvas Radix, welcome determinístico, movimento reduzido e animação de mensagens durante streaming.

Limites explícitos cumpridos na implementação: não alterou rotas, providers, dados persistidos, bundle splitting amplo, dependências, Studio/Pulse ou runtime público. O lote isolado em `codex/layout-homogenization` foi auditado e integrado ao `main` em `ad285eb` durante o fechamento autorizado de 2026-09-03.

Evidência de conclusão: 113 arquivos/574 testes, TypeScript, lint, build prefixada em `/chat` e `git diff --check` limpos. QA autenticado no Google Chrome passou 32/32 em 320/375/430/768/1024/1490 px, Daybreak/Midnight, ausência de overflow/erros de console, navegação real, painel/abas, alvo de envio 44×44, Settings, Canvas com foco inicial/Escape e movimento reduzido; uma sonda adicional confirmou o retorno explícito do foco ao gatilho. A integração repetiu 18 testes focados e TypeScript com sucesso. A build mantém o warning preexistente de NFT tracing do Studio.

#### Fundação Memory V2 E1/E2 — integrada e desativada

SQLite, schema, repositório de conversas, ciclo arquivar/restaurar/excluir permanentemente e CLI de migração estão integrados em `ea9eda7`. `MEMORY_V2_ENABLED` permanece desligada em produção, JSON e SQLite nunca operam como autoridades simultâneas, e nenhum dado real foi migrado. O dry-run em fixtures reconciliou contagens e hashes sem criar o banco de destino. Ativação/cutover é uma futura ENTREGA, não uma frente ativa.

Próxima candidata prioritária, sem ativação automática: blindagem do symlink final do Studio e autenticação/claim/recovery do Pulse descobertos na auditoria de 2026-08-22.

### MAPA candidato — Auditoria geral de 2026-09-04

Cinco varreduras somente-leitura (backend, frontend, layout/perf, docs, superfícies Studio/Pulse/SoundCase). Gates no momento da auditoria: 745/745 testes, tsc, lint, `npm audit` e journal de 7 dias limpos. Nenhuma FRENTE abaixo está ativa; Anders decide a ordem.

#### FRENTE H — Hardening (`fechada` em 2026-09-05: H1–H5 e B7 fechadas por Anders)

- ✅ **H1 fechada em 2026-09-04**: `/api/pulse/run-due` estava público (sem `PULSE_RUNNER_TOKEN` o fallback por hostname passava tudo, confirmado ao vivo com POST externo → 200). Agora exige bearer com `timingSafeEqual`, 503 se não configurado, rate limit no proxy; token gerado em `.env.production`; `run-next` do SoundCase também entrou no rate limit. Teste: `app/api/pulse/run-due/route.test.ts`.
- ✅ **H2 fechada em 2026-09-04** (Anders): `resolveWorkspacePath` rejeita symlink no último componente (`lstat`), e `readWorkspaceFile`/`writeWorkspaceFile`/tree abrem com `O_NOFOLLOW` (fecha TOCTOU). 4 testes novos em `studioWorkspaceFs.test.ts`; smoke real na jail: symlink criado como `studio` apontando pra `/root` → GET/PUT 400, canário intacto, arquivo normal 200/200.
- ✅ **H3 fechada em 2026-09-05** (decisão de Anders: chave com limite de gasto): novo `lib/server/studioJailEnv.ts` (`buildJailParentEnv` troca `OPENAI_API_KEY` pela `STUDIO_OPENAI_API_KEY` e apaga a principal; `hasJailOpenAIKey`). Runner, terminal e kernel só emitem `--setenv=OPENAI_API_KEY` quando a chave de escopo existe, e o spawn recebe o env trocado. `.env.production` ganhou `STUDIO_OPENAI_API_KEY` (a chave universal do fish, validada com `GET /v1/models`). Testes: `studioJailEnv.test.ts` + 5 ajustes/novos nos três builders. Docs: INFRASTRUCTURE.md, API.md.
- ✅ **H4 fechada em 2026-09-05** (Anders): `extractWorkspaceArchive` soma `entry.header.size` na passada de validação e recusa `zip_too_large` antes de inflar ou escrever qualquer entrada (antes o primeiro arquivo já ia pro disco e a memória pagava a inflação); segunda barreira pelo tamanho real mantida. Teste novo em `studioWorkspaceZip.test.ts` (staging vazio após rejeição). adm-zip 0.6.0 já limita a inflação ao tamanho declarado.
- ✅ **H5 fechada em 2026-09-05** (Anders): `PUT /api/memories/[id]` valida `content` (string não vazia, trim), `isActive` (boolean) e `priority` (número finito) com 400 antes de tocar o storage (teste novo `app/api/memories/[id]/route.test.ts`); `run/stdin` ganhou balde próprio `studioWorkspaceStdin` de 240/min (`RATE_LIMIT_STUDIO_WORKSPACE_STDIN_RPM`) em vez de cair no `studio` de 20/min (teste em `rateLimit.test.ts`). Docs: API.md e INFRASTRUCTURE.md.

#### FRENTE candidata B — Bugs funcionais

- B1 (alta): Parar + reenviar em <1 s — `useChat.ts:1042-1048` anula `abortControllerRef` incondicionalmente no `finally` do stream antigo; `stopGeneration` zera `isLoading` antes do `catch` terminar; auto-save grava mensagens da conversa B no id da A.
- B2: `reconcileBackgroundJobs` (`useChat.ts:384-392`) zera `isStreaming` com stream normal ativo quando há job pendente de outra conversa (troca de aba do navegador).
- B3: quick actions "Continuar/Encurtar" mudas (`CommandComposerContainerV2.tsx:323-330`, `handleSubmit` stale); "Nova conversa" na paleta (`CommandPalette.tsx:68-70`) só zera o id e cai na tela de recovery.
- B4: Pulse sem recovery de run `running` após restart (`lib/pulse/store.ts:201-225`, `runner.ts:480/501`) e sem claim atômico (timer + manual = run duplo). `ProxyTimeout 300` do Apache corta `tasks/[id]/run` síncrono acima de 5 min com 502 falso.
- B5: restart do serviço deixa units `gaucho-studio-term-*`/`kernel-*` órfãs até `RuntimeMaxSec=8h`; `input()` pendente + Interromper trava a célula (`studio-kernel-bridge.py:99-123`); abort do SSE de `run` mata o run atual e não o da request (`run/route.ts:413-415`).
- B6: `process.exit(1)` no lock do SoundCase (`jobs.ts:144-147`) derruba o Next inteiro; TOCTOU entre `chatBackgroundJob.ts:681/721` e autosave do cliente pode perder mensagem; `settingsStore` não persiste (modelo/reasoning voltam ao default a cada reload — confirmar se era intenção).
- Cobertura zero: 23 rotas `app/api/studio/workspace/**`, `studio/assist`, 7 rotas `app/api/pulse/**`, `useRealtimeTtsLab`, `useStudioServerWorkspace`.

#### FRENTE candidata P — Layout e performance

- P1: nenhuma fonte é carregada (Space Grotesk/JetBrains Mono no chat, Lexend no Studio declaradas em CSS; sem `next/font`, sem `@fontsource` no cliente). Cada SO cai num fallback diferente.
- P2: zero `React.memo` em `components/` (balões re-renderizam e re-parseiam markdown a cada frame do stream); `CodeBlock.tsx` importa `Prism` com 594 gramáticas no chunk inicial (`PrismLight` + ~10 linguagens resolve); jsPDF estático via `useExport`; `prefetchOnIdle(SettingsDrawer)` é no-op.
- P3: ~300 linhas de tokens oklch mortos em `globals.css:133-518` sobrescritas pelo bloco Atmosphere; Studio com paleta e breakpoints próprios (1120/860/600 vs 768/1024); SoundCase sempre escuro com 121 cores hardcoded e fontes de 8-10px; `CodeBlock` sempre zinc/oneDark inclusive no Daybreak; overrides por seletor estrutural (`> div:first-child`, `.size-10`).
- P5 (relato de Anders 2026-09-04, mobile): SoundCase aparece três vezes no topo do chat — `ProductNav` compacto (md até 1360px) e completo (≥1360px) em `WorkspaceLayoutV2.tsx:315-316`, mais a aba "Som" da barra mobile (`WorkspaceLayoutV2.tsx:399-405`). Desejado: um único botão "Abrir SoundCase" no rail esquerdo acima de "Abrir Studio" (`ConversationRailV2.tsx:397` no modo compacto e `:570` no rodapé), e nada no topo. A paleta (`CommandPalette.tsx:108`) pode ficar.
- P4: arquivos de 900-1200 linhas — `StudioNotebook.tsx`, `useChat.ts`, `SettingsDrawer.tsx`, `PulsePanelV2.tsx`, `GauchoStudioShell.tsx`, `WorkspaceLayoutV2.tsx`.
- ✅ **B7 fechada em 2026-09-04** (Anders) (puxada como exceção durante a FRENTE H): `probeSoundCaseAudio` faz fallback por packets (`packet=pts_time,duration_time`, csv) quando o container devolve `N/A`; `ChunkPermanentError` carrega `cause`; `safeError` loga `[soundcase] generation failed` com `diagnosticId`, `code`, erro e causa. Testes: 2 em `audio.test.ts`, 1 em `worker.test.ts`. Validação real: chunk FLAC de 3.000 s do `gpt-4o-mini-tts` (container N/A → fallback = decode do ffmpeg); resume da versão `791709a7` avançou pelos chunks após restart. A versão `63e1bbbf` (mesmo texto) segue `failed` para Anders decidir (resume ou excluir). Correção: existe rota `resume` por versão, e a geração já é tarefa de servidor (`chatgpt-soundcase.path` + `.timer`), então das lacunas de produto restam capa por conteúdo e visual do chat. Histórico do relato:  "geração silenciosa" falha na aba de gerações; o realtime funciona. Evidência: duas versões `failed` com `soundcase_chunk_permanent_failure`, `progress 0/65`, chunk 0 morre na 1ª tentativa com erro não-retryable (4xx do provider ou validação flac/ffprobe). **Causa raiz confirmada em 2026-09-04 (reprodução real do chunk 0, 100% determinística):** a API responde 200 e o magic `fLaC` passa, mas o FLAC do `gpt-4o-mini-tts` vem sem `total_samples` no STREAMINFO, então o `ffprobe` de `audio.ts:82-111` (`stream=codec_name,duration:format=duration`) devolve `duration=N/A` → `soundcase_audio_probe_mismatch` → classificado como não-retryable → falha permanente em todo chunk, em toda versão. O teste unitário mascarou porque o mock devolve `duration: "1.5"` (`audio.test.ts:51`). Duração real é obtível por último packet (`-show_entries packet=pts_time,duration_time` → 2.208+0.010), por `-count_frames`, ou remuxando lossless com `ffmpeg -c:a flac` (STREAMINFO passa a ter 2.218). Correção sugerida: fallback no probe via packets (ou remux do chunk antes do probe) + `console.error` com `diagnosticId` e erro original em `worker.ts:154-162` (`safeError` hoje não loga nada). Não há rota de resume por versão em `app/api/soundcase/versions/*`. Voz `cedar` é aceita pelo modelo (descartado).
- Lacunas de produto no SoundCase (Anders, 2026-09-04): cada cartão deveria ter cabeçalho com imagem gerada a partir do conteúdo do áudio ("um Pulse de áudio"; `cover.ts` existe mas fica `pending`); a geração deveria ser tarefa agendada no servidor nos moldes do Pulse; visual deveria se aproximar do chat (hoje paleta própria sempre escura).

#### FRENTE candidata D — Drift de documentação (uma passada)

- SoundCase ausente de CLAUDE.md, AGENTS.md ("Visão Geral"/"Estado Atual") e README; Codestral primário não documentado (README, INFRASTRUCTURE.md, envs `CODESTRAL_API_KEY`/`MISTRAL_API_KEY`).
- AGENTS.md: três "Próximos Pontos" já resolvidos (rehypeRaw, auto-scroll, normalização de quebras); entradas de 20/08 e 03/09 prependadas acima do título; Notebook ainda descrito como "texto+PNG".
- API.md/ARCHITECTURE.md: Pulse aceita Sol além de Mini/Terra; listas de rate limit e rotas públicas do proxy incompletas; modelo forçado do modo Documento (`gpt-5.4-mini`) sem doc; Terra suporta modo `pro`.
- MODELS.md: marcar os 4 ocultos do seletor; 6 helpers exportados sem doc. INFRASTRUCTURE.md: envs `CALENDAR_DRAFT_MODEL`, `NEXT_PUBLIC_APP_VERSION`, `OPENAI_LOG`, `CHROME_PATH` e agora `PULSE_RUNNER_TOKEN` obrigatório.
- `apache-config/chat.conf` com allowlist que omite `studio/pulse/soundcase/memory` (vhost vivo usa ProxyPass genérico); `design-qa.md` descreve Studio TS/JS aposentado; `docs/superpowers*` guardam planos concluídos; `components/farol`, `lib/farol`, `app/api/farol/propose` são pastas vazias não rastreadas.

### PACK HISTÓRICO — Notebook modo Colab (2026-08-20)

Aprovado e concluído em 2026-08-20, quatro frentes num dia (plano em `/root/.claude/plans/pois-eu-tva-valiant-lovelace.md`):

1. **Rich outputs** ✅ — bridge amplia mimes para png/jpeg/svg/html/latex/markdown/plain com cap de 2 MB por mime (texto trunca com aviso, imagem descarta); seleção de view pura em `notebookOutputView.ts`; HTML/SVG sanitizados (DOMPurify direto como dep, `<style>` proibido) com CSS próprio para tabelas pandas; latex/markdown via `StudioMarkdownPreview`.
2. **UX de células** ✅ — Shift+Enter (executa e avança/cria), Alt+Enter (executa e insere abaixo), `moveNotebookCell` com botões ↑/↓, divisores hover de inserção, "Executar tudo"/"Executar acima" (dispatches serializados — POSTs paralelos chegavam fora de ordem, bug pego na validação), duração da última execução no gutter.
3. **Kernel robusto** ✅ — `input()` de ponta a ponta (`allow_stdin` + canal stdin do jupyter_client → evento `input_request` → campo inline → `POST notebook/input`; executes que chegam durante o input ficam em `pending_ops`); fila visível via evento `cell_started` (`[…]` → `[*]`); `MemoryMax` 1G→2G; ping SSE de 15 s solta stream de aba morta.
4. **Assistente nas células** ✅ — `POST /api/studio/assist` aceita `cell {intent fix|generate, source, error}` com instrução dedicada (responde um único bloco ```python); botão ✦ no gutter abre prompt inline com "Corrigir erro" quando há traceback; resposta streamada em preview e aplicada só com "Aplicar na célula" (`extractPythonCodeBlock`).

Evidência: 568 testes/112 arquivos (27 novos, red→green por frente), tsc/lint/build limpos, deploy com restart e health local/público 200, validação Playwright em produção 12/12 (tabela pandas HTML, PNG matplotlib, katex, traceback, input() respondido, fila, duração, mover célula, assistente corrigiu SyntaxError real). pandas+matplotlib instalados no venv da jail.

### PACK HISTÓRICO — Gaucho Studio v2: evolução do IDE

Contexto: em 2026-08-12/13 o Studio virou Python-only (modo Local TS/JS removido), ganhou splitters, console interativo com stdin (+ flush de prompt), token do workspace em sessionStorage e Ctrl+Enter — tudo entregue, validado e no ar (ver diário do AGENTS.md). Anders aprovou a fila seguinte, executada pelo trilho essential-workflows um bundle por vez:

1. **Terminal Fase 2 — PTY restrito** ✅ CONCLUÍDO 2026-08-13 (desenho fechado com Anders no mesmo dia): bash real na mesma jail systemd via `node-pty` → `systemd-run --pty` (spike validou 6/6 checks antes do plano: uid studio, /workspace, pip do venv, ProtectHome, TTY real, SIGWINCH). Entregue conforme o desenho: SSE p/ saída + POST p/ teclas (batch 16 ms) e resize (debounce); 1 sessão com idle-kill de 30 min + `RuntimeMaxSec=8h`; view alternável do workbench (botão topbar + Ctrl+`) com header de status e Encerrar/Nova sessão. Extensão útil além do desenho: alternar a view solta só o stream — a sessão sobrevive e o reabrir reanexa com replay de ~200 KiB (evita perder um `pip install` em andamento por um toggle acidental). TDD: 24 testes novos (manager, client controller, labels) — 495 total; smoke Playwright ao vivo em build de produção (id, pip, replay, encerrar, Ctrl+`); deploy + health local/público 200. Dependências fixadas: `node-pty@1.1.0`, `@xterm/xterm@6.0.0`, `@xterm/addon-fit@0.11.0`.
2. **Markdown preview** — ✅ CONCLUÍDO 2026-08-13: seletor `Código / Dividido / Preview` na linha de breadcrumbs quando o arquivo ativo é `.md` (default Dividido); `StudioMarkdownPreview.tsx` reusa `chatMarkdownComponents` (Mermaid/KaTeX/GFM) sem as heurísticas de chat; live-update; validado via TDD + smoke Playwright em prod e deployado (detalhes no diário do AGENTS.md).
3. **Aba Notebook (estilo Jupyter)** — ✅ CONCLUÍDO 2026-08-13: entregue conforme o desenho fechado. Abrir `.ipynb` troca a superfície do editor pela view de células (`StudioNotebook.tsx`): células code em Monaco python compacto (auto-altura, Ctrl+Enter executa, FIM com prefixo concatenando as células de código anteriores via `getLeadingContext` novo no autocompleteProvider) e markdown renderizadas com toggle de edição; outputs texto/stream/traceback/PNG inline; add/remover célula; header com status do kernel + Interromper/Reiniciar. Server: `studio-kernel-bridge.py` (helper `jupyter_client` fora da jail, JSON por stdin/stdout, validado vivo 8/8) + `studioNotebookKernel.ts` (unit `gaucho-studio-kernel-*` na jail, idle-kill 30 min, RuntimeMaxSec=8h, interrupt via SIGINT, varredura de connection files órfãos) + 4 rotas gated (`notebook/stream|execute|interrupt|shutdown`). Persistência nbformat v4.5 (`notebookFormat.ts`, parse/serialize + reducers). TDD: 41 testes novos (530 total); smoke Playwright em build de produção (estado entre células, PNG do matplotlib, outputs persistidos no arquivo, restart → NameError); deploy + health local/público 200. Decisões confirmadas: ipykernel real, `.ipynb` nbformat v4 e saída rica v1 limitada a texto + PNG.

Ordem: 2 (feita) → 1 (feita) → 3 (feita). PACK CONCLUÍDO em 2026-08-13 — sem bundle pendente; próxima frente a definir com Anders.

Quando uma frente complexa for ativada, registrar aqui somente o pack ativo e seus bundles aprovados. As entradas abaixo são histórico de implementação, não fila atual.

### 2026-06-24 12:45 - Capturas locais mostram texto completo apos gravar

Context:
Anders percebeu que as janelas/cards das capturas locais de notas ficavam truncadas depois de gravar, sem mostrar todo o conteudo salvo.

Details:
`components/workspace-v2/WorkspaceCapturesPanelV2.tsx` agora expande automaticamente a nota criada por gravacao de voz e permite expandir qualquer nota local longa, nao apenas `source: "stt"`. O corpo tambem ganhou `break-words` para evitar corte visual em textos sem espacos longos.

Notes:
Validacao executada: `git diff --check`, `npx tsc --noEmit`, `npm run build`, `systemctl restart chatgpt.service`, health local e publico em `/chat/api/health`.

### 2026-06-24 12:20 - Centro mais solto em desktop acima de 1490px

Context:
Anders pediu apenas uma folga extra no layout desktop largo, preservando a densidade atual até `1490px` e sem reabrir os painéis laterais.

Details:
`components/chat/ChatContainer.tsx` passou a expandir o trilho central de mensagens para `60rem` apenas em `min-[1490px]`. `components/chat/MessageBubble.tsx` abriu os baloes nesse mesmo breakpoint (`54rem` no assistente e `78%` no usuario), e `components/workspace-v2/WorkspaceLayoutV2.tsx` alinhou o composer para `58rem`. No `WelcomeScreen`, o grid de sugestoes deixou de alternar para `2xl:grid-cols-3`, mantendo o arranjo `2x3` para evitar cards estreitos no desktop largo.

Notes:
Validação desta rodada: `git diff --check`, `npx tsc --noEmit`, `npm run build`, `systemctl restart chatgpt.service`, health local e publico em `/chat/api/health`. Se ainda faltar sensação de respiro, o próximo passo natural é abrir também o `WelcomeScreen` desktop no mesmo breakpoint, sem mexer no mobile.

### 2026-06-24 02:22 - Cards mobile levemente menores e CTA Nova conversa focando composer

Context:
Anders aprovou a compactação geral, mas pediu uma passada ainda mais leve nos cards do mobile e deixou explícito que o botão `Nova conversa` do topo deve levar ao input da conversa atual, sem abrir outra conversa.

Details:
`components/chat/ChatContainer.tsx` reduziu discretamente os cards da faixa `Conversas`, o CTA `Painel contextual`, o hero `Olá, Anders`, os atalhos rápidos e o balão introdutório inferior. `components/workspace-v2/WorkspaceLayoutV2.tsx` manteve o `Nova conversa` no fluxo atual e endureceu o comportamento de UX: agora o handler faz `scrollIntoView` do composer antes de focar o `textarea`, reforçando o salto para o input da mesma conversa.

Notes:
Validação executada: `git diff --check`, `npx tsc --noEmit`, `npm run build`, `systemctl restart chatgpt.service`, health local/público `200` e smoke Playwright mobile confirmando `focusedTag: TEXTAREA` após clique em `Nova conversa`.

### 2026-06-24 02:05 - Compactacao visual do shell em zoom 100%

Context:
O layout novo estava visualmente bonito, mas com densidade grande demais em 100% de zoom, especialmente no mobile/narrow viewport e no composer inferior.

Details:
`app/globals.css` recebeu um ajuste fino dos tokens de densidade para reduzir alturas, gutters, larguras laterais e medidas do welcome/composer sem escalar a tipografia por viewport. `components/workspace-v2/WorkspaceLayoutV2.tsx` compactou header, subheader mobile, chips, busca, painel operacional e composer, incluindo textarea, botões de controle e barra inferior. `components/chat/ChatContainer.tsx` compactou os cards de conversas, o CTA do painel contextual, o hero `Olá, Anders` e os atalhos mobile para caber mais conteúdo útil na primeira dobra.

Notes:
Validacao desta rodada deve conferir desktop e viewport estreito, porque a intenção foi reduzir peso visual sem voltar a deixar touch targets desconfortáveis.

### 2026-06-22 16:30 - Deepsearch e Documento com reconciliacao resiliente

Context:
Anders queria reduzir perda de pesquisas longas em celular quando o navegador minimiza ou mata a aba, focando em Deepsearch/Documento e sem mexer em TTS/imagem.

Details:
Foi adicionada persistencia local de metadados de jobs em `data/chat-background-jobs.json`, com store server-side para upsert, sync, status terminal e poda. As rotas `/api/chat/background`, `/sync` e `/cancel` atualizam esse registro, e a nova `/api/chat/background/reconcile` recupera jobs pendentes por `response_id`, incluindo conversas antigas que ja tinham `backgroundJob.responseId` mas ainda nao tinham registro no store. `hooks/useChat.ts` chama a reconciliação ao abrir, ao voltar para aba visivel e ao carregar conversa com job pendente.

Notes:
Escopo deliberado: `document`, `deepsearch_medium`, `deepsearch_high`; sem timer novo, push notification ou background para chat default/imagem/TTS. O arquivo `data/chat-background-jobs.json` e runtime privado e fica ignorado pelo Git. Validar com testes focados, `npm test`, `npx tsc --noEmit`, `npm run build`, restart do `chatgpt.service` e health local/publico.

### 2026-06-20 17:50 - Pulse nativo substitui Agenda visivel

Context:
Anders decidiu abandonar a frente visivel de integracao Google Agenda/Gmail e criar um Pulse proprio do Gaucho Chat: rotinas recorrentes criadas por prompt, executadas automaticamente pelo servidor e exibidas em painel proprio.

Details:
Criados backend/API/storage do Pulse (`/api/pulse/*`, `data/pulse-tasks.json`, `data/pulse-runs.json`), interpretacao de prompt por Responses API com schema JSON, runner de tarefas vencidas e painel `PulsePanelV2` no lugar da aba Agenda. O runner versionado usa `systemd/chatgpt-pulse.service` + `systemd/chatgpt-pulse.timer` chamando `scripts/run-pulse-due.sh`; `/etc/apache2/APACHE.md`, `docs/API.md`, `docs/ARCHITECTURE.md` e `docs/INFRASTRUCTURE.md` foram atualizados.

Notes:
Google Calendar permanece no codigo como legado operacional, mas nao deve ser tratado como caminho ativo da experiencia. O Pulse visivel nao cria mensagens automaticas na conversa principal; resultados ficam em `Ultimas geracoes` no painel e reutilizam o TTS estavel `/api/tts` com `gpt-4o-mini-tts`. Realtime mini segue laboratorio separado e nao e o player padrao do Pulse.

### 2026-06-20 18:25 - Pulse usa modelo forte e contexto pessoal

Context:
Anders apontou que as execucoes Pulse precisam receber historico/preferencias como base para escrita e recomendacoes, e preferiu usar um modelo mais forte aproveitando o limite diario de tokens.

Details:
`lib/pulse/runner.ts` passou de `gpt-5.4-mini` para `gpt-5.4` como default, com reasoning `medium` e verbosity `high`. `lib/pulse/context.ts` monta o prompt de execucao com `buildSystemPrompt`, lendo `persona.json`, memorias ativas e trechos historicos via `searchMemoryContext` usando titulo/prompt da rotina.

Notes:
Manter `PULSE_RUN_MODEL` como override operacional, mas o default esperado para qualidade do Pulse e `gpt-5.4`. Nao remover o contexto pessoal do Pulse sem avisar Anders, porque ele impacta diretamente a curadoria e o tom das rotinas.

### 2026-06-14 00:41 - Citacoes inline redundantes limpas do texto

Context:
As respostas com web search podiam chegar com dominio/fonte escrito por extenso no corpo do texto e, ao mesmo tempo, com a bandeja oficial de `Referencias` no `MessageBubble`, criando redundancia visual.

Details:
`lib/artifacts/messageArtifacts.ts` ganhou limpeza defensiva de citacoes inline redundantes quando elas batem com `message.citations` (ex.: `(example.com)`, `[Fonte: example.com]` e linha isolada so com hostname conhecido). `components/chat/MessageContent.tsx`, `lib/chat/streamMachine.ts`, `lib/chat/responseToMessagePatch.ts`, `hooks/useChat.ts` e `lib/server/chatBackgroundJob.ts` passaram a aplicar esse saneamento no streaming, nas respostas completas e nos artefatos/documentos derivados. `lib/prompts/systemPrompt.ts` agora instrui o modelo a nao repetir dominio/URL cru no corpo quando as citacoes estruturadas ja existirem.

Notes:
Validacao executada: `npm test -- lib/artifacts/messageArtifacts.test.ts lib/chat/streamMachine.test.ts lib/chat/responseToMessagePatch.test.ts lib/formatting/chatMarkdown.test.ts`, `npx tsc --noEmit` e `npm run build`. Se a redundancia voltar em outra forma, revisar primeiro `cleanCitationMarkers(...)` antes de mexer no layout da bandeja de referencias.

### 2026-06-14 00:51 - Citacoes inline com indices numericos

Context:
Depois de remover dominios inline redundantes, Anders pediu um formato mais elegante: indices de referencia no corpo (`[1]`, `[2]`) em vez de parenteses vazios ou hostnames por extenso no final de cada paragrafo.

Details:
`lib/artifacts/messageArtifacts.ts` passou a converter marcadores OpenAI (`【1†...】`) e fontes inline redundantes em indices numericos no corpo, preservando a ordem das `message.citations`; fontes repetidas do mesmo host agora avancam conforme a ordem das URLs recebidas. Wrappers vazios como `()`, `([])` e `([1])` tambem foram tratados. `components/chat/MessageBubble.tsx` agora mostra o mesmo indice `[n]` em cada item da bandeja `Referencias`, alinhando corpo e lista. Testes ampliados em `lib/artifacts/messageArtifacts.test.ts`, com ajustes em `lib/chat/streamMachine.test.ts` e `lib/chat/responseToMessagePatch.test.ts`.

Notes:
Validacao executada: `npm test -- lib/artifacts/messageArtifacts.test.ts lib/chat/streamMachine.test.ts lib/chat/responseToMessagePatch.test.ts lib/formatting/chatMarkdown.test.ts`, `npx tsc --noEmit`, `npm run build`, `systemctl restart chatgpt.service` e health local/publico `healthy`. O primeiro `curl` pos-restart ainda pode falhar por janela curta antes da porta `3040` aceitar conexoes; revalidar apos `systemctl is-active`.

### 2026-06-11 17:46 - Shell mobile mais expansivo

Context:
Rodada focada em aproximar a sensação de app full-screen do workspace mobile sem redesenhar o produto nem mexer na lógica de PWA.

Details:
`components/workspace-v2/WorkspaceLayoutV2.tsx` foi ajustado para reduzir a moldura visual no mobile, afinar header/subheader, compactar controles do topo e deixar o sheet contextual direito full-bleed em telas pequenas. `app/globals.css` recebeu novos tokens mobile para diminuir padding externo, raio do shell e altura ocupada por header/composer.

Notes:
Validação executada: `git diff --check`, `npx tsc --noEmit`, `npm run build`, `systemctl restart chatgpt.service`, `curl http://127.0.0.1:3040/chat/api/health`. Se ainda faltar sensação de app, o próximo passo mais promissor é QA visual real em iPhone/Safari para micro-ajustar header e composer, não a camada PWA.

### 2026-06-11 18:02 - Settings full-screen no mobile

Context:
A foto do iPhone mostrou que, mesmo após o shell mobile ficar mais expansivo, o painel de Configurações ainda abria como drawer lateral estreito e deixava uma faixa do chat visível atrás.

Details:
`components/settings/SettingsDrawer.tsx` agora usa largura full-screen no mobile, sem borda lateral e sem sombra de drawer, mantendo o painel lateral compacto em `sm+`. O topo do painel foi afinado para ocupar menos altura e combinar com o shell mobile.

Notes:
Validação executada: `git diff --check`, `npx tsc --noEmit`, `npm run build`, `systemctl restart chatgpt.service`, health local `healthy` e health público HTTP 200. A barra/pílula do domínio no Safari ainda pertence ao navegador; esta rodada corrige a parte interna do app.

### 2026-06-17 17:12 - Memory tools visiveis ao modelo

Context:
Anders pediu duas tools para complementar a camada de memoria: uma para salvar memoria especifica quando ele pedir para lembrar, e outra para buscar mais dados no RAG quando ele pedir recuperacao de contexto.

Details:
`lib/server/chatRequest.ts` agora expoe `remember_memory` e `search_memory` como function tools apenas no `responseMode="default"`. `lib/openai/contextBuilder.ts` injeta a policy de uso das tools so no chat normal. `lib/server/memory/toolExecutor.ts` executa busca no indice LanceDB e cria memorias ativas em `memories.json`; `lib/server/chatToolOrchestrator.ts` roda ate duas rodadas de function calls antes de entregar a resposta final no fluxo streaming ou nao-streaming. `/etc/apache2/APACHE.md` documenta `/chat/api/memory/*`.

Notes:
Validacao desta rodada: testes focados das memory tools, `npx tsc --noEmit`, `npm test`, `npm run build`, ESLint focado nos arquivos tocados, `git diff --check`, `systemctl restart chatgpt.service` e health local/publico `healthy`. O primeiro health logo apos restart ainda pode falhar pela janela curta antes do Next reassumir a porta; rebater depois de alguns segundos.

### 2026-06-18 01:11 - Prompt principal visivel na Persona

Context:
Anders pediu para a area Persona mostrar tambem o conteudo do prompt principal usado no chat.

Details:
`components/settings/SettingsDrawer.tsx` passou a exibir uma previa somente leitura do `BASE_SYSTEM_PROMPT` junto com `FIXED_PERSONA_PROMPT` na aba Persona. A mesma aba ganhou o campo editavel `Regras customizadas`, conectado ao `customSystemInstructions` que ja era aceito por `/api/persona` e injetado em `lib/openai/contextBuilder.ts`. `hooks/useCustomInstructions.ts` ganhou `updateCustomSystemInstructions` para persistir esse campo pelo autosave existente.

Notes:
Validacao executada: `npx tsc --noEmit`, `npm test`, `git diff --check`, `npm run build`, `systemctl restart chatgpt.service` e health local/publico `healthy`. Nao houve alteracao em `/etc/apache2/APACHE.md`, pois a rota/proxy `/chat` ja estava documentada e nenhuma porta ou endpoint mudou.

### 2026-06-18 01:15 - Drifts de documentacao reduzidos

Context:
Anders pediu uma arrumada nos drifts dos docs depois das mudancas recentes de Persona, prompt principal e memory tools.

Details:
`README.md`, `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/MODELS.md`, `docs/README.md`, `CLAUDE.md` e o topo de `AGENTS.md` foram alinhados ao runtime atual: default `gpt-5.4-mini`, prompt principal visivel na Persona, `/api/memory/*`, RAG local em `data/memory-index`, memory tools `remember_memory`/`search_memory` apenas no modo default, `image_generation` apenas no modo default, `web_search_preview` em modos nao-quiz e `code_interpreter` opt-in.

Notes:
Validacao executada: buscas focadas de termos propensos a drift e `git diff --check` nos docs tocados. Nao houve mudanca de codigo nem de infra; `npm test`/build nao foram rerodados nesta rodada de documentacao, pois ja tinham passado na rodada imediatamente anterior e os arquivos tocados foram apenas markdown.

### 2026-06-20 22:31 - Cards Pulse expansíveis e exclusão rápida

Context:
Anders pediu para as rotinas criadas no Pulse ficarem em formato de card expansivel ao toque, com opcao clara de apagar cards.

Details:
`components/workspace-v2/PulsePanelV2.tsx` passou a renderizar cada rotina como card compacto clicavel/teclavel (`Enter`/espaco), com detalhe expandido contendo prompt e acoes de pausar/ativar e rodar agora. A exclusao ficou como icone no topo do card, com confirmacao nativa antes de chamar o delete existente da API.

Notes:
Validacao executada: `npx eslint components/workspace-v2/PulsePanelV2.tsx`, `npx tsc --noEmit`, `npm run build`, `git diff --check`, `systemctl restart chatgpt.service`, health local `healthy` e health publico HTTP 200. Nao houve mudanca de rota/API; `/etc/apache2/APACHE.md` foi apenas consultado para confirmar `/chat` em `3040`.

### 2026-06-20 22:38 - Pulse separado entre Atividade e Rotinas

Context:
Anders percebeu que os cards expansíveis tinham sido aplicados apenas às rotinas, mas as últimas gerações ainda ficavam misturadas na mesma aba Pulse.

Details:
`components/workspace-v2/PulsePanelV2.tsx` agora exporta também `PulseActivityPanelV2`, com feed de últimas gerações Pulse em cards expansíveis/recolhidos. `components/workspace-v2/ContextPanelV2.tsx` coloca esse feed no topo da aba Atividade e renomeia a aba Pulse para Rotinas, deixando a aba Rotinas focada em criação, pausa, execução manual e exclusão de rotinas. `components/command/CommandPalette.tsx` foi alinhado para "Ver Atividade" e "Ver Rotinas".

Notes:
Validacao executada: `npx eslint components/workspace-v2/PulsePanelV2.tsx components/workspace-v2/ContextPanelV2.tsx components/command/CommandPalette.tsx`, `npx tsc --noEmit`, `npm run build`, `git diff --check`, `systemctl restart chatgpt.service`, health local `healthy` e health publico HTTP 200. Nao houve mudanca de endpoint; `/etc/apache2/APACHE.md` foi consultado e ja documenta `/chat` na porta `3040` e `/chat/api/pulse/*`.

### 2026-06-21 14:37 - Exclusão de gerações Pulse

Context:
Anders apontou que, depois de mover as últimas gerações Pulse para a aba Atividade, faltava também um botão para apagar cada geração.

Details:
`lib/pulse/store.ts` ganhou `deletePulseRun`, `app/api/pulse/runs/[id]/route.ts` expõe `DELETE` autenticado para remover uma geração específica de `data/pulse-runs.json`, e `lib/pulse/pulseApi.ts` ganhou o client correspondente. `components/workspace-v2/PulsePanelV2.tsx` agora mostra lixeira nos cards de geração da aba Atividade, com confirmação antes de apagar. `docs/API.md` documenta a rota nova e `docs/ARCHITECTURE.md` foi alinhado ao split Atividade/Rotinas.

Notes:
Validacao executada: ESLint focado nos arquivos tocados, `npx tsc --noEmit`, `npm run build`, `git diff --check`, `systemctl restart chatgpt.service`, health local `healthy` e health publico HTTP 200. Smoke sem apagar dado real: UI da aba Atividade renderizou; como nao havia gerações reais no feed, a rota nova foi testada com ID inexistente autenticado e retornou `404 pulse_run_not_found`.

### 2026-06-21 14:47 - Pulse vira aba principal e Notas da rodada removida

Context:
Anders pediu para remover a secao antiga "Notas da rodada", ja substituida pela aba Notas com STT/capturas locais, e para renomear a aba principal Atividade para Pulse.

Details:
`components/workspace-v2/ContextPanelV2.tsx` removeu o editor "Notas da rodada" e deixou a aba principal mostrando apenas `PulseActivityPanelV2`. `stores/uiStore.ts` agora inicia o painel em `activity`, que visualmente aparece como `Pulse`. `components/workspace-v2/NotesProvider.tsx` passou a salvar textos enviados para notas diretamente em `/api/workspace-notes` quando o editor antigo nao existe, e `WorkspaceCapturesPanelV2` recarrega ao receber `gaucho:workspace-note-created`. Quick actions, toolbar de selecao e command palette agora mandam notas para a aba `Notas`.

Notes:
Validacao executada: busca focada por sobras visiveis de "Notas da rodada"/"Atividade", ESLint focado, `npx tsc --noEmit`, `npm run build`, `git diff --check`, `systemctl restart chatgpt.service`, health local `healthy` e health publico HTTP 200. Smoke Playwright confirmou `Pulse` selecionada por padrao, `Notas` e `Rotinas` presentes, `Notas da rodada` ausente e feed `Ultimas geracoes Pulse` renderizado.

### 2026-06-21 15:09 - TTS em FLAC como padrao experimental

Context:
Anders suspeitou que parte da aspereza do TTS vinha do codec MP3, nao do modelo, e preferiu priorizar qualidade de playback mesmo que o download completo ficasse secundario.

Details:
`lib/tts/speechText.ts` passou a normalizar `format` em `ttsPreferences`, com formatos permitidos `flac`, `mp3` e `wav`, e default `flac`. `app/api/tts/route.ts` agora repassa `response_format` conforme a preferencia e devolve o `Content-Type` correto. `hooks/useAssistantTts.ts` inclui o formato na cache key, envia `format` para `/api/tts` e permite download completo apenas em `mp3`, evitando concatenar chunks `wav`/`flac` como se fossem um unico arquivo valido. `components/settings/SettingsDrawer.tsx` ganhou seletor de formato na secao Voz.

Notes:
Validacao executada: testes focados de TTS/persona, `npm test`, `npx tsc --noEmit` e `npm run build` passaram. Proximo refinamento natural e fazer smoke auditivo A/B no navegador real; se `flac` nao melhorar ou der incompatibilidade em algum browser, testar `wav` no mesmo seletor.

### 2026-06-21 15:20 - Lembrete de push remoto pendente

Context:
Depois de limpar a worktree e comitar Pulse + TTS FLAC, Anders pediu deixar um lembrete para enviar ao remoto na proxima rodada.

Details:
Commit local criado: `b7cbb1a Add Pulse workflows and FLAC TTS`. `main` ficou a frente de `origin/main` e ainda nao foi enviado para GitHub.

Notes:
Proxima sessao deve comecar conferindo `git status --short --branch` e, se nada novo bloquear, rodar `git push origin main`.

### 2026-06-23 02:55 - Pulse incompleto por orçamento de tokens

Context:
Uma execução Pulse de "Resumo diário de IA e saúde" terminou como `incomplete` antes de produzir texto final.

Details:
Consulta read-only ao `response_id` salvo mostrou `incomplete_details.reason=max_output_tokens`, `output_tokens=4500`, `reasoning_tokens=4500` e `output_text_len=0`. O default do Pulse foi elevado de `4500` para `PULSE_MAX_OUTPUT_TOKENS=25000`, com clamp operacional por env, e o prompt agora pede curadoria de fontes/eixos para reduzir busca excessiva. `responseToMessagePatch` passou a preservar texto/imagem/citações parciais quando a API retorna `incomplete`, e a mensagem de erro agora diferencia esgotamento de tokens.

Notes:
Se voltar a acontecer, verificar `response.usage.output_tokens_details.reasoning_tokens` e considerar reduzir `reasoning.effort` do Pulse para `low` ou dividir rotinas muito amplas em duas rotinas menores. O runner agora imprime newline após cada JSON no log para facilitar auditoria.

### 2026-06-23 03:10 - Pulse rapido com prompt enxuto e fallback de imagem

Context:
No teste real, a rotina completou com texto e citacoes, mas sem imagem. Anders tambem preferiu testar `gpt-5.4` com reasoning mais baixo e mandar apenas instrucoes realmente uteis para reduzir latencia.

Details:
`lib/pulse/context.ts` deixou de reutilizar o prompt global completo do chat e passou a montar um prompt Pulse enxuto: regras da rotina, preferencias uteis, ate 5 memorias ativas compactadas e 3 trechos historicos compactos. `lib/pulse/runner.ts` ganhou `PULSE_REASONING_EFFORT`, com default `low`, sem `summary: detailed`, e fallback de imagem: quando a resposta principal completa sem `imageBase64`, o runner faz uma segunda chamada curta com `image_generation` para criar a capa do card.

Notes:
No primeiro teste, `minimal` falhou com `400 The following tools cannot be used with reasoning.effort 'minimal': image_gen, web_search.` Por isso, `none`/`minimal` sao coeridos para `low` no Pulse com tools. Se a imagem ainda falhar, investigar `image_generation_call` da resposta fallback antes de trocar para outro endpoint de imagem.

### 2026-06-23 03:32 - Pulse volta para 5.4 mini por latencia

Context:
O teste com `gpt-5.4`, prompt enxuto e reasoning `low` trouxe imagem e texto completos, mas ainda levou cerca de 186 s para a rotina diaria.

Details:
O default do Pulse voltou para `gpt-5.4-mini`, mantendo `PULSE_RUN_MODEL` como override operacional. O fluxo rapido atual permanece com reasoning `low`, prompt enxuto e fallback de imagem.

Notes:
Se Anders quiser comparar qualidade, usar `PULSE_RUN_MODEL=gpt-5.4` temporariamente no ambiente e comparar tempo/conteudo com a mesma rotina; o default operacional deve favorecer `gpt-5.4-mini`.

### 2026-06-23 14:17 - Push remoto pendente fechado

Context:
O backlog registrava que `main` estava a frente de `origin/main` e que a proxima rodada deveria conferir e enviar os commits ao GitHub.

Details:
`git status --short --branch` mostrou `main...origin/main [ahead 14]` com worktree limpa. O push foi executado para `origin main`, publicando ate o commit `c59bc9a Persist and reconcile background jobs`.

Notes:
Pendencia de push do commit `b7cbb1a Add Pulse workflows and FLAC TTS` e commits posteriores esta resolvida. Proxima frente deve partir de `main` sincronizado, salvo novas mudancas locais.

### 2026-06-23 14:38 - Correção do lint completo pós-push

Context:
O push acusou quebra no lint completo. A validação local inicial tinha coberto testes, typecheck e build, mas o `npm run lint` completo ainda tinha um erro em componente de Agenda.

Details:
`components/workspace-v2/AgendaPanelV2.tsx` deixou de sincronizar formulário com `setState` direto dentro de `useEffect`; o card agora reinicia pelo `key` com `draft.updatedAt`. O callback de descarte também recebeu `loadAgenda` nas dependências. `lib/server/chatBackgroundJobStore.test.ts` estabilizou o relógio do teste de ordenação de jobs pendentes para evitar empate no mesmo milissegundo.

Notes:
Validação executada: `npm run lint` passou com warnings antigos, `npx vitest run lib/server/chatBackgroundJobStore.test.ts`, `npm test`, `npx tsc --noEmit` e `npm run build` passaram.

### 2026-06-25 01:33 - Realtime mini promovido a motor principal local de leitura

Context:
Anders decidiu promover o Realtime a engine principal de leitura no app local/pessoal, sem remover o TTS clássico. A meta era trocar o papel do Realtime de experimento para motor padrão, manter o clássico como escape hatch manual e alinhar chat + Pulse pela mesma preferência global.

Details:
`types/index.ts` e `lib/tts/speechText.ts` passaram a persistir `ttsPreferences.engine` e `ttsPreferences.realtimeModel`, com defaults `realtime` e `gpt-realtime-mini`. `app/api/realtime/tts-call/route.ts` agora aceita seleção de modelo via query e mantém o shape GA atual da sessão (`type`, `output_modalities`, `audio.output.voice`). Foi criada a camada compartilhada `hooks/useMessageTts.ts`, combinando `useAssistantTts` e o novo `hooks/useRealtimeMessageTts.ts`; este último usa WebRTC por chunk, fila sequencial, seek aproximado por chunk e sem fallback automático para `/api/tts`. `components/chat/QuickActionsBar.tsx`, `components/chat/MessageTtsPlayer.tsx`, `components/workspace-v2/PulsePanelV2.tsx` e `components/settings/SettingsDrawer.tsx` foram alinhados para usar a mesma engine principal, com botão manual "Ouvir no clássico" quando o Realtime estiver como primário.

Notes:
Escopo deliberado: local/pessoal, sem voice agent full-duplex, sem microfone/VAD e sem migração imediata para `gpt-realtime-2`. O clássico continua sendo o único caminho de download consolidado. Próxima validação ideal é smoke auditivo real em `/chat` cobrindo resposta curta, longa e Pulse, para medir truncamento perceptível e estabilidade do autoplay no navegador do Anders.

### 2026-06-25 08:17 - Reversão para TTS clássico principal e Realtime opcional

Context:
Depois da tentativa de promover o Realtime a base de leitura, Anders preferiu voltar ao desenho anterior: TTS clássico como padrão, `Realtime mini` apenas como opção paralela no chat, e Pulse usando só o TTS normal.

Details:
`components/chat/QuickActionsBar.tsx` voltou para `useAssistantTts` como ação principal e `useRealtimeTtsLab` como botão opcional separado. `components/workspace-v2/PulsePanelV2.tsx` voltou a usar somente `useAssistantTts`. Foram removidas as preferências e abstrações criadas apenas para o Realtime principal (`ttsPreferences.engine`, `ttsPreferences.realtimeModel`, `useMessageTts`, `useRealtimeMessageTts`, `MessageTtsPlayer`) e a rota `/api/realtime/tts-call` voltou a fixar `gpt-realtime-mini` sem seleção de modelo por query. `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/MODELS.md` e `AGENTS.md` foram alinhados ao retorno desse comportamento.

Notes:
O recuo deixa o app de volta na separação que o Anders considera mais coerente hoje: Realtime para testes curtos e comparação; Speech API para leitura estável, longa e para o Pulse. Se houver uma nova investida no futuro, tratar Pulse como escopo separado desde o início deve reduzir retrabalho.

### 2026-06-25 08:39 - Realtime visivel como botao separado na barra

Context:
Após a reversão, o app ainda parecia mostrar só o botão único de alto-falante, deixando o Realtime pouco descobrível.

Details:
`components/chat/QuickActionsBar.tsx` passou a exibir o Realtime como botão/pill textual `Realtime` ao lado do alto-falante. A fileira de ações agora permite quebra de linha (`flex-wrap`) para o botão não desaparecer em superfícies estreitas. O botão principal continua usando `/api/tts`, e o Realtime segue como `useRealtimeTtsLab` opcional/experimental.

Notes:
Validação executada: `git diff --check`, `npx tsc --noEmit`, `npm run build`, `npm test`, `systemctl restart chatgpt.service`, health local e público em `/chat/api/health`.

### 2026-07-22 - Mini-player de audio unificado no chat e Pulse

Context:
Os controles de voz estavam duplicados entre a barra das mensagens, o player TTS expandido e os cards Pulse. O Realtime tambem aparecia como acao separada, aumentando a densidade visual.

Details:
`components/chat/MiniAudioPlayer.tsx` centraliza TTS padrao e Realtime 2.1 atras de um unico alto-falante, abre sem iniciar audio e interrompe a engine anterior ao trocar. `QuickActionsBar` e `PulsePanelV2` reutilizam o componente; configuracoes de voz esclarecem quais preferencias afetam cada engine. A sessao Realtime ganhou instrucoes de cadencia continua, e as vozes compartilhadas foram reconciliadas entre os dois caminhos.

Notes:
O TTS padrao continua selecionado ao abrir, preserva seek/progresso/download e o Realtime continua manual/experimental. Validacao: 80 arquivos/270 testes, TypeScript, build, `git diff --check`, restart, health local/publico e smoke Playwright desktop/mobile; abrir o player gerou zero requests de audio. O lint completo manteve uma falha pre-existente em `CommandComposerContainerV2.tsx:228`, fora deste diff.
