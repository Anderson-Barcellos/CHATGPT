# BACKLOG

## Estado operacional

### PACK — Gaucho Studio v1 (active)

O bundle aprovado implementa o Studio como página autenticada separada em `/studio`, com Monaco, workspace local persistido, execução isolada em Web Worker e assistente contextual somente leitura. A frente também carrega a integração Mermaid no markdown, GPT-5.6 Terra no catálogo e refinamentos visuais preservados da árvore anterior.

Status atual: implementação e revalidação concluídas após revisão multiagêntica externa. A validação fresca passou com 92 arquivos/318 testes, TypeScript, lint, build, audit de produção, serviço, health local/público e smoke Chrome autenticado. O bundle permanece **pronto para revisão de Anders**, sem ser marcado como fechado até a confirmação dele.

Durante o smoke público, a CSP global do Apache bloqueou inicialmente o Worker `blob:` apesar da CSP correta do Next. O `<Location /chat>` foi alinhado à política do app sem mover `ProxyPassReverseCookiePath`; o replay autenticado no Chrome executou `Resultado: 42`, sem overflow ou `pageerror`.

A revisão multiagêntica encontrou quatro lacunas relevantes e elas foram tratadas antes da integração: o runner passou a ser servido por endpoint autenticado com CSP `connect-src 'none'`, token e orçamento de saída; streams SSE sem marcador terminal agora ficam interrompidos com conteúdo parcial preservado; a persistência ganhou limites, flush e fallback que prioriza os arquivos; a UI ganhou Stop, console associado ao arquivo executado e Explorer mobile. O exemplo inicial deixou de depender de import não suportado, com migração restrita ao conteúdo legado intocado.

Limites conscientes: o runner v1 executa somente o arquivo ativo e não resolve imports entre arquivos; autocomplete, aplicação de patches e modo agente não fazem parte deste bundle. O Monaco ainda registra dois warnings de fallback do language worker para o thread principal, sem erro funcional; configuração dedicada desse worker fica como endurecimento de performance futuro.

Próxima ação operacional: integrar a árvore validada em commits coerentes e enviar para `origin/main`, conforme decisão de Anders.

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
