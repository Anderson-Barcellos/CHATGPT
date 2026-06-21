# BACKLOG

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
