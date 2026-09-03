### 2026-08-20 - Adicionado Gemini 3.7 Flash no catalogo do chat (substituindo 3.6)

Context:
Atualizacao do modelo Gemini disponivel no chat padrao para o Gemini 3.7 Flash (`gemini-3.7-flash`), com default de reasoning em high.

Details:
- `lib/server/geminiChat.ts`: constante `GEMINI_MODEL` atualizada para `gemini-3.7-flash`.
- `lib/models/modelConfig.ts`: catalogo `MODELS` atualizado para `gemini-3.7-flash` (Gemini 3.7 Flash, capabilities: chat/reasoning/vision, reasoning efforts `minimal`, `low`, `medium`, `high`).
- `stores/settingsStore.ts`: selecao de `gemini-3.7-flash` inicializa com default `reasoningEffort: "high"`.
- `app/api/chat/route.ts`: mensagens de validacao atualizadas para Gemini 3.7 Flash.
- `docs/MODELS.md`, `docs/ARCHITECTURE.md`, `docs/API.md`: documentacao alinhada.
- Testes Vitest (109 arquivos / 541 testes) passando 100%. Typecheck (`tsc --noEmit`) e `next build` concluidos sem erros.
- `chatgpt.service` reiniciado e respondendo `healthy` em `/chat/api/health`.

# AGENTS.md

> ⚠️ **INFRA — cookies e Apache (2026-07-11):** a diretiva `ProxyPassReverseCookiePath / /chat` deste app vive DENTRO do bloco `<Location /chat>` em `/etc/apache2/sites-available/ultrassom.ai-optimized.conf`. Ela já esteve solta no nível do vhost e reescrevia o `Path` dos cookies de TODOS os serviços do ultrassom.ai (quebrou a autenticação de imagens do Sonaris — 401). **Nunca mover essa diretiva pra fora do `<Location /chat>`**, e qualquer ajuste de cookie no Apache deve ficar escopado ao `<Location>` do serviço. Detalhes: `/etc/apache2/APACHE.md`, seção Proxy Settings.

## Visao Geral

Projeto de chat multimodal em `Next.js 16` com `React 19`, `TypeScript`, `Zustand` e `TanStack Query`, usando a `Responses API` da OpenAI.

Principais areas:

- `components/chat/*`: experiencia principal do chat, baloes, input, reasoning e export
- `components/workspace-v2/*`: shell atual do Gaucho Chat, rail de conversas, canvas central, composer e painel operacional
- `components/studio/*`: pagina Gaucho Studio Python com explorer, Monaco, run sandboxed, terminal PTY, notebook e chat contextual somente leitura
- `hooks/useChat.ts`: streaming, reasoning, citacoes, persistencia e fluxo de envio
- `lib/chat/useStreamingTextBuffer.ts`: buffer STT-style do texto do assistente
- `lib/models/modelConfig.ts`: catalogo de modelos e metadados usados no seletor
- `lib/openai/contextBuilder.ts`: montagem do prompt final com prompt base, persona fixa, ajustes, memórias e RAG
- `lib/server/chatRequest.ts`: montagem do request OpenAI, tools e defaults server-side
- `app/api/chat/route.ts`: proxy server-side para OpenAI
- `app/api/memory/*` e `lib/server/memory/*`: índice semântico, sugestões e memory tools
- `data/*.json`: persistencia local simples para conversas, memórias, persona, rascunhos e notas

## Estado Atual Do Projeto

- Modelo padrao atual do chat: `gpt-5.6-luna` com reasoning `low` e modo `standard`; `gpt-5.4-mini` permanece oculto para fluxos internos; `gemini-3.6-flash` e selecionavel como provider separado no chat padrao
- Shell ativo: `GauchoChatShellV2` / `WorkspaceFrameV2` — redesign completo (S0-S12)
- Página separada `/studio`: `GauchoStudioShell` Python-only sobre o workspace do servidor (sandbox systemd + step-up auth); console interativo com stdin (`run/stdin`, eco `command` no SSE, flush parcial de prompt em 150 ms); painéis redimensionáveis (`useStudioLayout`, `gaucho-studio:layout:v1`); preview de markdown em arquivos `.md` (`Código/Dividido/Preview`, `StudioMarkdownPreview` reusando o pipeline do chat, desde 2026-08-13); terminal PTY na jail (bash via `node-pty` + `systemd-run --pty`, xterm.js em view alternável do workbench com Ctrl+`, 1 sessão com idle-kill 30 min e reanexo com replay, desde 2026-08-13); notebook `.ipynb` (view de células no lugar do editor, ipykernel real na jail + helper `jupyter_client` fora dela, nbformat v4 com outputs texto+PNG persistidos, FIM ciente das células anteriores, 1 kernel com idle-kill 30 min, desde 2026-08-13); localStorage guarda só prefs/assistente (snapshot v2); modo Local TS/JS removido em 2026-08-12
- Sistema visual padrão: Atmosphere Glass — Midnight Glass no dark e Daybreak no light
- Tokens de cor Shadcn/`--gc-*` globais em `app/globals.css` para alcançar portals Radix; geometria e ambientação escopadas a `.gc-atmosphere-shell`
- Preview de artefatos via `ArtifactPreviewSheet`; painel lateral focado em atividade e notas
- Command palette cmd+k (`CommandPalette` + `cmdk`)
- Quick actions nos balões do assistente (`QuickActionsBar`)
- Toolbar de seleção de texto estilo Notion (`SelectionToolbar` + `useTextSelection`)
- Export dropdown com Markdown/JSON/PDF/Clipboard (`ExportDropdown` + `useExport`)
- NotesContext para bridge texto→notas (`NotesProvider`)
- Primitivos de animação framer-motion em `components/motion/`
- `MessageBubble` usa `motion.div` com `layout` (streaming suave); `AnimatePresence` no loop
- Chips do header conectados ao estado real (model, reasoning, responseMode)
- Aba Persona mostra prévia somente-leitura do prompt principal (`BASE_SYSTEM_PROMPT` + `FIXED_PERSONA_PROMPT`) e edita `contextAboutUser`, `customSystemInstructions` e `responsePreferences`
- Memory tools (`remember_memory`, `search_memory`) ativas apenas em `responseMode="default"`; document/deepsearch/quiz seguem sem essas tools
- Gemini 3.6 Flash usa Interactions API stateless com thinking `minimal|low|medium|high`, Google Search e URL Context; Documento/Deepsearch/Quiz continuam nos fluxos OpenAI
- Deepsearch/Documento devem seguir o protocolo de pesquisa profunda com neuro-storytelling estruturado: plano validado quando o pedido for aberto, fontes autoritativas, citacoes inline e prosa narrativa clara, sem tom gauchesco em conteudo de pesquisa
- `image_generation` ativa apenas no modo default; `web_search_preview` entra em modos não-quiz; `code_interpreter` é opt-in
- Breakpoints: `md=768`, `lg=1024 (sidebar)`, `xl=1280 (painel contextual)`
- Balões de assistente devem manter key estável por `message.id`; não incluir `artifact.id`
- `MessageStreamStatus`: `"streaming" | "completed" | "aborted" | "failed" | "interrupted"` — `aborted` = usuário cancelou, `interrupted` = conexão caiu/reload mid-stream, `failed` = erro de API

Nota de leitura: se houver conflito entre rodadas históricas antigas abaixo e este bloco de Estado Atual, trate este bloco como fonte mais recente antes de consultar os apêndices append-only.

## Ultimas Alteracoes Relevantes

### Rodada 1

- Adicao dos modelos `gpt-5.4` e `gpt-5.3-chat-latest`
- Troca do modelo padrao para `gpt-5.3-chat-latest`
- Atualizacao da documentacao principal de modelos/API/componentes

### Rodada 2

- Criado `components/ui/confirm-dialog.tsx`
- Acoes de editar/excluir em baloes ficaram mais descobriveis
- Exclusao de conversa ativa agora faz transicao para outra conversa ou cria uma nova
- Header do `ChatShell` passou a mostrar conversa ativa + modelo atual

### Rodada 3

- Criado `components/chat/ReasoningPanel.tsx`
- Criado `components/chat/ChatMarkdown.tsx` para elevar o rendering do reasoning
- `Message` agora possui `reasoningStatus` explicito
- `useChat.ts` passou a controlar reasoning como `thinking` -> `complete`

### Rodada 4

- Criado/polido `components/workspace-v2/*` como shell principal
- Criada aba `Canvas` em `ContextPanelV2`, padrao ao abrir o painel
- Corrigida rolagem da rail de conversas via viewport interno (`ScrollArea`, `min-h-0`, `flex-1`)
- Removido `dark` forcado do workspace v2; tema claro/escuro agora vem dos tokens CSS
- Atualizadas bolhas para `v2-user-bubble` e `v2-assistant-bubble`
- Estabilizada a key de `MessageBubble` para preservar o buffer durante `streaming -> completed -> artifact`

### Rodada 5 — Sprint 0 (Limpeza + Setup)

- Removido shell legado: `components/layout/`, `components/sidebar/`, `components/chat/InputArea.tsx`, `components/artifacts/ArtifactPanel.tsx`, `hooks/useSwipeGesture.ts`, `lib/layout/`
- Adicionadas dependencias: `framer-motion 12.38.0`, `cmdk 1.1.1`
- Tag de retorno: `pre-redesign-s0` em `9d36822`

### Rodada 6 — Sprints S1-S12 (Redesign Completo)

- **S1**: tokens `--gc-*` unificados, light/dark completos
- **S2**: escala tipográfica + escala animação + primitivos `components/motion/` (FadeIn/SlideIn/Pop/Drawer)
- **S3**: `useIsMobile` + `lib/layout/breakpoints.ts`
- **S4**: `uiStore` expandido (canvas state, activeSelection, activePanelTab) + `NotesProvider`
- **S5**: `CanvasOverlayV2` draggable/resizable (framer-motion); mobile = Sheet full-screen
- **S6**: `SelectionToolbar` + `useTextSelection` (toolbar de seleção estilo Notion)
- **S7**: `CommandPalette` + `CommandPaletteProvider` (cmd+k via cmdk)
- **S8**: `MonacoCodeBlock` lazy-loaded com sync de tema `gc-dark`/`gc-light`
- **S9**: `QuickActionsBar` nos balões do assistente com regenerate conectado
- **S10**: `ExportDropdown` com slot `exportControl`; removido `window.print()`
- **S11**: touch targets 44px, safe-areas `.gc-safe-*`, chips dinâmicos, badge artefatos mobile
- **S12**: `MessageBubble` com `motion.div layout`; `AnimatePresence` no loop; edge case guards

### Rodada 7 — Persistência Incremental durante Streaming

- `MessageStreamStatus` ganhou valor `"interrupted"` (distinto de `"aborted"` = stop pelo usuário e `"failed"` = erro de API)
- `useChat.ts` implementa 5 anéis defensivos: flush síncrono antes do fetch, auto-save throttled a cada 2 s durante o stream, listener `beforeunload`/`pagehide` com `navigator.sendBeacon` (fallback `fetch keepalive`), normalização de mensagens `"streaming"` → `"interrupted"` na carga, e repasse de `signal: request.signal` ao SDK upstream
- `app/api/chat/route.ts`: `signal: request.signal` repassado ao `openai.responses.create()`; stream encerra junto com o cliente quando ele desconecta (economia real de tokens); retorna HTTP 499 em AbortError
- `/api/conversations/[id]` aceita agora `POST` além de `PUT` — necessário porque `navigator.sendBeacon` só envia POST
- `lib/performance/throttle.ts`: util imperativo `createThrottle<T>` com `{ call, flush, cancel }`; reusável fora do contexto React
- `lib/storage/conversations.ts`: `saveConversationMessagesViaBeacon(id, messages)` — salva via Beacon com fallback fetch keepalive; retorna boolean
- `lib/chat/abortCompletion.ts`: constante `INTERRUPTED_GENERATION_MESSAGE` + `buildInterruptedAssistantMessagePatch`
- `MessageContent`: banner laranja (`AlertTriangle`) "Resposta interrompida — pode regenerar pra completar." quando `streamStatus === "interrupted"`
- `QuickActionsBar`: botão Regenerar visível também em `streamStatus === "interrupted"`
- `ContextPanelV2`: `aborted | interrupted` agrupados em status `"warning"`; labels distintos por valor

### Rodada 8 — Ajuste de catalogo de modelos

- Removido `gpt-5.3-chat-latest` e `gpt-5.4` do catalogo
- Adicionado `chat-latest` (GPT-5.5 Instant) como novo modelo padrao — alias rapido da serie GPT-5
- `DEFAULT_MODEL` trocado para `chat-latest` em `stores/settingsStore.ts` e `app/api/chat/route.ts`
- Demais modelos mantidos: `gpt-5.5`, `gpt-5.4-mini`, `gpt-5.1`, `gpt-4.1`, `o3`, `gpt-image-2.0`, `dall-e-3`

## Proximos Pontos De Atencao

### Alta prioridade

- Revisar o markdown das mensagens do chat com foco em `\\n` literal, `/n` indevido e consistencia entre renderizadores
- Decidir se vamos unificar de vez `MessageContent` com `ChatMarkdown`
- Revisar `rehypeRaw` no fluxo principal de markdown e endurecer a estrategia de renderizacao
- Melhorar o auto-scroll durante streaming para nao puxar a leitura enquanto o usuario esta acima
- Se o Canvas evoluir para editor real, definir antes contrato de edicao/autosave para nao misturar estado visual com persistencia de mensagens

### Lembrete explicito

O markdown das mensagens ainda precisa de uma passada dedicada. Isso ficou conscientemente para depois desta rodada. Quando retomarmos:

1. normalizar quebras de linha antes do render
2. revisar renderer unico para mensagem + reasoning
3. decidir o tratamento final de HTML bruto

## Processo Operacional Do Agente

### Checklist operacional vivo

Quando a tarefa tiver mais de uma etapa real, usar o checklist/plano visivel como painel operacional da sessao.

- Criar checklist apenas quando houver trabalho multi-etapa.
- Manter no maximo um item `in_progress`.
- Marcar `completed` assim que a etapa terminar, nao apenas no final.
- Adicionar ou ajustar itens quando uma subtarefa real surgir e mudar o trabalho.
- Antes da resposta final, conferir se o checklist reflete o que realmente aconteceu.

### Escada de validacao

Escolher validacao proporcional ao tipo de mudanca:

- Documentacao/processo: `git diff --check`.
- TypeScript, libs ou rotas sem UI: teste focado e `npx tsc --noEmit`.
- Fluxo principal, API ou storage: teste focado, `npm test`, `npx tsc --noEmit` e `npm run build`.
- Visual/frontend: validacao anterior e smoke/screenshot em browser quando viavel.
- Servico ou rota publica: consultar `/etc/apache2/APACHE.md`, reiniciar o servico aplicavel e checar health local/publico.

Se uma validacao ampla for pulada por motivo razoavel, registrar explicitamente no fechamento.

### Dados runtime privados

Arquivos como `data/conversations.json`, `data/persona.json`, `data/google-calendar-token.json`, `data/calendar-event-drafts.json` e `data/workspace-notes.json` sao dados runtime do Anders.

Nao modificar, limpar, resetar, formatar ou usar como fixture de teste salvo pedido explicito ou necessidade inevitavel. Para smoke tests, preferir mocks, rotas sem cookie, fixtures temporarias com cleanup garantido ou ambiente isolado.

### Smoke tests com efeitos persistentes

Quando um smoke real puder criar dados persistidos, evento externo, nota, conversa, rascunho ou arquivo:

- Preferir teste sem efeito persistente quando suficiente.
- Se o smoke persistente for necessario, criar dado claramente temporario e remove-lo na mesma rodada.
- Se nao houver endpoint seguro de cleanup, nao criar dado real sem avisar; validar por teste automatizado/mocked e registrar a limitacao.

### Tooling

- Usar `rg` ou `rg --files` antes de buscas lentas.
- Usar leitura paralela apenas para comandos independentes de inspecao (`sed`, `rg`, `git status`, `git diff`, `ls`).
- Nao rodar comandos mutantes em paralelo.
- Para edicoes manuais, usar `apply_patch`.
- Antes de editar arquivo existente, ler o trecho relevante na sessao.
- Nao usar comandos destrutivos (`git reset`, `checkout --`, remocao ampla) sem pedido explicito.

### Documentos vivos vs memoria operacional

- Documento vivo de frente/ROADPACK: atualizado durante o processo, com status atual.
- `AGENTS.md`: atualizado ao fim de rodada significativa, como memoria operacional append-only.
- Kickoff antigo deve ser marcado como historico quando nao representar mais o estado atual.
- Se uma frente tiver bundles, sempre manter um documento vivo de progresso ou indicar claramente qual documento cumpre esse papel.

### Compatibilidade de instrucoes

Quando uma regra local entrar em tensao com regras superiores do ambiente, seguir a regra superior e explicar de forma breve a limitacao pratica. O objetivo e preservar a intencao do Anders no maximo permitido, sem fingir que uma acao foi feita quando nao foi.

### Subagentes

Usar subagentes somente quando Anders pedir explicitamente ou quando houver autorizacao clara para trabalho paralelo. Subagentes devem ser preferencialmente read-only/scouting ou donos de um modulo isolado. O agente principal integra, valida e decide.

### Fechamento

Ao final de trabalho multi-etapa:

- Confirmar que o checklist visivel foi atualizado.
- Resumir arquivos/areas tocadas.
- Informar validacoes executadas e resultado.
- Informar validacoes nao executadas e por que.
- Distinguir mudanca implementada, smoke real e revisao pendente do Anders.

### Implementar sempre com efeito externo seguro

Implementar sempre nao significa criar efeito externo irreversivel. Quando a acao puder persistir dado real, chamar API externa, apagar dados ou mudar servico publico, implementar o caminho seguro: rascunho, mock, teste sem efeito, backup ou confirmacao explicita.

### Pesquisa profunda e Deepsearch

Usar o protocolo de pesquisa profunda quando Anders pedir `deep research`, `deep dive`, `pesquisa profunda`, `investigacao a fundo`, relatorio amplo, explicacao tecnico-cientifica extensa ou cobertura completa de um tema. Nao usar para fato unico, definicao curta ou conversa casual.

Quando o pedido for curto ou aberto, primeiro construir um delineamento de especialista e validar com Anders antes de pesquisar: eixos tematicos, subperguntas, historico, estado da arte, debates, implicacoes praticas e pontos que um especialista nao deixaria passar. Se Anders ja trouxer um briefing detalhado, seguir direto para a pesquisa.

Preferir fontes primarias e autoritativas: artigos revisados por pares, revisoes sistematicas, orgaos oficiais, standards, documentacao primaria e consensos tecnicos. Para medicina, ciencia e tecnologia, cruzar alegacoes importantes em mais de uma fonte independente e explicitar incertezas ou divergencias reais. Blogs, opinioes e sites comerciais so entram quando o proprio tema exigir percepcao de usuarios/mercado ou quando nao houver fonte melhor.

Escrever como tutor narrativo: abrir com uma introducao antes dos subtitulos, usar `###` com subtitulos tematicos criativos, paragrafos curtos, voz ativa, analogias concretas logo apos conceitos dificeis e perguntas reflexivas pequenas para ajudar retencao. Usar **negrito** apenas na primeira aparicao de termos-chave. Evitar listas verticais no corpo do relatorio; usar tabelas apenas quando linhas e colunas realmente carregarem comparacao util.

Citacoes devem aparecer inline, em Markdown natural, logo apos a frase sustentada pela fonte. Nao criar secao final de referencias quando a resposta ja tem citacoes inline. Em pesquisas e relatorios, nao aplicar o tom gauchesco: a persona calorosa pode permanecer na conversa com Anders, mas o texto investigativo deve ser tecnico, claro e universal.

Se o relatorio passar de cerca de seis secoes tematicas ou Anders pedir formato exportavel, preferir gerar arquivo Markdown; oferecer PDF profissional quando houver caminho seguro no projeto para produzir o documento.

## Validacao Antes De Fechar Trabalho

Rodar, quando fizer sentido:

- `npm run build`
- `npx tsc --noEmit`
- `npm run lint` se a rodada exigir validacao mais ampla

## Observacoes Operacionais

- O repo remoto atual e `origin -> https://github.com/Anderson-Barcellos/CHATGPT.git`
- O branch principal rastreado e `main`
- Evitar sobrescrever mudancas locais nao relacionadas sem confirmar antes
- O painel operacional usa a aba principal `Pulse` para o feed de geracoes e a aba `Rotinas` para criar/pausar/executar/excluir recorrencias. Google Calendar pode permanecer no codigo como legado, mas novos fluxos recorrentes devem usar `/api/pulse/*`, `data/pulse-tasks.json`, `data/pulse-runs.json` e `chatgpt-pulse.timer`.
- Chat e Pulse usam o mesmo `MiniAudioPlayer`, aberto por um unico alto-falante e iniciado em `/api/tts` via `useAssistantTts` (`gpt-4o-mini-tts`). `Realtime 2.1 mini` (`gpt-realtime-2.1-mini`) e uma selecao manual dentro do player, sem `max_output_tokens` explicito; abrir o player nao inicia nem cobra nenhuma engine.
- Execucoes do Pulse usam contexto pessoal enxuto, nao o prompt global completo. Cada rotina escolhe `gpt-5.4-mini` (default), `gpt-5.6-sol` ou `gpt-5.6-terra`, todos com reasoning `medium` e verbosity `high`; modelo/effort efetivos ficam gravados no run. `PULSE_RUN_MODEL`, `PULSE_MAX_OUTPUT_TOKENS` e `PULSE_REASONING_EFFORT` permanecem overrides operacionais. Com tools, `none` e `minimal` sobem para `low`. Se a resposta principal nao trouxer imagem, o runner tenta fallback curto com o mesmo modelo efetivo.

## Preferencia De Comunicacao

- Em tarefas com varias etapas, enviar check-ins curtos entre etapas principais (etapa atual, achado rapido e proximo passo)
- Quando houver checklist/plano visivel da sessao, atualizar o status das tarefas ao longo do processo: marcar `in_progress` ao iniciar uma etapa, `completed` assim que ela terminar e adicionar/ajustar itens se uma subtarefa real surgir. Nao deixar para marcar tudo apenas no fechamento.

### 2026-05-09 18:24 - Escala menor nas citacoes do MessageBubble

Context:
Ajuste visual cirurgico apenas no bloco de citacoes das mensagens para reduzir a percepcao de fonte grande nos chips de fontes.

Details:
`components/chat/MessageBubble.tsx` teve reducao local na tipografia das citacoes (`9px` mobile / `10px` md), espacamento mais compacto e icones `Globe`/`ExternalLink` menores. Nenhum outro componente foi redesenhado nesta rodada.

Notes:
Se esse bloco voltar a parecer grande demais, continuar afinando dentro do proprio `MessageBubble` antes de mexer na escala global `text-nano`.

### 2026-05-11 23:25 - Geração de imagem com modelo novo + placeholder durante stream

Context:
O fluxo de imagem do chat estava sem feedback visual entre o início da `image_generation` e a chegada da primeira imagem, e o backend não fixava explicitamente o modelo GPT Image mais novo.

Details:
`app/api/chat/route.ts` passou a configurar a tool `image_generation` com `model: gpt-image-2`, `quality: "high"`, `size: "auto"`, `output_format: "png"` e `partial_images: 2` para antecipar previews no próprio streaming. `components/chat/MessageContent.tsx` ganhou um estado visual de “Gerando imagem” antes da primeira preview e um badge de “Refinando imagem...” enquanto a imagem parcial/final ainda está sendo atualizada. `components/chat/MessageContent.test.tsx` cobre o placeholder; validação desta rodada: `npm test`, `npx tsc --noEmit`, `npm run build`.

Notes:
O catálogo local de modelos de imagem continua desatualizado em relação ao uso real da tool; quando retomarmos esse tema, alinhar `docs/MODELS.md` e `lib/models/modelConfig.ts` ao naming atual da OpenAI evita confusão entre o catálogo legado e o modelo efetivo da tool.

### 2026-05-11 23:34 - Qualidade e tamanho de imagem conectados ao request real

Context:
As opções de `imageQuality` e `imageSize` já existiam no estado/UI, mas ainda não chegavam ao backend. Na prática, o app seguia sempre em `quality: "high"` e `size: "auto"` fixos, independentemente do que fosse escolhido no drawer.

Details:
`hooks/useChat.ts` passou a enviar `imageQuality` e `imageSize` junto do payload para `/api/chat`. `app/api/chat/route.ts` agora aceita esses campos e os repassa para a tool `image_generation`, mantendo `gpt-image-2` como modelo padrão e `high` como fallback quando nenhuma qualidade é enviada. Validação desta rodada: `npm test`, `npx tsc --noEmit`, `npm run build`.

Notes:
Se o drawer continuar escondendo esses controles em fluxos comuns por causa do `activeMode`, lembrar que o wiring backend já está pronto; o que pode faltar no futuro é só tornar a troca mais descoberta no shell/composer.

### 2026-05-12 14:33 - APIs tolerantes a ausência de OPENAI_API_KEY em build

Context:
A build podia quebrar na avaliação de módulo quando `/api/chat` ou `/api/transcribe` instanciavam o cliente OpenAI sem `OPENAI_API_KEY` disponível.

Details:
`app/api/chat/route.ts` e `app/api/transcribe/route.ts` passaram a criar o cliente OpenAI dentro do handler, com guarda explícita que retorna HTTP 503 quando a chave não existe. `.env.example` documenta `OPENAI_API_KEY=` sem expor segredo.

Notes:
Manter o cliente OpenAI lazy dentro das rotas para permitir build/local checks sem chave real. Nunca commitar chave em `.env`; apenas `.env.example` deve ser versionado.

### 2026-05-12 16:16 - Remoção de binários de fonte e placeholders documentados

Context:
Para evitar push/PR com binários pesados de fontes, os `.ttf` versionados foram removidos.

Details:
`app/layout.tsx` deixou de depender de `next/font/local`; `app/globals.css` define stacks padrão para `--font-geist-sans` e `--font-geist-mono`. `public/fonts/.gitkeep` preserva a pasta, e `docs/LOCAL_FONTS.md` explica como adicionar fontes localmente quando necessário.

Notes:
Build/test/tsc passam sem fontes binárias no repo. Se alguém quiser fontes locais determinísticas, adicionar manualmente conforme `docs/LOCAL_FONTS.md`.

### 2026-05-14 00:12 - Exportação PDF A4 server-side para documentos

Context:
A exportação PDF dos documentos A4 estava dependente de `html2canvas/jsPDF` no cliente, o que era frágil para o preview real com scroll/iframe e ficava distante do comportamento de PDF estilo Deep Research.

Details:
`lib/export/documentPdf.ts` agora chama `apiUrl("/api/artifacts/pdf")` e baixa o blob retornado. A rota `app/api/artifacts/pdf/route.ts` valida auth e artefato de documento, respeita limite de 5 MB e usa `lib/server/documentArtifactPdf.ts` para renderizar PDF A4 via Playwright/Chrome server-side, com JavaScript desativado e CSS printável. Foi adicionada a dependência `rehype-stringify` para renderizar markdown via pipeline `unified/remark/rehype`, evitando `react-dom/server` em App Route.

Notes:
Validação desta rodada: `npm test`, `npx tsc --noEmit`, `npm run build`, `systemctl restart chatgpt.service` e chamada real local em `/chat/api/artifacts/pdf` retornando `200 application/pdf`; `pdfinfo` confirmou página A4 e JavaScript ausente. O Chrome usado no host é `/usr/bin/google-chrome-stable` quando o browser cacheado do Playwright não existe.

### 2026-05-14 00:18 - Polimento visual do PDF A4 de documentos

Context:
Depois da migração da exportação PDF para renderização server-side, o template precisava ficar mais próximo de um documento final estilo Deep Research, não apenas uma página A4 funcional.

Details:
`lib/server/documentArtifactPdf.ts` ganhou cabeçalho visual com marca discreta Gaucho Chat, faixa superior, grid de metadados, melhor tratamento de blockquotes, tabelas zebrada, URLs impressas depois de links HTTP e rodapé Playwright com paginação `Pagina X de Y`. `lib/server/documentArtifactPdf.test.ts` cobre o shell visual e garante que HTML ativo continue sendo removido antes do PDF.

Notes:
Validação desta rodada: `npm test`, `npx tsc --noEmit`, `npm run build`, `systemctl restart chatgpt.service` e geração real de PDF em `/chat/api/artifacts/pdf`; `pdfinfo` confirmou PDF A4 de 3 páginas e `pdftotext` confirmou `Gaucho Chat`, URLs impressas e rodapé `Pagina 1 de 3`.

### 2026-05-20 12:45 - TTS nas respostas do assistente

Context:
Adicionado recurso pessoal de leitura em voz alta para respostas do assistente, com player compacto anexado abaixo dos ícones do balão.

Details:
`components/chat/QuickActionsBar.tsx` ganhou botão de alto-falante e player com play/pause, parar e saltos de 15s. `hooks/useAssistantTts.ts` faz cache em memória por mensagem/configuração e toca chunks sequenciais. `app/api/tts/route.ts` usa OpenAI Speech API com `gpt-4o-mini-tts`; `lib/tts/speechText.ts` centraliza vozes, defaults, sanitização e chunking seguro. Preferências de voz persistem via `ttsPreferences` em `/api/persona` e aparecem na aba Tuning do `SettingsDrawer`. `/etc/apache2/APACHE.md` foi atualizado com `/chat/api/tts`.

Notes:
Validação desta rodada: `npm test`, `npx tsc --noEmit`, `npm run build`. O limite prático usa chunking abaixo de 4096 caracteres por chamada, com margem; a doc do modelo também cita 2000 input tokens, então evitar aumentar `TTS_SAFE_INPUT_LIMIT` sem teste real.

### 2026-05-20 13:01 - TTS Turbo Queue

Context:
O primeiro TTS funcional ainda gerava chunks em série, o que deixava a experiência lenta em respostas longas.

Details:
`lib/tts/speechText.ts` ganhou perfis `balanced` e `turbo`; `turbo` usa primeiro chunk menor e concorrência 4. `ttsPreferences.mode` passou a ser persistido em `/api/persona` e aparece na seção Voz do Settings. `hooks/useAssistantTts.ts` agora prioriza o primeiro chunk e gera os demais em paralelo com ordem preservada, abortando requests em andamento no stop.

Notes:
Validação desta rodada: `npm test`, `npx tsc --noEmit`, `npm run build`. Se ainda houver gap perceptível entre partes, o próximo refinamento é Web Audio API/AudioContext para agendar buffers contínuos; não migrar direto para Realtime antes de comparar latência real do turbo.

### 2026-05-20 13:26 - Realtime mini TTS Lab

Context:
Criado módulo experimental isolado para comparar latência de leitura por `gpt-realtime-mini` contra o TTS padrão/turbo.

Details:
`app/api/realtime/tts-call/route.ts` recebe SDP do navegador e cria chamada server-side em `/v1/realtime/calls`, mantendo `OPENAI_API_KEY` fora do cliente. `hooks/useRealtimeTtsLab.ts` abre `RTCPeerConnection`, recebe áudio remoto e envia `response.create` out-of-band para ler o texto da mensagem. `components/chat/QuickActionsBar.tsx` mostra botão `Realtime mini` dentro do player de TTS, sem substituir o botão normal. Vozes incompatíveis com Realtime são normalizadas para `marin`.

Notes:
Este módulo é laboratório: sem cache, sem seek e sem substituir `gpt-4o-mini-tts`. Validar manualmente latência e fidelidade verbatim antes de promover para fluxo principal. `/etc/apache2/APACHE.md` inclui `/chat/api/realtime/tts-call`.

### 2026-05-20 18:27 - TTS libera áudio bloqueado pelo navegador

Context:
O player de voz podia cair em erro "Não consegui iniciar o áudio no navegador" porque o MP3 só chegava depois do clique inicial, fora do gesto aceito pelas políticas de autoplay.

Details:
`lib/tts/browserAudio.ts` adiciona um prime silencioso curto para aquecer o elemento `<audio>` dentro do clique do usuário. `hooks/useAssistantTts.ts` usa esse prime antes de gerar clips e, se o browser ainda bloquear, deixa o clip pronto em pausa para o próximo toque em vez de marcar erro fatal. `hooks/useRealtimeTtsLab.ts` usa o mesmo prime no áudio WebRTC e reporta bloqueio de autoplay como tentativa manual necessária.

Notes:
Validação desta rodada: `npm test`, `npx tsc --noEmit`, `npm run build`, `systemctl restart chatgpt.service` e health local em `/chat/api/health`. Ainda precisa de teste manual no navegador real do Anders, porque política de autoplay varia por browser/dispositivo.

### 2026-05-20 18:41 - Debug front/console + hardening cross-browser de áudio

Context:
Mesmo com `/api/tts` funcional, persistia relato de falha para iniciar áudio no navegador real. Precisávamos validar no front e console com automação e reforçar compatibilidade.

Details:
Diagnóstico com Playwright em `http://127.0.0.1:3040/chat`: envio real de mensagem, clique em `Ler em voz alta`, respostas `200` em `/chat/api/tts` e sem erro de autoplay no console (apenas warnings KaTeX já existentes). Foram aplicadas melhorias em `hooks/useAssistantTts.ts` e `hooks/useRealtimeTtsLab.ts`: elemento `<audio>` agora é criado no DOM com `playsinline`, mantendo o prime silencioso antes da reprodução. `lib/tts/browserAudio.ts` ganhou `describeAudioPlayError()` para exibir motivo real (`NotAllowedError`, `NotSupportedError` etc.) em vez de mensagem genérica.

Notes:
Validação desta rodada: `npm test`, `npx tsc --noEmit`, `npm run build`, `systemctl restart chatgpt.service`, health `healthy` em `/chat/api/health` e replay Playwright com `--autoplay-policy=user-gesture-required` mostrando player ativo (`Pausar`).

### 2026-05-21 11:25 - Recuperacao do chatgpt.service apos saida limpa

Context:
O Gaucho Chat caiu porque `chatgpt.service` estava `inactive (dead)` desde 2026-05-21 09:31, com `status=0/SUCCESS`. A porta 3040 estava sem listener e `/chat/api/health` recusava conexao.

Details:
O servico foi iniciado manualmente e voltou healthy. A unit `/etc/systemd/system/chatgpt.service` usava `Restart=on-failure`; como a saida foi limpa, o systemd nao religou. A politica foi alterada para `Restart=always`, seguida de `systemctl daemon-reload` e `systemctl restart chatgpt.service`.

Notes:
Validacao desta rodada: `systemctl is-active chatgpt.service` retornou `active`, `systemctl status` mostrou `npm start` + `next-server (v16.1.6)`, health local em `http://127.0.0.1:3040/chat/api/health` retornou `healthy` e health publico em `https://ultrassom.ai/chat/api/health` retornou HTTP 200.

### 2026-05-24 19:40 - Auditoria fechada com correcoes de persistencia e alinhamento de runtime

Context:
Depois da varredura geral, priorizamos correcoes reais de funcionamento em vez de mexer no renderer HTML de artifacts, que ficou explicitamente aceito como risco para uso pessoal do Anders.

Details:
`hooks/useCustomInstructions.ts` foi endurecido para evitar race entre multiplas instancias do hook no bootstrap de `/api/persona`; isso remove a condicao que podia deixar `isLoaded=false` para sempre e quebrar o autosave das preferencias de voz/TTS. `app/api/persona/route.ts` passou a ler/gravar tambem `customSystemInstructions`, e o `SettingsDrawer` agora reflete o status de autosave tambem na aba `Tuning`, onde ficam as opcoes de voz. `hooks/useChat.ts` deixou de sanitizar anexos persistidos para placeholders, preservando contexto real de PDF/texto/imagem apos reload e `edit/resend`, e passou a persistir estados terminais tambem em abort/failure, nao so no caminho feliz. O shell foi limpo de sobras nao usadas (`CanvasContent`, `DocumentPreviewModal`, `copyArtifactToClipboard`, `updateConversationTitle` e SVGs padrao do template), a documentacao foi realinhada ao runtime real (`gpt-5.1-chat-latest`, `gpt-5.4` no quiz, `gpt-image-2`, painel de `Atividade` + `Notas`, endpoints `/api/tts`, `/api/realtime/tts-call`, `/api/artifacts/pdf`) e o pipeline passou a rodar `npm test` em CI/pre-deploy. A unit versionada `systemd/chatgpt.service` foi alinhada ao estado produtivo com `Restart=always`. A pagina `/login` foi mantida simples no proprio app e agora trata melhor o caso em que a auth do app estiver desligada.

Notes:
Validacao desta rodada: `npm test`, `npx tsc --noEmit` e `npm run build` passaram. O comando `npm test -- --run` nao deve ser usado aqui porque o script ja embute `vitest --run`. A decisao consciente foi nao endurecer agora o preview/print HTML client-side dos artifacts, porque o fluxo e pessoal do Anders e o renderer atual esta aprovado.

### 2026-05-24 19:50 - Login do app com usuario/senha e correcao de basePath/cookie

Context:
Anders pediu um login simples com credenciais no proprio Gaucho Chat. O gate inicial existia so por senha e a primeira ligacao real expôs dois problemas de integracao: redirect duplicando o `basePath` (`/chat/chat/login`) e cookie de sessao sendo reescrito para `/code/` pelo Apache.

Details:
`app/api/auth/login/route.ts` passou a validar `username` + `password`, e `lib/server/auth.ts` ganhou `AUTH_USERNAME` alem de fixar o `Path` do cookie no `NEXT_PUBLIC_BASE_PATH` (`/chat` em producao). `app/login/page.tsx` agora renderiza formulario com usuario e senha, e `app/page.tsx` parou de prefixar manualmente `/login`, deixando o redirect server-side respeitar o `basePath` nativo do Next. Em producao, `.env.production` ficou com `AUTH_ENABLED=true` e credenciais configuradas apenas no arquivo ignorado pelo Git. No Apache, `ProxyPassReverseCookiePath / /code/` foi restringido ao bloco de `/code/`, `APACHE.md` foi atualizado para refletir que `/chat` usa JWT/app auth, e o `chatgpt.service` + `apache2` foram recarregados com validacao real.

Notes:
Validacao desta rodada: `npm test`, `npx tsc --noEmit`, `npm run build`, `systemctl restart chatgpt.service`, `apachectl configtest`, `systemctl reload apache2`, `curl -I https://ultrassom.ai/chat` retornando `location: /chat/login`, e login publico em `/chat/api/auth/login` seguido de `/chat/api/auth/check` retornando `authenticated:true`. O arquivo `/etc/apache2/sites-available/ultrassom.ai-optimized.conf` e mantido com atributo imutavel; para futuras mudancas, remover `chattr +i`, editar, validar e recolocar a protecao.

### 2026-05-24 21:23 - Corrigido loop de redirects no mobile apos login

Context:
No mobile, o login podia falhar com erro de "numero alto de redirecionamentos". A reproducao com Chrome em viewport iPhone mostrou loop entre `/chat` e `/chat/login` apos autenticar.

Details:
A causa era o cookie publico saindo com `Path=/chat/`, que autentica `/chat/login` e `/chat/api/*`, mas nao autentica `/chat` sem barra final. O Apache foi ajustado para `ProxyPassReverseCookiePath / /chat` em vez de `/chat/`, preservando o escopo correto do cookie. No app, `proxy.ts` passou a redirecionar login autenticado para `/chat` sem barra final, e `app/layout.tsx` passou a desregistrar service workers antigos do escopo `/chat`, ja que o service worker existente era minimo e nao fazia cache offline.

Notes:
Validacao desta rodada: `npm test`, `npx tsc --noEmit`, `npm run build`, `systemctl restart chatgpt.service`, `apachectl configtest`, `systemctl reload apache2`, `curl` confirmando `Set-Cookie: Path=/chat` e `auth/check authenticated:true`, alem de Playwright/Chrome mobile concluindo login em `https://ultrassom.ai/chat` sem `ERR_TOO_MANY_REDIRECTS`.

### 2026-05-24 23:52 - Download do audio TTS completo

Context:
Anders pediu um botao no player de TTS para baixar a leitura completa depois da geracao.

Details:
`hooks/useAssistantTts.ts` agora preserva o `Blob` de cada chunk de voz no cache e expoe `downloadAudio()`/`canDownload`, montando um arquivo MP3 unico por concatenacao dos blobs ja gerados. `components/chat/QuickActionsBar.tsx` adicionou um botao `Download` no player, habilitado somente quando todos os chunks terminaram de gerar.

Notes:
Validacao desta rodada: `npm test`, `npx tsc --noEmit` e `npm run build` passaram. O download reaproveita os chunks existentes de `/api/tts`, sem nova chamada ao modelo e sem alterar o endpoint.

### 2026-05-25 00:30 - Documentacao consolidada e docs antigos removidos

Context:
Depois da estabilizacao do login e do loop mobile, Anders pediu uma limpeza maior da documentacao, com uso de agentes para mapear docs antigas e consolidar uma fonte atualizada.

Details:
A documentacao publica foi reduzida para fontes canonicas: `README.md`, `docs/README.md`, `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/INFRASTRUCTURE.md` e `docs/MODELS.md`. Foram removidos docs antigos/duplicados que apontavam para Vercel, Docker, Nginx, instalacao Apache legada ou arquitetura gerada: `docs/APACHE_INSTALL.md`, `docs/DEPLOYMENT.md`, `docs/COMPONENTS.md` e `docs/architecture/*`. `apache-config/chat.conf` foi atualizado para incluir `ProxyPassReverseCookiePath / /chat` e endpoints atuais de PDF/TTS/Realtime.

Notes:
O criterio novo e manter `README.md` como entrada, `docs/API.md` para contrato de rotas, `docs/ARCHITECTURE.md` para desenho do app, `docs/INFRASTRUCTURE.md` para Apache/systemd/env/deploy, `docs/MODELS.md` para catalogo, e `AGENTS.md` como memoria operacional append-only. Nao recriar docs separados de deploy Apache/Vercel sem necessidade; isso foi a fonte principal de drift.

### 2026-05-24 23:09 - Catalogo GPT-5.3/5.2 e autosave forte de voz

Context:
Atualizado o hall de modelos do Gaucho Chat e endurecida a persistencia server-side das preferencias de voz/TTS.

Details:
`lib/models/modelConfig.ts` removeu `gpt-5.1-chat-latest`, `gpt-5.1`, `gpt-4.1` e `o3`, adicionou `gpt-5.3-chat-latest` como default chat-only e `gpt-5.2` como reasoning model. `stores/settingsStore.ts` e `app/api/chat/route.ts` agora usam `gpt-5.3-chat-latest` como fallback/default e redirecionam modelos legados conhecidos para esse default. Mini/nano iniciam com reasoning `none`; `gpt-5.2` inicia com `medium`. `gpt-5.3-chat-latest` existe na API, mas rejeitou `text.verbosity=low`, entao ficou com `supportsVerbosity=false` para a rota nao enviar parametro recusado. `app/api/persona/route.ts` aceita `POST` como alias de save para flush via `sendBeacon`/`keepalive`; `hooks/useCustomInstructions.ts` ganhou autosave rapido para modo/voz/velocidade e debounce/flush para instrucoes. Docs atualizados em `docs/API.md`, `docs/MODELS.md`, `docs/ARCHITECTURE.md` e `CLAUDE.md`.

Notes:
Validacao: `npm test`, `npx tsc --noEmit`, `npm run build`, smoke isolado em `PORT=3051` para `/chat/api/persona` com restore do JSON original, smoke streaming em `/chat/api/chat` com `gpt-5.3-chat-latest` retornando HTTP 200/SSE `[DONE]`, Playwright/Chrome system mostrando `GPT-5.3 Instant` e persistencia de modo/voz/instrucoes apos reload, `systemctl restart chatgpt.service` e health local/publico em `/chat/api/health`. A primeira tentativa de smoke nao-stream mostrou que `partial_images` so e aceito em streaming; nao mudar isso sem revisar o contrato da tool de imagem.

### 2026-05-28 00:45 - Loop de redirecionamento no login mobile mitigado no app

Context:
Havia ocorrencias reais de loop `307 /chat -> /chat/login` repetido em mobile (e Safari desktop) com erro de muitos redirecionamentos.

Details:
Foi confirmado em `ultrassom_ssl_access.log` que o loop envolvia tambem `GET /chat/login` retornando `307`, o que alimentava ping-pong infinito entre home e login. O hardening final ficou no app (sem alterar Apache): removido o auto-redirect server-side de usuario autenticado na rota `/login` em `proxy.ts`, e removido o auto-redirect client-side da tela de login quando `/api/auth/check` retorna `authenticated=true` em `app/login/page.tsx` (agora mostra botao explicito `Continuar no chat`). Durante a investigacao foi testada limpeza de cookie legado por path; essa abordagem foi descartada porque o `ProxyPassReverseCookiePath` do Apache reescreve path de cookie e podia conflitar com o cookie valido.

Notes:
Validacao desta rodada: `npm test -- lib/server/auth.test.ts`, `npx tsc --noEmit`, `npm run build`, `systemctl restart chatgpt.service`, health publico `https://ultrassom.ai/chat/api/health` com HTTP 200, fluxo `anon /chat -> /chat/login (200)` e fluxo autenticado com `/chat` e `/chat/login` respondendo `200` sem ping-pong de `307`.

### 2026-05-28 00:49 - Hotfix visual do login para sempre expor formulario

Context:
Depois do ajuste anti-loop, o login podia ficar sem campos visiveis quando a verificacao inicial marcava sessao como autenticada, causando UX de "faca login" sem area de credenciais.

Details:
`app/login/page.tsx` foi ajustado para sempre renderizar o formulario quando `authEnabled=true`, mesmo com `alreadyAuthenticated=true`. Nessa situacao, mantemos um CTA opcional `Continuar com sessao atual` no topo, mas sem esconder os campos de usuario/senha.

Notes:
Validacao desta rodada: `npx tsc --noEmit`, `npm run build`, `systemctl restart chatgpt.service`, health publico `https://ultrassom.ai/chat/api/health` retornando HTTP 200.

### 2026-05-28 08:45 - Realtime mini exposto como teste direto de voz

Context:
Anders cogitou trocar o TTS de `gpt-4o-mini-tts` para um modelo nao-mini, mas `tts-1-hd` foi considerado caro para leitura cotidiana de respostas longas.

Details:
`components/chat/QuickActionsBar.tsx` ganhou um botao direto de `Realtime mini` ao lado do alto-falante, reutilizando `useRealtimeTtsLab` e parando o TTS MP3 normal antes de iniciar a sessao Realtime para evitar audio/custo duplicado. O endpoint continua usando `gpt-realtime-mini`; o TTS MP3 principal continua em `gpt-4o-mini-tts`.

Notes:
Validacao desta rodada: `npx tsc --noEmit`, `npm run build` e `npm test` passaram. A decisao foi nao migrar para `tts-1-hd` agora; comparar qualidade/latencia pelo botao Realtime direto antes de promover qualquer troca de modelo padrao.

### 2026-05-28 08:57 - Corrigido offer SDP do Realtime mini

Context:
O botao direto de `Realtime mini` retornou erro upstream da OpenAI `invalid_offer` / `Failed to parse offer: failed to unmarshal SDP: EOF`.

Details:
`app/api/realtime/tts-call/route.ts` deixou de repassar o `FormData` nativo do Node para `/v1/realtime/calls` e passou a montar multipart deterministico, com o campo `sdp` em `Content-Type: application/sdp` e `session` em `application/json`, preservando o status `201` da OpenAI. `hooks/useRealtimeTtsLab.ts` agora adiciona transceiver de audio `recvonly` antes de gerar o offer e valida `peer.localDescription.sdp` antes do fetch. `app/api/realtime/tts-call/route.test.ts` cobre o multipart e o status 201.

Notes:
Validacao desta rodada: `npm test -- app/api/realtime/tts-call/route.test.ts`, `npx tsc --noEmit`, `npm run build`, `systemctl restart chatgpt.service`, health local/publico OK e smoke Playwright em Chrome system no `/chat` autenticado. O smoke real clicou `Realtime mini` e `/chat/api/realtime/tts-call` retornou `201` com SDP answer; sem `invalid_offer`, sem overlay Next e sem console errors relevantes.

### 2026-05-28 09:02 - Direcao vocal Codex gaucha discreta no Realtime

Context:
Anders gostou da qualidade/custo do `gpt-realtime-mini` e pediu uma instrucao leve para deixar a leitura com entonacao Codex e um toque gaucho, sem criar secao nova no front.

Details:
`app/api/realtime/tts-call/route.ts` ganhou `REALTIME_TTS_STYLE_INSTRUCTIONS` server-side na session do Realtime. A instrucao pede presenca calma/curiosa/companheira de Codex e cadencia gaucha sul-brasileira muito sutil apenas em ritmo e entonacao, com trava explicita para nao adicionar girias, interjeicoes, piadas ou palavras extras se nao estiverem no texto.

Notes:
Validacao desta rodada: `npm test -- app/api/realtime/tts-call/route.test.ts`, `npx tsc --noEmit` e `npm run build` passaram. A direcao fica no backend e nao altera UI nem preferencias persistidas.

### 2026-05-31 19:16 - Catalogo de modelos atualizado (GPT-5.5 + default GPT-5.4 mini)

Context:
Anders pediu ajuste direto na selecao de modelos: incluir `gpt-5.5`, remover `gpt-5.4-nano` e trocar o modelo padrao para `gpt-5.4-mini`, preservando reasoning default `none` para mini.

Details:
`lib/models/modelConfig.ts` passou a listar `gpt-5.5` (chat+reasoning) e removeu `gpt-5.4-nano` do catalogo. `stores/settingsStore.ts` e `app/api/chat/route.ts` agora usam `gpt-5.4-mini` como `DEFAULT_MODEL`/`DEFAULT_CHAT_MODEL`, com fallback legado de `gpt-5.3-chat-latest` para o novo default. `stores/settingsStore.test.ts` foi atualizado para refletir o novo default e remover expectativa de nano. `docs/MODELS.md` foi alinhado ao catalogo/runtime atual.

Notes:
Validacao desta rodada: `npm test -- stores/settingsStore.test.ts` e `npx tsc --noEmit` passaram. Se for preciso validar UX final do seletor, proximo passo e smoke manual no navegador em `/chat` para conferir ordenacao/labels.

### 2026-05-31 19:22 - Modo Documento com Deepsearch Medium/High no Canvas

Context:
Anders pediu evoluir o fluxo de Documento para oferecer duas variantes de pesquisa profunda com retorno no Canvas: `Deepsearch Medium` e `Deepsearch High`.

Details:
`types/index.ts` expandiu `ResponseMode` com `deepsearch_medium` e `deepsearch_high`. No composer, o botao Documento virou menu com duas opcoes em `components/workspace-v2/WorkspaceLayoutV2.tsx` e o container `components/workspace-v2/CommandComposerContainerV2.tsx` passou a usar `onSelectDocumentMode`, placeholders dedicados e hints de acessibilidade. No pipeline de envio (`hooks/useChat.ts`), ambos os modos reaproveitam o fluxo de artifact de documento/canvas e forcam `gpt-5.4-mini` com reasoning fixo por modo (`medium` ou `high`), mantendo `quiz` inalterado. A command palette (`components/command/CommandPalette.tsx`) foi alinhada com os dois novos atalhos de modo.

Notes:
Validacao desta rodada: `npx tsc --noEmit` e `npm test -- components/workspace-v2/WorkspaceLayoutV2.test.tsx` passaram.

### 2026-05-31 19:31 - Docs canonicos alinhados aos modos Deepsearch e defaults atuais

Context:
Depois da entrega de Deepsearch Medium/High e da troca de default para `gpt-5.4-mini`, Anders pediu checagem de documentacao em dia.

Details:
`docs/API.md` foi atualizado para refletir default `model: gpt-5.4-mini`, novos `responseMode` (`deepsearch_medium` e `deepsearch_high`) e comportamento forcado desses modos (`gpt-5.4-mini` + reasoning `medium/high`, mantendo artifact em Canvas). `docs/ARCHITECTURE.md` foi atualizado com o default atual, removendo referencia legada a `gpt-5.3-chat-latest` e registrando a regra de Deepsearch. `docs/MODELS.md` foi corrigido para o `contextWindow` real do `gpt-5.5` no catalogo local e incluiu o lembrete de forca dos modos Deepsearch.

Notes:
A memoria operacional (`AGENTS.md`) segue append-only; docs canonicos agora estao coerentes com runtime/modelos/response modes atuais.

### 2026-05-31 19:35 - Varredura final README/CLAUDE sem drift

Context:
Anders pediu uma passada final para confirmar se README/CLAUDE estavam alinhados apos ajustes de modelos e modos Deepsearch.

Details:
`README.md` ja estava consistente com a documentacao canonica. `CLAUDE.md` tinha apenas uma referencia desatualizada de default (`gpt-5.3-chat-latest`), corrigida para `gpt-5.4-mini`, e recebeu nota curta dos modos `deepsearch_medium`/`deepsearch_high` (forca de modelo/raciocinio mantendo retorno em documento/canvas).

Notes:
Nao houve mudancas de runtime/codigo nesta rodada; ajuste foi somente de documentacao operacional para reduzir drift futuro.

### 2026-05-31 21:49 - Reasoning stream resiliente e payload fiel

Context:
Anders pediu revisar por que os resumos de raciocinio nao apareciam nos baloes e se a selecao de reasoning estava sendo repassada corretamente.

Details:
`lib/chat/streamMachine.ts` passou a capturar summaries que chegam por `response.reasoning_summary_text.done` e `response.reasoning_summary_part.done`, alem dos deltas ja existentes, e tambem preserva `response.reasoning_text.done` como fallback. `lib/chat/reasoningConfig.ts` centraliza a montagem do payload: nao envia reasoning para modelo sem capacidade nem para effort `none`, repassa `low|medium|high|xhigh` e mapeia summary local `off` para omissao segura, ja que a API aceita apenas `auto|concise|detailed`. `hooks/useChat.ts` agora usa a preferencia real `parameters.reasoningSummary` em vez de fixar sempre `detailed`. `ReasoningPanel` permanece visivel quando a API reporta `reasoning_tokens` sem emitir summary textual, mostrando esse estado explicitamente.

Notes:
Validacao desta rodada: `npm test`, `npx tsc --noEmit`, `npm run build`, restart de `chatgpt.service`, health local/publico e smoke real em `/chat/api/chat` com `reasoning_tokens` reportado. Se o painel de reasoning nao aparecer, conferir primeiro se o modelo/effort ativo nao esta em `Sem`, depois inspecionar os eventos SSE `reasoning_summary_*` e `response.completed.usage.output_tokens_details.reasoning_tokens`.

### 2026-05-31 22:05 - Docs alinhados ao contrato real de reasoning

Context:
Anders pediu atualizar a documentacao apos o hardening do fluxo de reasoning.

Details:
`README.md`, `docs/ARCHITECTURE.md`, `docs/MODELS.md` e `CLAUDE.md` agora documentam o caminho suportado `settingsStore -> buildReasoningConfig -> /api/chat -> streamMachine -> ReasoningPanel`, a regra de `summary=off` como omissao segura, os eventos `reasoning_summary_*`/`reasoning_text.done` aceitos e o fallback visual por `reasoning_tokens` quando a API aplica raciocinio sem summary textual.

Notes:
Rodada documental; `git diff --check` foi usado para validar whitespace. Nao criar docs paralelos para reasoning sem necessidade: manter API/Architecture/Models/CLAUDE como fontes canonicas.

### 2026-06-02 00:40 - Auditoria de documentacao com correcoes de naming e contratos reais

Context:
Anders pediu uma passada geral para confirmar se a documentacao ainda batia com o projeto depois das ultimas rodadas de modelo/reasoning/deepsearch.

Details:
`README.md`, `docs/README.md` e `docs/ARCHITECTURE.md` foram alinhados ao nome visivel do app (`Gaucho Chat`), preservando nota curta de que `Celer` segue apenas como rotulo historico em alguns artefatos internos como a unit systemd. `docs/MODELS.md` corrigiu um drift real: o estado inicial do app usa `reasoningSummary: "detailed"` em `stores/settingsStore.ts`, inclusive para modelos mini, embora o effort comece em `none`. `docs/API.md`, `docs/ARCHITECTURE.md` e `docs/MODELS.md` tambem deixaram explicito que `deepsearch_medium`/`deepsearch_high` sao presets montados hoje em `hooks/useChat.ts`; o handler `app/api/chat/route.ts` so faz enforcement estrito de `quiz`. `apache-config/chat.conf` teve comentarios atualizados para o naming atual.

Notes:
Durante a auditoria, `systemd/chatgpt.service` e `/etc/systemd/system/chatgpt.service` estavam alinhados entre si, e as regras `/chat` documentadas em `docs/INFRASTRUCTURE.md` batiam com `/etc/apache2/sites-enabled/ultrassom.ai-optimized.conf`. Se surgir duvida futura sobre Deepsearch, verificar primeiro `hooks/useChat.ts` antes de assumir que a regra mora no backend.

### 2026-06-02 14:58 - Repaginada clinico claro do Gaucho Chat

Context:
Anders aprovou implementar a lapidacao visual forte do Gaucho Chat com direcao "clinico claro", preservando o shell `workspace-v2` e todas as funcoes existentes.

Details:
Criado `docs/REDESIGN_ROADPACK.md` com conceito, funcoes intocaveis, bundles e criterios de aceite. Os conceitos finais foram salvos em `docs/assets/redesign/clinical-clear-desktop-concept.png` e `docs/assets/redesign/clinical-clear-mobile-settings-concept.png`. A implementacao ficou visual/componentizada em `app/globals.css`, `components/workspace-v2/*`, `components/chat/*` e `components/settings/SettingsDrawer.tsx`: tokens mais frios e documentais, rail/header/composer mais silenciosos, chat central mais estreito, painel operacional mais claro e settings/mobile com melhor densidade. Apos Anders relatar que a diferenca ainda parecia imperceptivel em varios browsers, foi aplicada uma segunda passada mais evidente com classes `gc-clinical-shell`, `gc-clinical-rail`, `gc-clinical-header`, `gc-clinical-canvas`, `gc-clinical-panel` e `gc-clinical-composer`, alem de regua teal lateral nos baloes do assistente.

Notes:
Nao houve mudanca intencional de API, auth, storage, streaming, TTS, artifacts ou catalogo de modelos. Validacao da rodada: `npm test`, `npx tsc --noEmit`, `npm run build`, `git diff --check`, Playwright com Chrome system em desktop/mobile/settings e restart de `chatgpt.service` com health local/publico OK. Screenshots finais da primeira passada ficaram em `/tmp/gaucho-redesign-final2/`; screenshots publicos da passada mais visivel ficaram em `/tmp/gaucho-visible-redesign-public-ready-desktop.png` e `/tmp/gaucho-visible-redesign-public-ready-mobile.png`.

### 2026-06-02 15:40 - Hotfix dos drawers apos repaginada clinico claro

Context:
Anders reportou que settings, sidebar e secoes em overlay pareciam quebrados ou abriam sem conteudo apos a passada visual mais forte.

Details:
A causa foi a classe decorativa `gc-clinical-panel`/`gc-clinical-rail` definindo `position: relative`, sobrescrevendo o `fixed` do Radix `SheetContent`. `app/globals.css` agora aplica `position: relative` apenas fora de `[data-slot="sheet-content"]`, preservando os drawers. `components/settings/SettingsDrawer.tsx` tambem voltou a renderizar `SheetTitle` e `SheetDescription` em `sr-only`, removendo os avisos de acessibilidade do Radix.

Notes:
Validacao: `git diff --check`, `npx tsc --noEmit`, `npm run build`, `npm test`, restart de `chatgpt.service`, health local/publico e Playwright no `/chat` publico. Screenshots de prova: `/tmp/gaucho-fixed-settings-desktop.png`, `/tmp/gaucho-fixed-sidebar-mobile.png` e `/tmp/gaucho-fixed-context-mobile.png`. Evitar no futuro colocar `position`, `inset` ou `transform` em classes visuais reutilizadas diretamente em `SheetContent`/`DialogContent`.

### 2026-06-02 16:15 - Hotfix do dark mode clinico e resincronizacao de assets

Context:
Depois da repaginada clinico claro, Anders identificou que o problema principal nao era o light, e sim o dark mode mantendo superficies e gradientes claros no shell novo. Durante a auditoria tambem reapareceu o risco de runtime servir assets incoerentes quando `.next` fica desalinhado.

Details:
`app/globals.css` ganhou tokens dedicados para o shell clinico (`--gc-clinical-*`) com overrides reais em `.dark`, cobrindo shell, rail, painel, header, canvas, composer, subheader, cards, rows, active surface e input shadow. `components/workspace-v2/WorkspaceLayoutV2.tsx`, `ConversationRailV2.tsx`, `ContextPanelV2.tsx` e `components/settings/SettingsDrawer.tsx` passaram a consumir essas classes/tokens em vez de `linear-gradient(... rgba(255,255,255, ...))` e inset highlights claros hardcoded. Badges de estado/online/quiz/gravacao tambem foram ajustados para contraste aceitavel no dark. A rodada incluiu `npm test`, `npx tsc --noEmit`, `npm run build`, restart de `chatgpt.service`, health local/publico OK e smoke Playwright com Chrome system em light/dark. Os assets `/_next/static/*.css|js` voltaram a responder `200` depois do rebuild limpo e restart.

Notes:
Quando o sintoma for "layout quebrou" mas `health` estiver OK, checar primeiro se o problema e visual de dark mode ou se o runtime serviu chunks incoerentes por estado ruim de `.next`. O shell clinico agora depende dos tokens `--gc-clinical-*`; evitar reintroduzir `rgba(255,255,255,...)` direto em headers/cards/rows do workspace se a intencao for manter paridade entre light e dark.

### 2026-06-02 17:06 - Lapidacao das superficies visiveis do shell clinico

Context:
Depois do hotfix de dark/runtime, Anders pediu implementar a segunda rodada visual nas superficies mais visiveis do app, preservando toda a arquitetura e sem mexer em fluxos de auth, chat, TTS, Realtime ou persistencia.

Details:
`app/globals.css` ganhou um pacote complementar de superficies refinadas (`gc-refined-*` e `gc-login-*`) para login, chips, citation tray, action tray, cards internos do drawer e caixas suaves de formulario. `app/login/page.tsx` foi remodelada para uma entrada mais editorial/clinica mantendo exatamente a mesma logica de auth, loading e redirect. `components/chat/ChatContainer.tsx` teve a empty state redesenhada como painel de boas-vindas com sugestoes mais coerentes com o shell. `components/chat/MessageBubble.tsx` passou a renderizar citations em bandeja dedicada, timestamp como chip e quick actions em superficie propria; `components/chat/QuickActionsBar.tsx` ganhou apenas o flag visual `alwaysVisible`, sem alterar a funcao de nenhum botao. `components/settings/SettingsDrawer.tsx` foi lapidado por dentro com cards, selects e textareas menos genericos e mais alinhados ao conceito aprovado. Validacao da rodada: `git diff --check`, `npm test`, `npx tsc --noEmit`, `npm run build`, `systemctl restart chatgpt.service`, health local/publico OK e smoke visual com Playwright usando o Chrome do host (fallback porque o Browser plugin nao estava exposto na sessao). Screenshots desta rodada ficaram em `/tmp/gaucho-chat-remodel-qa/`.

Notes:
No smoke visual, o login claro, o workspace light/dark e o drawer desktop/mobile confirmaram a nova familia visual. Evitar reintroduzir controles internos do drawer com `bg-background` ou `border-white/10`, porque isso volta o aspecto generico e quebra a continuidade do pacote `gc-refined-*`.

### 2026-06-02 17:34 - Login reorganizado com a cuia como simbolo principal

Context:
Anders pediu uma passada mais cirurgica no login, usando como referencia uma captura mobile do shell e deixando a cuia como protagonista visual no lugar do topo mais generico com cadeado.

Details:
`app/login/page.tsx` foi reorganizado sem tocar na logica de autenticacao: o topo agora enfatiza a marca e o acesso ao workspace, e a cuia passou a aparecer em um tile proprio com `GPTLogo`, inspirado na linguagem do shell principal. O restante do formulario manteve os mesmos campos, CTA e estados, mas com hierarchy e espacamento melhores para mobile. Validacao desta rodada: `npx tsc --noEmit`, `npm run build`, `systemctl restart chatgpt.service`, health local OK em `/chat/api/health` e smoke visual do `/chat/login` com Playwright + Chrome do host. Screenshot final: `/tmp/gaucho-login-refresh.png`.

Notes:
Se o login voltar a parecer "correto mas sem alma", a primeira coisa a checar e se o simbolo principal ainda e a cuia/brand tile ou se algum icone utilitario voltou a dominar o topo. Para smoke rapido de design, o viewport mobile `430x932` foi suficiente para avaliar a composicao.

### 2026-06-02 17:53 - Simbolo compartilhado da cuia redesenhado

Context:
Anders pediu seguir com o restante da lapidacao do loguinho/cuiazinho, indo alem do login e organizando a marca usada pelo shell.

Details:
`components/ui/gpt-logo.tsx` foi redesenhado com `viewBox` 64x64 e uma cuia/bombilla bem mais legivel em tamanhos pequenos, preservando as classes de animacao existentes. `app/globals.css` ajustou os `transform-origin` das animacoes `gpt-*` para o novo centro `32px 32px`. Como `GPTLogo` e compartilhado, a mudanca aparece no login, splash, rail de conversas e empty state do workspace.

Notes:
Validacao desta rodada: `npx tsc --noEmit` ja havia passado antes da retomada, `npm run build` passou, `systemctl restart chatgpt.service` foi executado, health local/publico ficou `healthy`, e Playwright/Chrome confirmou o login mobile e o workspace carregado depois da splash. Screenshots finais: `/tmp/gaucho-logo-login.png` e `/tmp/gaucho-logo-workspace-after-splash.png`. Ao mexer novamente na marca, validar tambem em tamanho pequeno (`18-25px`), porque a versao antiga escondia a cuia dentro de um canvas grande demais.

### 2026-06-03 09:31 - Kickoff para continuidade dos refinamentos Codex

Context:
Anders pediu um kickoff para retomar as modificacoes de refinamento visual em uma nova sessao Codex sem precisar reconstruir todo o contexto.

Details:
Criado `docs/CODEX_KICKOFF.md` com estado atual, escopo seguro, fora de escopo, arquivos provaveis, validacao esperada e o proximo bundle recomendado: deixar o mobile cerca de 10% mais compacto sem usar `zoom` ou `transform: scale()` no shell inteiro.

Notes:
Ao retomar, abrir primeiro `docs/CODEX_KICKOFF.md` junto de `docs/REDESIGN_ROADPACK.md`. A prioridade sugerida e o bundle `M1 - Mobile 10% mais compacto sem zoom`, preservando touch targets principais e todos os fluxos existentes.

### 2026-06-03 09:52 - M1 densidade mobile sem zoom

Context:
Anders confirmou que o layout mobile/desktop estava aprovado em direcao visual, mas queria o mobile aproximadamente 10% menor sem apelar para zoom, transform global ou reducao artificial da janela.

Details:
`components/workspace-v2/WorkspaceLayoutV2.tsx` recebeu compactacao responsiva apenas abaixo de `md`: header/subheader menores, composer levemente mais baixo, textarea `42px`, controles mais densos e radius menor no composer. `components/chat/ChatContainer.tsx` compactou o empty state mobile, reduziu cards de sugestao, manteve duas colunas no mobile e no desktop comum com painel aberto, liberando tres colunas so em `2xl`. Tambem foi corrigido o auto-scroll do empty state para nao abrir a tela no meio dos cards quando nao ha mensagens. `hooks/useChat.ts` recebeu uma correcao pontual de stale closure incluindo `parameters.reasoningSummary` nas dependencias do callback de envio, porque o diff de reasoning ja usava esse parametro.

Notes:
Validacao desta rodada: `git diff --check`, `npm test`, `npx tsc --noEmit`, testes focados de `streamMachine`/`reasoningConfig`/`ReasoningPanel`, `npm run build` e Playwright com Chrome system no servidor local `PORT=3052`. Metricas antes/depois em mobile `390x844`: header `94px -> 81px`, composer `104px -> 96px`, textarea `46px -> 42px`, cards `170px -> 130-146px`, `scrollTop=0` no empty state. Screenshots finais: `/tmp/gaucho-final-mobile390-workspace.png`, `/tmp/gaucho-final-mobile430-workspace.png` e `/tmp/gaucho-final-desktop1440-workspace-v2.png`.

### 2026-06-03 10:19 - C1 backend Agenda Google + notas locais

Context:
Iniciado o bundle C1 da feature "Agenda Google + Notas locais com STT", limitado a fundacao server-side e contratos. UI da aba Agenda e captura STT no painel ficam para bundles seguintes.

Details:
Criados contratos/storage/rotas para OAuth Google server-side, token local criptografado, listagem de eventos, rascunhos confirmaveis e notas locais globais. `lib/google/tokenStore.ts` salva `data/google-calendar-token.json` com AES-256-GCM e permissao `0600`; `lib/calendar/eventDrafts.ts` persiste rascunhos em `data/calendar-event-drafts.json`; `lib/storage/workspaceNotes.ts` persiste capturas em `data/workspace-notes.json`. Novas rotas: `/api/integrations/google/status`, `/api/integrations/google/auth/start`, `/api/integrations/google/auth/callback`, `/api/integrations/google/disconnect`, `/api/calendar/events`, `/api/calendar/events/draft`, `/api/calendar/events/drafts`, `/api/calendar/events/confirm`, `/api/workspace-notes` e `/api/workspace-notes/[id]`.

Notes:
`POST /api/calendar/events/draft` nunca chama Google; apenas `/api/calendar/events/confirm` escreve no Calendar e somente para draft `pending`. Google Keep segue fora da V1. Arquivos runtime privados novos foram adicionados ao `.gitignore`. Antes de ativar OAuth real, configurar sem expor valores: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `GOOGLE_CALENDAR_DEFAULT_ID`, `GOOGLE_CALENDAR_DEFAULT_TIME_ZONE` e `GOOGLE_TOKEN_ENCRYPTION_KEY`.

### 2026-06-03 11:07 - Kickoff C2 Agenda no painel direito

Context:
Anders pediu deixar um kickoff para o proximo bundle antes de revisar/seguir implementando a agenda.

Details:
Criado `docs/CALENDAR_NOTES_C2_KICKOFF.md` como handoff do bundle C2. O escopo e somente UI/estado de conexao no `ContextPanelV2`: nova tab `Agenda`, status Google, eventos de hoje/proximos 7 dias e rascunhos pendentes usando as rotas do C1.

Notes:
C2 nao deve incluir interpretacao automatica do chat, STT no painel, Google Keep ou ampliacao de escopo OAuth. Se `ContextPanelV2` crescer demais, extrair `AgendaPanelV2` localmente em `components/workspace-v2/` sem redesenhar o painel inteiro.

### 2026-06-03 11:27 - C2 aba Agenda no painel direito

Context:
Implementado o bundle C2 da feature "Agenda Google + Notas locais com STT", limitado a UI/estado no painel direito e usando apenas os contratos server-side do C1.

Details:
`types/index.ts` ampliou `ActivePanelTab` para incluir `calendar`. `components/workspace-v2/ContextPanelV2.tsx` ganhou a tab `Agenda` e delega o conteudo para `components/workspace-v2/AgendaPanelV2.tsx`, mantendo o painel principal enxuto. `lib/calendar/calendarApi.ts` criou wrappers client-side com `apiUrl()` e `parseApiErrorResponse()` para status Google, eventos, drafts, disconnect e confirmacao. `components/command/CommandPalette.tsx` ganhou comando `Ver Agenda`. `lib/calendar/calendarApi.test.ts` cobre basePath, erro recuperavel de Google desconectado e confirmacao com `sendUpdates: "none"`.

Notes:
`Ocultar` rascunho em C2 e apenas visual/local porque ainda nao existe endpoint de descarte; nao tratar isso como exclusao persistida. Confirmacao real continua somente em `/api/calendar/events/confirm` e fica desabilitada quando o Google nao esta conectado. Validacao desta rodada: `git diff --check`, teste focado do wrapper, `npm test`, `npx tsc --noEmit`, `npm run build`, `systemctl restart chatgpt.service`, health local/publico OK, rotas novas sem cookie retornando `401`, smoke Playwright desktop e mobile confirmando a tab `Agenda`.

### 2026-06-03 11:39 - C3 captura STT para notas globais

Context:
Implementado o bundle C3 da feature "Agenda Google + Notas locais com STT", limitado a captura de voz no painel e persistencia em notas locais globais.

Details:
`components/workspace-v2/WorkspaceCapturesPanelV2.tsx` adiciona bloco reutilizavel de capturas locais com gravacao via `useSpeechToText`, transcricao por `/api/transcribe`, salvamento como `source: "stt"` em `/api/workspace-notes`, listagem recente e exclusao. `components/workspace-v2/ContextPanelV2.tsx` encaixa o bloco na aba `Notas` com `conversationId` quando existe conversa ativa. `components/workspace-v2/AgendaPanelV2.tsx` encaixa o mesmo bloco de forma compacta na aba `Agenda`, com tag `agenda`, mas sem transformar captura em rascunho de evento. `lib/storage/workspaceNotesApi.ts` criou wrappers client-side para listar/criar/excluir notas locais; `lib/storage/workspaceNotesApi.test.ts` cobre basePath, criacao STT com metadados e delete.

Notes:
C3 nao altera `/api/transcribe` nem cria eventos de agenda. Capturas feitas pela Agenda continuam sendo notas STT globais com tag `agenda`; a conversao de linguagem natural para draft fica para C4. Validacao desta rodada: `git diff --check`, teste focado do wrapper, `npm test`, `npx tsc --noEmit`, `npm run build`, `systemctl restart chatgpt.service`, health local/publico OK, `/api/workspace-notes` e `/api/transcribe` sem cookie retornando `401`, smoke autenticado desktop/mobile confirmando `Capturas locais` em `Notas` e `Agenda`, e smoke API criando nota STT temporaria `201` e removendo `200`.

### 2026-06-03 23:07 - C4 rascunho de agenda por linguagem natural

Context:
Implementado o bundle C4 da feature "Agenda Google + Notas locais com STT", limitado a transformar texto do chat ou captura de voz em rascunho local de agenda com revisao visual antes de qualquer escrita no Google Calendar.

Details:
`app/api/calendar/events/draft-from-text/route.ts` cria a rota privada de extracao por linguagem natural. `lib/calendar/naturalLanguageDraft.ts` chama o modelo com schema JSON estrito, interpreta datas relativas usando o fuso configurado, recusa textos incompletos com erro `422` e persiste somente em `data/calendar-event-drafts.json` via `createCalendarEventDraft`. `lib/calendar/calendarApi.ts` ganhou `createCalendarDraftFromText`. `components/chat/QuickActionsBar.tsx` e o menu de `MessageBubble` adicionam acao `Rascunhar agenda` para texto do chat. `components/workspace-v2/WorkspaceCapturesPanelV2.tsx` tenta criar rascunho automaticamente quando a captura e feita na aba Agenda e tambem oferece botao `Rascunhar` nas capturas listadas. `AgendaPanelV2` escuta `gaucho:calendar-draft-created` e recarrega os pendentes.

Notes:
C4 nao confirma nem escreve no Google; a escrita continua exclusivamente em `/api/calendar/events/confirm`. Validacao desta rodada: testes focados da rota/wrapper, `npx tsc --noEmit`, `git diff --check`, `npm test` com 50 arquivos/146 testes, `npm run build`, `systemctl restart chatgpt.service`, health local/publico OK e rota nova sem cookie retornando `401`. Nao foi feito smoke autenticado criando draft real para evitar deixar rascunho temporario persistido no storage do Anders.

### 2026-06-03 23:10 - Quadro vivo de tarefas da frente Agenda/Notas

Context:
Anders observou que as tarefas nao estavam sendo atualizadas ao longo do processo, apesar dos fechamentos ficarem registrados no `AGENTS.md`.

Details:
Criado `docs/CALENDAR_NOTES_PROGRESS.md` como quadro vivo do ROADPACK Agenda Google + Notas locais, com status C1-C4, proximo bundle candidato C5 e tarefas abertas. `docs/README.md` agora instrui atualizar o documento de progresso/ROADPACK ativo durante o processo, nao apenas no fechamento. `docs/CALENDAR_NOTES_KICKOFF.md` e `docs/CALENDAR_NOTES_C2_KICKOFF.md` foram marcados como historicos para evitar retomada por documento stale.

Notes:
Para futuras frentes com bundles, manter sempre um documento vivo de progresso alem do registro append-only no `AGENTS.md`. Kickoff antigo deve ser marcado como historico quando deixar de representar o estado atual.

### 2026-06-03 23:18 - Checklist visivel atualizado ao longo da execucao

Context:
Anders esclareceu que a observacao sobre "tarefas concluidas" era sobre o recurso visual de tarefas/checklist da sessao, nao sobre docs de ROADPACK.

Details:
`AGENTS.md` agora instrui explicitamente que, quando houver checklist/plano visivel da sessao, o agente deve atualizar os estados ao longo do processo: marcar `in_progress` ao iniciar uma etapa, `completed` assim que terminar e adicionar/ajustar itens quando uma subtarefa real surgir.

Notes:
Em tarefas multi-etapa, tratar o checklist como painel operacional vivo para Anders acompanhar o andamento, nao como formalidade a preencher no final.

### 2026-06-03 23:19 - Regras operacionais de tooling e validacao

Context:
Anders pediu adicionar ao prompt local as sugestoes de melhoria que ajudam o agente a trabalhar melhor em termos de tooling, validacao, dados runtime, documentos vivos e fechamento.

Details:
Adicionada a secao `Processo Operacional Do Agente` no topo operacional do `AGENTS.md`, com regras para checklist vivo, escada de validacao proporcional, preservacao de dados runtime privados, smoke tests sem sujeira persistente, uso de tooling, separacao entre documento vivo e memoria append-only, compatibilidade com instrucoes superiores, subagentes, fechamento e seguranca para efeitos externos.

Notes:
Essas regras devem ser aplicadas antes do historico append-only em tarefas futuras. Para docs/processo, `git diff --check` basta; para mudancas de runtime, seguir a escada de validacao nova.

### 2026-06-03 23:19 - Kickoff fresh para Agenda/Notas C5

Context:
Anders pediu um kickoff para seguir a frente Agenda Google + Notas locais em uma sessao fresh.

Details:
Criado `docs/CALENDAR_NOTES_FRESH_KICKOFF.md` como handoff curto para retomada. O arquivo resume C1-C4 implementados, reforca que apenas `/api/calendar/events/confirm` escreve no Google, recomenda C5 como revisao/edicao de rascunhos antes de confirmar, lista arquivos-chave, tarefas abertas e validacao esperada. `docs/CALENDAR_NOTES_PROGRESS.md` e `docs/README.md` foram atualizados para apontar para o kickoff fresh.

Notes:
Ao retomar em sessao nova, ler primeiro `AGENTS.md`, `docs/CALENDAR_NOTES_PROGRESS.md` e `docs/CALENDAR_NOTES_FRESH_KICKOFF.md`. Proximo passo recomendado: C5, salvo se Anders quiser revisar manualmente C3/C4 antes.

### 2026-06-04 02:37 - C5 edicao e descarte persistente de rascunhos

Context:
Implementado o bundle C5 da frente "Agenda Google + Notas locais com STT", focado em revisar rascunhos locais antes de qualquer escrita no Google Calendar.

Details:
`lib/calendar/eventDrafts.ts` ganhou normalizacao de edicao para rascunhos `pending`, erro de estado para rascunhos ja processados e descarte persistente local. Foram adicionadas as rotas privadas `PATCH /api/calendar/events/drafts/[id]` e `POST /api/calendar/events/drafts/[id]/discard`; ambas operam somente no JSON local e nao chamam Google. `lib/calendar/calendarApi.ts` ganhou wrappers `updateCalendarDraft` e `discardCalendarDraft`. `components/workspace-v2/AgendaPanelV2.tsx` substituiu o `Ocultar` em memoria por `Descartar` persistente e adicionou modo inline para editar titulo, inicio, duracao, local e descricao antes de `Confirmar`. `docs/API.md`, `docs/ARCHITECTURE.md` e `docs/CALENDAR_NOTES_PROGRESS.md` foram alinhados ao novo contrato.

Notes:
`/api/calendar/events/confirm` continua sendo o unico caminho que escreve no Google Calendar. Validacao desta rodada: testes focados C5, `npx tsc --noEmit`, `npm test` com 52 arquivos/158 testes, `npm run build`, `git diff --check`, `systemctl restart chatgpt.service`, health local healthy e health publico HTTP 200. Nao foi feito smoke autenticado criando rascunho real para evitar sujeira persistente em `data/calendar-event-drafts.json`.

### 2026-06-04 20:31 - Side quest futura de densidade responsiva

Context:
Depois do ajuste compacto para iPhone 16 Pro Max, Anders perguntou se faria mais sentido substituir ajustes locais de padding/margin por um sistema globalmente reativo.

Details:
Decidimos registrar como plano futuro, nao refatorar imediatamente. `docs/REDESIGN_ROADPACK.md` ganhou a side quest "Densidade Responsiva", propondo tokens semanticos para shell, header, subheader, composer, paineis, sheets, chips e controles recorrentes, com degraus discretos de densidade (`comfortable`, `default`, `compact`) em vez de `transform: scale` no app inteiro.

Notes:
Quando essa frente for ativada, preservar o criterio: espacamento, altura, raio e agrupamento podem ser reativos; tipografia nao deve escalar por viewport. Comecar por `app/globals.css` e `components/workspace-v2/WorkspaceLayoutV2.tsx`, depois migrar componentes conforme forem tocados.

### 2026-06-04 20:45 - Painel de situacao Agenda/Notas

Context:
Anders pediu um painel para se situar rapidamente no plano da frente Agenda Google + Notas locais antes de testar as implementacoes e preparar OAuth Google real.

Details:
`docs/CALENDAR_NOTES_PROGRESS.md` ganhou um `Painel Rapido` com estado por area, proximo passo, regra de seguranca e teste recomendado. `docs/CALENDAR_NOTES_FRESH_KICKOFF.md` foi atualizado de C5-futuro para C1-C5 implementados, com painel de retomada, checklist de env OAuth e redirect URI esperado.

Notes:
Ao retomar essa frente, usar primeiro o painel rapido em `docs/CALENDAR_NOTES_PROGRESS.md`. Proximo foco pratico: revisao manual C3-C5 no browser real e configuracao das credenciais Google sem expor segredo.

### 2026-06-04 20:39 - Docs da densidade mobile paralela ao Codex

Context:
Depois da implementacao da compactacao mobile em ~15% por tokens, Anders pediu atualizar as docs e deixar claro que essa foi uma implementacao paralela ao fluxo Codex de refinamentos visuais.

Details:
`docs/REDESIGN_ROADPACK.md` passou a marcar a side quest de Densidade Responsiva Mobile como implementada em paralelo. `docs/CODEX_KICKOFF.md` deixou o M1 antigo como historico/concluido e apontou o proximo passo para QA visual/micro-ajustes. `docs/README.md`, `README.md`, `docs/ARCHITECTURE.md` e `CLAUDE.md` documentam o contrato `--gc-mobile-*`, a regra de nao usar `zoom`, viewport artificial ou `transform: scale()` global, e a preferencia por ajustar tokens em `app/globals.css`.

Notes:
Nao houve mudanca de API, modelos, auth, storage ou infraestrutura nesta rodada documental. Validar com `git diff --check`; se houver ajuste visual posterior, começar pelos tokens `--gc-mobile-*` antes de espalhar novas classes locais no mobile.

### 2026-06-05 00:35 - Fix: cookie de auth revertido para Path=/

Context:
Apos o commit `8396769` (login com usuario/senha), `lib/server/auth.ts` passou a emitir o cookie com `Path=/chat` (via `getAuthCookiePath()`). Em producao o Apache tem `ProxyPassReverseCookiePath / /chat`, que reescreve paths de cookie: `/` vira `/chat`, `/api/...` vira `/chat/api/...`. Ao receber `Path=/chat` do servidor, o Apache reescrevia para `Path=/chat/chat` — path invalido, cookie descartado pelo browser na proxima requisicao. Resultado: logout forcado em navegacoes e falha silenciosa no PUT /api/persona (instrucoes de voz e preferencias de TTS nao persistiam apos reload).

Details:
`lib/server/auth.ts` teve `getAuthCookiePath()` removida e `setAuthCookie`/`clearAuthCookie` voltaram a usar `path: "/"` hardcoded. O Apache ja converte `Path=/` para `Path=/chat` corretamente via `ProxyPassReverseCookiePath / /chat` — o servidor nao precisa saber o basePath publico. `lib/server/auth.test.ts` foi atualizado: os dois testes que esperavam `Path=/chat` passaram a esperar `Path=/`.

Notes:
A regra que vale: o servidor sempre emite `Path=/`; o Apache e responsavel pelo rewrite para o path publico via `ProxyPassReverseCookiePath / /chat`. Nunca alterar o path do cookie server-side para incluir o basePath — isso cria duplo-rewrite. Commit: `ff7fd33`.

### 2026-06-05 00:37 - Fix: campos invalidos na session config do Realtime TTS

Context:
O botao `Realtime mini` estabelecia conexao WebRTC normalmente (retornava `201` com SDP answer) mas nao produzia audio. Auditoria identificou tres campos errados em `buildRealtimeTtsSessionConfig` que a OpenAI Realtime API ignorava silenciosamente, deixando o modelo sem instrucao de gerar saida de audio.

Details:
`app/api/realtime/tts-call/route.ts`: removido `type: "realtime"` (nao faz parte do schema de session da `/v1/realtime/calls`); `output_modalities: ["audio"]` corrigido para `modalities: ["audio"]` (campo correto da Realtime API); `audio: { output: { voice } }` achatado para `voice` no nivel raiz (formato esperado pela API). `hooks/useRealtimeTtsLab.ts`: `output_modalities` no evento `response.create` enviado pelo data channel corrigido para `modalities`. `app/api/realtime/tts-call/route.test.ts` atualizado: `.audio.output.voice` → `.voice`.

Notes:
A conexao WebRTC em si nunca foi afetada — o SDP handshake funciona independente dos campos de session. O sintoma era audio ausente sem erro visivel. Commit: `7941a1b`. O modelo continua `gpt-realtime-mini`; o TTS MP3 principal continua em `gpt-4o-mini-tts`.

### 2026-06-05 15:00 - Fix: session.type obrigatorio no Realtime TTS GA

Context:
Depois de novos testes reais, o fluxo `Realtime mini` voltou a falhar porque a OpenAI Realtime API GA passou a exigir `session.type` no POST `/v1/realtime/calls`. A nota anterior de 2026-06-05 00:37 ficou desatualizada/invertida para o contrato atual.

Details:
`app/api/realtime/tts-call/route.ts` voltou a enviar a sessao GA com `type: "realtime"`, `output_modalities: ["audio"]` e `audio.output.voice`. `hooks/useRealtimeTtsLab.ts` voltou a usar `output_modalities` no `response.create`. `app/api/realtime/tts-call/route.test.ts` cobre esse shape.

Notes:
Validacao desta rodada: teste focado da rota, `npx tsc --noEmit`, `npm run build` e sonda WebRTC real com Chrome headless contra `/v1/realtime/calls`. Resultado da sonda: `session.type + audio.output.voice + output_modalities` retornou `201` e `response.done`; `session.type + modalities` retornou `Unknown parameter: session.modalities`. Para o contrato atual, nao voltar ao formato beta/raiz.

### 2026-06-06 12:35 - Limpeza documental e remocao do legado Docker/Nginx

Context:
Anders pediu uma passada de atualizacao geral das docs, correcao de drift com o runtime real e limpeza da arvore do que nao estava mais em uso no projeto.

Details:
Foram alinhados `docs/README.md`, `docs/INFRASTRUCTURE.md`, `CLAUDE.md`, `.env.example`, `scripts/README.md` e os workflows `.github/workflows/deploy.yml` e `.github/workflows/pr-checks.yml` ao stack real `Apache + chatgpt.service + basePath /chat`. O health passou a se identificar como `Gaucho Chat` em `app/api/health/route.ts`. Foram removidos arquivos legados de deploy/proxy que nao refletiam mais o projeto: `Dockerfile`, `docker-compose.yml`, `nginx/nginx.conf`, `nginx/ssl/README.md` e `scripts/install-apache.sh`. `scripts/start-production.sh` e `scripts/test-local.sh` ficaram com naming atualizado para `Gaucho Chat`.

Notes:
Validacao desta rodada: `git diff --check`, `npx tsc --noEmit`, `npm test` e `npm run build` passaram. O repo nao deve voltar a anunciar deploy por Vercel/Docker/Nginx enquanto o runtime oficial continuar sendo Apache + systemd; se algum dia isso mudar, atualizar primeiro `docs/INFRASTRUCTURE.md`, `.env.example` e os workflows juntos para evitar drift de novo.

### 2026-06-10 10:50 - Background para respostas longas

Context:
Anders pediu que pesquisas/perguntas demoradas continuassem processando quando ele troca de aba, recarrega ou volta depois. O fluxo antigo abortava junto com a conexao do navegador por `request.signal`, preservando parcial como `interrupted`.

Details:
`document`, `deepsearch_medium` e `deepsearch_high` agora usam Responses API com `background: true` em `app/api/chat/background`, persistindo `response_id` no `Message.backgroundJob` e sincronizando por `/api/chat/background/sync`; `/api/chat/background/cancel` cancela via `openai.responses.cancel`. `hooks/useChat.ts` mantem o chat normal em SSE, mas para modos longos cria job server-side, faz polling leve e sincroniza em `visibilitychange`. `lib/chat/responseToMessagePatch.ts` converte Response final em patch de mensagem com texto, citacoes, imagem e tokens; `incomplete` vira `failed` para evitar spinner infinito. `/etc/apache2/APACHE.md` e `docs/API.md` documentam `/chat/api/chat/background*`.

Notes:
Nao ha fila externa/Redis/worker nesta v1: a OpenAI guarda a Response em background e o app sincroniza quando a aba volta ou durante polling. Validacao desta rodada: teste focado do conversor, `npm test`, `npx tsc --noEmit`, `npm run build` e `git diff --check` passaram; depois do deploy, validar health local/publico de `/chat/api/health`.

### 2026-06-10 11:30 - Deepsearch descreve imagens clinicas sem gerar imagem

Context:
Anders observou que prompts de relatorio ultrassonografico/ecodoppler podem usar a palavra "imagem" como material clinico a descrever, nao como pedido de criacao de imagem.

Details:
`lib/server/chatRequest.ts` passou a expor `image_generation` apenas no `responseMode="default"`; `document`, `deepsearch_medium` e `deepsearch_high` seguem com `web_search_preview` e ferramentas textuais, mas sem ferramenta de geracao de imagem. `hooks/useChat.ts` adicionou instrucao clinica para descrever/interpretar "imagem", "ecodoppler", "onda" e "tracado", permitindo esquemas ASCII em blocos de codigo quando ajudarem a esclarecer morfologia ou timing. `lib/server/chatRequest.test.ts` cobre a ausencia de `image_generation` nos modos longos.

Notes:
Para relatorios e Deepsearch, "imagem" deve ser interpretada como dado fonte/achado visual salvo pedido explicito de criacao em chat normal. Se no futuro reativar imagem em modo documento, adicionar um flag explicito de intencao em vez de depender de deteccao por palavra.

### 2026-06-11 00:36 - Guarda contra tela só com papel de parede

Context:
Anders relatou que o site abria e logo ficava apenas com o fundo/papel de parede durante a fase de retomada dos refinamentos de front. O smoke limpo em Chrome desktop e mobile renderizou o workspace normalmente, entao a causa mais provavel era falha de hidratacao/chunk/cache deixando o SSR escondido pelo wrapper `invisible`.

Details:
`components/workspace-v2/GauchoChatShellV2.tsx` deixou de aplicar `className="invisible"` antes da hidratacao. Assim, se um bundle antigo ou erro antes da hidratacao impedir o React de assumir a tela, o shell SSR permanece visivel em vez de sobrar apenas o fundo. Nao houve mudanca de API, storage, streaming, auth, modelos ou layout estrutural.

Notes:
Validacao desta rodada: `npm test`, `npx tsc --noEmit`, `npm run build`, `git diff --check`, `systemctl restart chatgpt.service`, health local/publico em `/chat/api/health` e Playwright/Chrome system desktop+mobile contra `https://ultrassom.ai/chat`. O `npx tsc --noEmit` falhou uma vez quando rodou em paralelo com `next build` por corrida em `.next/types/routes.js`; rerodado isolado passou.

### 2026-06-12 19:04 - Shell edge-to-edge e label curto no welcome screen

Context:
Anders queria o layout do chat preenchendo a tela inteira (edge-to-edge), como no projeto STT (`/root/STT/`). O STT usa `min-h-screen w-full` sem moldura; o Gaucho Chat tinha padding, border-radius e border criando um efeito de card flutuante. Separadamente, o label "Preencher" / "Preencher no composer" nos cards de sugestao da tela inicial distorcia os botoes em dimensoes intermediarias.

Details:
`components/workspace-v2/WorkspaceLayoutV2.tsx` teve o wrapper interno e o shell clinico simplificados: removidos `p-[var(--gc-mobile-frame-pad)] sm:p-2 md:p-3`, `rounded-[var(--gc-mobile-shell-radius)]`, `border-0 sm:border sm:border-primary/20` — o conteudo agora ocupa 100% do viewport sem moldura. `components/chat/ChatContainer.tsx` teve o label do botao de sugestao encurtado de `Preencher<span class="hidden 2xl:inline"> no composer</span>` para `Usar`.

Notes:
Validacao desta rodada: `npx tsc --noEmit`, `npm run build` e Playwright/Chrome confirmando `padding: 0px`, `borderWidth: 0px`, `borderRadius: 0px` no shell e label `Usar` nos cards. Commits: `a2ee903` (layout) e `c2bb8c0` (label).

### 2026-06-14 00:41 - Remocao de fontes inline redundantes quando ja ha citations

Context:
Anders reportou respostas em que o texto vinha com dominios por extenso no corpo, enquanto o `MessageBubble` ja mostrava a bandeja de `Referencias` com os mesmos links logo abaixo.

Details:
`lib/artifacts/messageArtifacts.ts` passou a limpar mencoes inline redundantes de hostnames/URLs quando elas correspondem a `message.citations` (incluindo formatos como `(example.com)`, `[Fonte: example.com]` e linhas isoladas so com o dominio). `components/chat/MessageContent.tsx` aplica essa limpeza no render do texto e dos documentos inline. `lib/chat/streamMachine.ts` e `lib/chat/responseToMessagePatch.ts` passaram a persistir o conteudo ja saneado quando as citations estruturadas chegam. `hooks/useChat.ts` e `lib/server/chatBackgroundJob.ts` repassam citations ao gerar artifacts/documentos. `lib/prompts/systemPrompt.ts` ganhou instrucao curta para o modelo nao repetir dominio cru no corpo quando as citacoes estruturadas ja existirem. Testes novos/cobertos: `lib/artifacts/messageArtifacts.test.ts`, `lib/chat/streamMachine.test.ts`, `lib/chat/responseToMessagePatch.test.ts`.

Notes:
Validacao desta rodada: `npm test -- lib/artifacts/messageArtifacts.test.ts lib/chat/streamMachine.test.ts lib/chat/responseToMessagePatch.test.ts lib/formatting/chatMarkdown.test.ts`, `npx tsc --noEmit` e `npm run build`. Se aparecer outra variante de redundancia de fonte, revisar primeiro o helper `cleanCitationMarkers(...)` antes de esconder a bandeja de referencias ou mexer no markdown renderer.

### 2026-06-14 00:51 - Indices inline [n] alinhados com a bandeja de referencias

Context:
Depois da limpeza inicial, Anders pediu um acabamento melhor: manter referencia inline, mas como indice numerico `[1]`, `[2]`, em vez de dominio por extenso ou parenteses vazios ao final dos paragrafos.

Details:
`lib/artifacts/messageArtifacts.ts` agora converte `【1†...】` em `[1]`, troca fontes inline redundantes por indices numericos de acordo com a ordem das `message.citations` e avanca referencias do mesmo hostname seguindo a ordem das URLs recebidas. Tambem cola referencias isoladas de volta ao fim do paragrafo e remove cascas vazias como `()`, `([])` e `([1])` quando necessario. `components/chat/MessageBubble.tsx` passou a renderizar o mesmo indice `[n]` em cada chip da bandeja `Referencias`, para o corpo da resposta apontar claramente para a lista abaixo. Testes focados atualizados em `lib/artifacts/messageArtifacts.test.ts`, `lib/chat/streamMachine.test.ts` e `lib/chat/responseToMessagePatch.test.ts`.

Notes:
Validacao desta rodada: `npm test -- lib/artifacts/messageArtifacts.test.ts lib/chat/streamMachine.test.ts lib/chat/responseToMessagePatch.test.ts lib/formatting/chatMarkdown.test.ts`, `npx tsc --noEmit`, `npm run build`, `systemctl restart chatgpt.service` e health local/publico `healthy`. O restart continua tendo uma janela curta em que o `curl` pode falhar antes do `next-server` reassumir a porta `3040`; confirmar `systemctl is-active chatgpt.service` e rebater o health depois disso.

### 2026-06-17 17:12 - Memory tools visiveis ao modelo

Context:
Adicionadas duas function tools para o modelo operar a memoria dinamica do Gaucho Chat sob controle do backend: `remember_memory` para salvar memorias explicitas e `search_memory` para recuperar chunks historicos do RAG quando o usuario pedir mais contexto.

Details:
`lib/server/chatRequest.ts` expoe as function tools apenas em `responseMode="default"`; quiz/document/deepsearch seguem sem essas tools. `lib/openai/contextBuilder.ts` injeta a policy de uso so quando as tools estao habilitadas. `lib/server/memory/toolExecutor.ts` executa as chamadas com validacao leve, usando `searchMemoryContext` e `createMemory`. `lib/server/chatToolOrchestrator.ts` envolve a Responses API em streaming e nao-streaming com ate duas rodadas de function-call/output antes de finalizar a resposta. `/etc/apache2/APACHE.md` documenta `/chat/api/memory/*`.

Notes:
Validacao desta rodada: `npm test -- lib/server/chatRequest.test.ts lib/openai/contextBuilder.test.ts lib/server/memory/toolExecutor.test.ts`, `npx tsc --noEmit`, `npm test`, `npm run build`, ESLint focado, `git diff --check`, `systemctl restart chatgpt.service` e health local/publico `healthy`. O lint amplo continua conhecido por ter falha pre-existente em `components/workspace-v2/AgendaPanelV2.tsx`; nesta rodada foi usado lint focado nos arquivos tocados.

### 2026-06-18 01:15 - Drifts de documentacao reduzidos

Context:
Rodada curta de documentacao para alinhar os handoffs ao estado real apos Persona com prompt principal e memory tools/RAG.

Details:
`README.md`, `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/MODELS.md`, `docs/README.md`, `CLAUDE.md` e o topo deste `AGENTS.md` foram atualizados para refletir: default `gpt-5.4-mini`, preview somente-leitura do prompt principal na aba Persona, `/api/memory/*`, LanceDB em `data/memory-index`, embeddings `text-embedding-3-small`, memory tools apenas no modo default, `image_generation` apenas no modo default, `web_search_preview` nos modos nao-quiz e `code_interpreter` opt-in. O bloco "Estado Atual Do Projeto" agora deve prevalecer sobre rodadas historicas antigas em caso de conflito.

Notes:
Validacao desta rodada: buscas focadas de termos propensos a drift e `git diff --check` nos markdown tocados. Sem mudanca de codigo ou infra.

### 2026-06-21 15:09 - TTS em FLAC como padrao experimental

Context:
Anders suspeitou que a qualidade percebida do TTS podia estar sendo limitada pelo codec MP3. A decisao foi priorizar qualidade de playback e deixar download completo como recurso secundario.

Details:
`ttsPreferences` agora inclui `format`, normalizado em `lib/tts/speechText.ts`, com default `flac` e alternativas `mp3`/`wav`. A rota `app/api/tts/route.ts` repassa `response_format` para a OpenAI e responde com `audio/flac`, `audio/mpeg` ou `audio/wav`. `SettingsDrawer` mostra seletor de formato, e `useAssistantTts` inclui formato na cache key e no request. Download completo segue habilitado apenas em `mp3`, porque concatenacao simples de chunks `wav`/`flac` nao garante arquivo unico valido.

Notes:
Validacao desta rodada: `npm test -- lib/tts/speechText.test.ts lib/persona/persona.test.ts`, `npm test`, `npx tsc --noEmit` e `npm run build`. Se houver queixa de compatibilidade ou qualidade, testar A/B com a mesma frase entre `flac`, `wav` e `mp3` antes de mexer em modelo ou instrucoes de voz.

### 2026-06-21 15:20 - Lembrete de push remoto pendente

Context:
Anders pediu registrar que a proxima rodada deve enviar os commits locais ao remoto.

Details:
O commit `b7cbb1a Add Pulse workflows and FLAC TTS` foi criado localmente depois das validacoes finais e do restart healthy do `chatgpt.service`, mas nao houve `git push`.

Notes:
Na proxima sessao, verificar `git status --short --branch`; se `main` continuar apenas a frente de `origin/main` e sem worktree suja, executar `git push origin main`.

### 2026-06-22 16:30 - Deepsearch e Documento com reconciliacao resiliente

Context:
Anders pediu robustez de conveniencia para pesquisas longas em celular, especialmente Deepsearch/Documento, quando o navegador minimiza ou e morto pelo sistema.

Details:
O fluxo existente de `background: true` foi mantido e ganhou metadados persistentes em `data/chat-background-jobs.json`. `lib/server/chatBackgroundJobStore.ts` controla upsert, update, listagem de pendentes e poda de jobs terminais. `/api/chat/background`, `/sync` e `/cancel` atualizam esse store; `/api/chat/background/reconcile` recupera jobs pendentes por `response_id` e tambem importa conversas legadas com `backgroundJob.responseId` pendente. `hooks/useChat.ts` chama reconciliação no bootstrap, no retorno de visibilidade e ao carregar conversa com job pendente.

Notes:
Escopo intencional: apenas `document`, `deepsearch_medium` e `deepsearch_high`; sem timer novo, push notification, TTS, imagem ou chat default. `data/chat-background-jobs.json` e runtime privado e fica ignorado pelo Git. Quando mexer nesse fluxo, validar pelo menos store/rota de reconcile, `npx tsc --noEmit`, `npm test` e build antes de restart.

### 2026-06-25 01:33 - Realtime mini como motor principal local de leitura

Context:
Anders decidiu promover o Realtime de experimento para motor principal de leitura do app local/pessoal, mantendo o TTS clássico como escape hatch manual para download/export completo e comparação.

Details:
`types/index.ts` e `lib/tts/speechText.ts` agora persistem `ttsPreferences.engine` (`realtime`/`speech`) e `ttsPreferences.realtimeModel` (`gpt-realtime-mini`, `gpt-realtime-1.5`, `gpt-realtime-2`), com defaults `realtime` + `gpt-realtime-mini`. `app/api/realtime/tts-call/route.ts` passou a aceitar `model` via query sem mexer no shape GA da sessão (`type: "realtime"`, `output_modalities`, `audio.output.voice`). Foi criada a camada compartilhada `hooks/useMessageTts.ts`, que escolhe a engine principal e impede playback duplicado; o novo `hooks/useRealtimeMessageTts.ts` substitui o papel de laboratório por um fluxo local de produção com chunking compartilhado, fila sequencial por WebRTC, seek aproximado por chunk, sem fallback automático para `/api/tts`. `components/chat/QuickActionsBar.tsx`, `components/chat/MessageTtsPlayer.tsx`, `components/workspace-v2/PulsePanelV2.tsx` e `components/settings/SettingsDrawer.tsx` passaram a usar o mesmo contrato de playback e a mesma preferência global de engine. Chat e Pulse agora andam juntos nessa decisão.

Notes:
Escopo conscientemente limitado: sem microfone, VAD, tool use por voz ou promoção imediata para `gpt-realtime-2`. O download consolidado continua clássico-only. Validação de código desta rodada: testes focados de TTS/persona/rota/player e `npx tsc --noEmit`; antes de chamar isso de totalmente assentado no uso diário, fazer smoke auditivo real em `/chat` com resposta curta, resposta longa e um card de Pulse para medir estabilidade do autoplay e truncamento perceptível.

### 2026-06-25 08:17 - Reversão do Realtime principal para o modelo híbrido anterior

Context:
Depois de refletir melhor, Anders preferiu desfazer a promoção do Realtime a motor principal universal. O objetivo voltou a ser: TTS clássico como padrão em qualquer mensagem, `Realtime mini` como opção paralela no chat e Pulse restrito ao TTS normal para leituras maiores/mais estáveis.

Details:
`components/chat/QuickActionsBar.tsx` voltou ao arranjo anterior: botão principal `Ler em voz alta` usa `useAssistantTts`, e o `Realtime mini` reaparece como ação separada/opcional no mesmo balão via `useRealtimeTtsLab`. `components/workspace-v2/PulsePanelV2.tsx` voltou a usar apenas `useAssistantTts`, removendo Realtime do Pulse. `types/index.ts`, `lib/tts/speechText.ts`, `lib/persona/persona.test.ts`, `lib/tts/speechText.test.ts`, `app/api/realtime/tts-call/route.ts` e `route.test.ts` foram limpos das preferências extras `engine`/`realtimeModel` e da seleção de modelo por query. Os arquivos introduzidos só para o Realtime principal (`hooks/useMessageTts.ts`, `hooks/useRealtimeMessageTts.ts`, `lib/tts/messageTts.ts`, `components/chat/MessageTtsPlayer.tsx` e respectivo teste) foram removidos.

Notes:
Isto restaura o desenho que separa melhor os usos: Speech API estável para tudo, inclusive Pulse, e Realtime como trilha de comparação para respostas de chat. Se quisermos revisitar Realtime como principal no futuro, convém começar por um escopo menor e manter o Pulse fora dessa troca até existir prova clara de ganho em respostas longas.

### 2026-06-25 08:39 - Botao Realtime explicito ao lado do alto-falante

Context:
Depois da reversão, Anders ainda via apenas o botão único de alto-falante no app vivo. O problema prático era mistura de bundle antigo no serviço e baixa descoberta visual do ícone Realtime.

Details:
`components/chat/QuickActionsBar.tsx` agora mantém a ação principal `Ler em voz alta` no alto-falante e mostra o Realtime como botão textual `Realtime` na mesma barra, com `flex-wrap` para não sumir em larguras menores. O player clássico continua exibindo controles de chunk/progresso/download, e o Realtime segue usando `useRealtimeTtsLab` como sessão WebRTC opcional, sem virar engine principal.

Notes:
Validação desta rodada: `git diff --check`, `npx tsc --noEmit`, `npm run build`, `npm test`, restart de `chatgpt.service` e health local/público em `/chat/api/health`. Se o botão não aparecer no navegador do Anders, primeiro forçar refresh/cache do browser antes de mexer de novo no contrato de TTS.

### 2026-06-27 17:05 - Streaming mais fluido com coalescencia por frame

Context:
Anders percebeu aquecimento do aparelho durante respostas longas em streaming. O comportamento desejado foi preservado: markdown continua renderizando como markdown desde o primeiro momento ate o final, sem trocar para texto limpo intermediario.

Details:
`lib/chat/streamPatchScheduler.ts` foi criado para coalescer multiplos patches de SSE no maximo em uma atualizacao de React por frame. `hooks/useChat.ts` agora agenda os patches de `assistantStreamStateToMessagePatch(streamState)` pelo scheduler durante o loop SSE, com `flush()` antes de completar, abortar ou tratar erro, e `cancel()` no `finally`. `lib/chat/streamPatchScheduler.test.ts` cobre coalescencia, flush sincrono e cancelamento. A experiencia visual ficou mais fluida no uso real, sem alterar o contrato de markdown, artifacts, reasoning ou persistencia.

Notes:
Validacao desta rodada: teste focado de stream, `npm test` completo (63 arquivos / 202 testes), `npx tsc --noEmit`, `npm run build` e `git diff --check`. Depois do build, surgiu `ChunkLoadError` em aba antiga porque `chatgpt.service` ainda servia bundle anterior; foi feito `systemctl restart chatgpt.service`, com health local/publico healthy e todos os chunks atuais de `/chat/login` respondendo 200. Se reaparecer `ChunkLoadError` apos build, primeiro alinhar runtime com restart do `chatgpt.service` e pedir refresh forte da aba.

### 2026-06-28 14:40 - Harmonizacao mobile fina e seletor de modelo mais largo

Context:
O layout mobile recebeu uma passada paralela via Open Code para harmonizar densidade do shell e do composer. Faltava registrar o formato final nas docs e dar um pouco mais de respiro ao seletor de modelo, porque o composer passou a ter sobra horizontal util.

Details:
`app/globals.css` e `components/workspace-v2/WorkspaceLayoutV2.tsx` consolidam o contrato mobile atual com header mais baixo, footer do composer mais enxuto, textarea menor e controles redistribuidos na primeira faixa: anexos, modelo, reasoning, pesquisa, `Rec` e envio. A antiga barrinha inferior de `Arquivo`/`Imagem` foi removida e substituida por um menu unico de paperclip. `components/workspace-v2/CommandComposerContainerV2.tsx` aumentou a bolha de selecao de modelo para `max-w-[9rem]` no mobile e `md:max-w-[10rem]`, preservando truncamento e altura compacta, mas deixando os nomes respirarem melhor. `docs/ARCHITECTURE.md` foi atualizado para refletir essa harmonizacao e o alias `chat-latest` / `GPT-5.5 Instant` no seletor.

Notes:
Validacao desta rodada: teste focado de `components/workspace-v2/WorkspaceLayoutV2.test.tsx`. Se a bolha ainda parecer curta em uso real, continuar ajustando primeiro em `CommandComposerContainerV2.tsx` antes de mexer no contrato global `--gc-mobile-control-*`.

### 2026-07-05 18:15 - PDF A4 limpo e fechamento de arvore

Context:
Anders pediu remover a opcao de imprimir do painel A4 e limpar o cabecalho grande do PDF exportado, mantendo a essencia visual do documento.

Details:
`components/workspace-v2/canvas/ArtifactPreviewSheet.tsx` removeu o botao/fluxo de imprimir e preservou apenas exportar PDF e baixar fonte. `lib/server/documentArtifactPdf.ts` substituiu o bloco grande de cabecalho/metadados (`Gaucho Chat`, `Documento A4 exportavel`, `Exportado em`, `PDF A4`) por um lockup compacto com icone OpenAI ao lado do titulo. O PDF agora usa Lexend embutida via `@fontsource/lexend`, sem depender de rede no Playwright. `lib/server/documentArtifactPdf.test.ts` cobre a ausencia do cabecalho antigo e a presenca do novo lockup.

Notes:
Validacao desta rodada antes do fechamento: `npm test`, `npx tsc --noEmit`, `npm run build`, restart de `chatgpt.service`, health local/publico healthy e smoke autenticado real de `/chat/api/artifacts/pdf` confirmando PDF 200 e ausencia do cabecalho antigo no texto extraido. A primeira chamada de health logo apos restart pode recusar conexao por janela curta; rebater depois que `next start` assumir a porta 3040.

### 2026-07-06 09:20 - DeepSeek V4 Pro no chat padrao

Context:
Anders pediu adicionar DeepSeek V4 Pro ao seletor junto dos modelos existentes, mas sem mexer nos harness/fluxos OpenAI que ja estao funcionando.

Details:
`deepseek-v4-pro` foi adicionado ao catalogo como provider DeepSeek separado, com `reasoningEffort` travado em `xhigh` e `verbosity` em `high` no estado/UI. `/api/chat` agora desvia somente o chat padrao streaming desse modelo para `https://api.deepseek.com/chat/completions` usando `DEEPSEEK_API_KEY`, `thinking` habilitado e `reasoning_effort: "max"`, adaptando chunks para os eventos SSE internos do front. OpenAI Responses continua igual para os demais modelos, e Documento/Deepsearch/Quiz nao usam DeepSeek.

Notes:
`DEEPSEEK_API_KEY` foi documentada em `.env.example` e adicionada ao `.env.production` ignorado pelo Git a partir do fish sem expor valor. `/etc/apache2/APACHE.md` foi atualizado para registrar o novo provider em `/chat/api/chat`. Validacao desta rodada: teste focado DeepSeek/settings/chatRequest, `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run lint`, `git diff --check`, restart de `chatgpt.service`, health local/publico 200 e smoke autenticado real de DeepSeek com SSE 200 + `[DONE]`.

### 2026-07-06 09:55 - Fresh web context para DeepSeek via OpenAI

Context:
Anders sugeriu um loop externo para o DeepSeek se atualizar usando o harness OpenAI, sem contratar motores de busca pagos por fora.

Details:
`lib/server/deepseekChat.ts` ganhou a function tool `fresh_web_context`. O primeiro turno DeepSeek pode chamar essa ferramenta; o servidor acumula `tool_calls` do stream, chama OpenAI Responses com `web_search_preview`, `reasoning: low` e `text.verbosity: high`, injeta o resultado como mensagem `tool` e faz um segundo turno DeepSeek sem ferramentas para streamar a resposta final. O modelo do harness e configuravel por `DEEPSEEK_WEB_CONTEXT_MODEL`, com fallback `gpt-5.4-mini`.

Notes:
O fluxo e propositalmente limitado a uma rodada de busca por mensagem para evitar loop/custo imprevisivel. `reasoning none` nao foi usado no harness porque o projeto ja validou que tools como `web_search_preview` rejeitam efforts baixos demais; `low` e o menor seguro aqui.

### 2026-07-07 12:35 - Realtime TTS em GPT-Realtime-2.1 mini sem teto de tokens

Context:
Anders pediu verificar se o Realtime TTS estava sendo serrado por `max_tokens` e atualizar para o modelo novo mais barato.

Details:
`app/api/realtime/tts-call/route.ts` agora usa `gpt-realtime-2.1-mini` no `session.model`. O payload continua sem `max_output_tokens` no `session` e o evento client-side `response.create` segue sem cap, deixando o contrato GA do Realtime usar o default `inf`. `app/api/realtime/tts-call/route.test.ts` cobre o modelo novo e falha se `max_output_tokens` voltar ao multipart.

Notes:
Documentacao corrente atualizada em `README.md`, `docs/API.md`, `docs/ARCHITECTURE.md` e `docs/MODELS.md`. O TTS classico permanece em `/api/tts` com `gpt-4o-mini-tts`; Realtime 2.1 mini segue como botao opcional separado nos baloes do chat e nao entrou no Pulse.

### 2026-07-11 16:03 - GPT-5.6 Sol/Luna e modo Pro

Context:
O chat precisava incorporar os modelos GPT-5.6 e expor o novo modo de reasoning Pro sem abandonar os fluxos internos que ainda usam GPT-5.4 mini.

Details:
`gpt-5.6-luna` virou o default do chat com reasoning `low/standard`; `gpt-5.6-sol` inicia em `medium/standard`. Sol e Luna oferecem effort `max` e um raio no compositor que alterna `reasoning.mode="pro"` independentemente do cerebro. GPT-5.4 mini permanece permitido no backend, mas oculto do seletor e migra para Luna quando selecionado no store. O SDK OpenAI foi atualizado para `6.46.0`, e o servidor remove `mode`/effort incompatíveis antes de chamar a API.

Notes:
Validacao: 233 testes, `npx tsc --noEmit`, `npm run build`, smokes reais Luna Standard/Luna Pro/Sol Pro, restart de `chatgpt.service`, health local/publico e smoke Playwright mobile autenticado. No prompt minimo, Luna Standard usou 12 tokens de entrada; os casos Pro contabilizaram 1.526, reforcando Pro desligado por padrao.

### 2026-07-11 16:29 - Audit npm zerado sem force

Context:
O upgrade do SDK OpenAI revelou 13 advisories npm, incluindo jsPDF critico e Next.js alto na superficie de producao.

Details:
`jspdf` foi atualizado para `4.2.1`, `next` e `eslint-config-next` para `16.2.10`. Overrides escopados mantem `dompurify@3.4.12` apenas sob Monaco e `postcss@8.5.17` apenas sob Next, evitando os downgrades quebradores sugeridos pelo audit. `npm audit fix` sem `--force` atualizou somente transitivas restantes de desenvolvimento. A regra de cookies/Apache adicionada no topo deste documento permanece intacta.

Notes:
Validacao: `npm audit` e `npm audit --omit=dev` com zero vulnerabilidades, 234 testes, TypeScript, build, lint, smoke unitario jsPDF, exportacao PDF real no browser, restart e health local/publico healthy.

### 2026-07-11 16:57 - Perfis de pesquisa e experimento Mini/Terra no Pulse

Context:
Anders quis aproveitar a baixa latencia do GPT-5.6 Luna no contexto web do DeepSeek, reforcar o Deepsearch Medium e comparar Mini contra Terra por rotina Pulse.

Details:
`fresh_web_context` usa agora `gpt-5.6-luna/low`, inclusive no override de producao. Deepsearch Medium passou a `gpt-5.4-mini/high`; High permanece `gpt-5.4/high`. Cada rotina Pulse salva `gpt-5.4-mini` (default) ou `gpt-5.6-terra` (experimental), ambos com reasoning `medium`; runs novos registram `modelUsed` e `reasoningEffort`. Rotinas antigas sem campo de modelo sao lidas como Mini sem reescrever o JSON privado. Overrides globais Pulse continuam disponiveis.

Notes:
Validacao: audit zero, 71 arquivos/242 testes, TypeScript, build, lint, restart, health local/publico e smoke autenticado do formulario Mini/Terra sem criar rotina. O aviso de escopo de cookies/Apache no topo deste documento permanece intacto.

### 2026-07-16 06:50 - Ciclo de vida confiavel para o RAG de memoria

Context:
A busca semantica e a tool `search_memory` funcionavam, mas o LanceDB mantinha 92 chunks de 24 conversas ja removidas enquanto a conversa atual interrompida ainda nao estava indexada. Os helpers client-side tambem escondiam respostas HTTP de erro.

Details:
`lib/server/memory/indexStore.ts` ganhou exclusao por conversa e reconciliacao contra todos os IDs canonicos. O DELETE de conversa limpa o indice antes do JSON, e o bulk index remove orfaos antes de indexar o recorte recente. `lib/chat/memoryRefresh.ts` centraliza o refresh: estados terminais indexam, mas somente `completed` gera sugestoes. `hooks/useChat.ts` aplica isso a sucesso, abort, falha e normalizacao `streaming` -> `interrupted`. O cliente RAG agora propaga erros e retorna estatisticas, exibidas no toast de indexacao manual.

Notes:
Validacao: 76 arquivos/256 testes, `npx tsc --noEmit`, `npm run build`, `git diff --check`, restart de `chatgpt.service` e health local/publico healthy. A reconciliacao real removeu 24 conversas/92 chunks orfaos e deixou 1 chunk da unica conversa canonica; busca exata retornou a origem em primeiro lugar com score 0.8462, e o smoke do chat fez uma chamada `search_memory`, recebeu 1 resultado e concluiu duas rodadas SSE. O backup pre-reconciliacao foi removido apos a confirmacao do Anders.

### 2026-07-17 21:50 - Documentacao canônica realinhada ao runtime atual

Context:
Anders pediu organizar a documentacao para espelhar o projeto, usando subagentes apenas para scouting read-only.

Details:
`README.md`, `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/INFRASTRUCTURE.md`, `docs/MODELS.md`, `docs/README.md`, `CLAUDE.md`, `.env.example` e `.codex_remember/remember.md` foram alinhados ao runtime atual: Next `16.2.10`, OpenAI SDK `6.46.0`, chat default `gpt-5.6-luna`, DeepSeek V4 Pro como provider separado somente no chat padrao streaming, `fresh_web_context` em `gpt-5.6-luna`, Deepsearch Medium/High corretos, Pulse Mini/Terra com reasoning `medium`, transcricao NDJSON e variaveis documentaveis sem segredos. Os docs de Agenda/Notas foram rebaixados para legado/historico no indice, porque Pulse e a superficie recorrente atual.

Notes:
Validacao documental: scouting do runtime e do inventario de docs, busca por claims antigos nos docs canonicos e `git diff --check` nos arquivos tocados. Nao houve restart/build porque a rodada foi documental/config example, sem alterar codigo de runtime.

### 2026-07-22 - Mini-player de audio compartilhado entre chat e Pulse

Context:
Os controles TTS e Realtime estavam espalhados em acoes e players diferentes, enquanto Pulse mantinha uma implementacao propria apenas para o TTS classico.

Details:
`components/chat/MiniAudioPlayer.tsx` passou a ser a superficie unica aberta pelo alto-falante no chat e no Pulse. O player inicia selecionado em TTS padrao, sem autoplay, e oferece troca manual para Realtime 2.1 com exclusao mutua de playback. `SettingsDrawer` explicita quais preferencias sao compartilhadas, `speechText.ts` reconcilia vozes validas e a sessao Realtime recebeu instrucoes de cadencia mais fluida. Testes cobrem o componente compartilhado, os entry points e o contrato de voz/session.

Notes:
O TTS padrao preserva fila, seek, progresso e download; Realtime permanece experimental e sem `max_output_tokens` explicito. Validacao: 80 arquivos/270 testes, TypeScript, build, `git diff --check`, restart, health local/publico e smoke Playwright desktop/mobile com zero requests ao abrir o player. O lint completo manteve falha pre-existente em `CommandComposerContainerV2.tsx:228`, fora deste diff.

### 2026-07-24 23:50 - Gemini 3.6 Flash no chat padrao

Context:
Anders pediu adicionar o provider Gemini mais novo ao seletor, com niveis de reasoning e as tools nativas Google Search e URL Context, preservando os fluxos OpenAI existentes.

Details:
`gemini-3.6-flash` foi adicionado ao catalogo como provider separado apenas para chat padrao streaming, com thinking `minimal`, `low`, `medium` ou `high` e default `medium`. `lib/server/geminiChat.ts` usa `@google/genai` Interactions API em modo stateless (`store=false`), converte o historico e imagens para steps, expoe Google Search + URL Context e traduz texto, summaries, tools, citacoes e usage para o SSE atual. Documento, Deepsearch e Quiz continuam forcando OpenAI. `GEMINI_API_KEY` foi provisionada no `.env.production` ignorado sem exposicao e o arquivo passou a permissao `600`; `/etc/apache2/APACHE.md` e os docs canonicos foram alinhados.

Notes:
Validacao: 82 arquivos/285 testes, `npx tsc --noEmit`, build Next completo, lint limpo nos arquivos Gemini, restart de `chatgpt.service`, health local/publico 200, smoke autenticado real com SSE `[DONE]`, texto, reasoning, duas etapas de tooling, citacao e usage, mais QA Playwright confirmando Gemini no seletor e os quatro niveis. O lint completo ainda tem a falha pre-existente em `CommandComposerContainerV2.tsx:229`; `npm audit` passou a reportar 3 advisories altos em Next/PostCSS/Sharp, corrigiveis por upgrade separado para Next 16.2.11.

### 2026-07-26 14:05 - Lint React e cadeia produtiva de seguranca corrigidos

Context:
Anders autorizou investigar e corrigir a falha de lint do composer e os advisories altos encontrados depois da integracao Gemini.

Details:
O preview incremental do STT deixou de copiar estado por `useEffect`: `useSpeechToText` agora oferece callback opcional no ponto em que cada delta nasce, e `lib/chat/speechComposer.ts` preserva a composicao da mensagem com cobertura RED/GREEN. A varredura completa revelou outros estados sincronizados durante efeitos e refs lidas em render; Quiz passou a reinicializar por key de sessao, carregamentos iniciais Pulse/Notas/Memoria/Chat foram agendados por timers cancelaveis, e o TTS ganhou estado reativo de disponibilidade de download. Next e `eslint-config-next` subiram para `16.2.12`; overrides fixam PostCSS `8.5.23`, Sharp `0.35.3` e TypeScript-ESLint `8.65.0`, mantendo ESLint `9.39.5` porque os plugins oficiais ainda nao aceitam ESLint 10.

Notes:
Validacao: 83 arquivos/288 testes, ESLint completo sem erros, `npx tsc --noEmit`, build Next `16.2.12`, `npm audit --omit=dev` com zero vulnerabilidades, restart e health local/publico 200. O otimizador real retornou PNG 64x77 via Sharp `0.35.3`; QA Playwright autenticado passou em desktop/mobile, abriu o seletor e confirmou Gemini sem overlay ou excecoes. O metadata do layout foi corrigido para usar o icone PWA sob `/chat`, removendo o ultimo 404 e deixando o console zerado. Permanecem 9 advisories dev-only na cadeia dos plugins ESLint do Next, sem upgrade compativel publicado; nao foram mascarados com overrides de major.

### 2026-07-28 11:12 - Documentacao concentrada e legado comprovado removido

Context:
Anders pediu um levantamento amplo do projeto com poucos scouts read-only, concentracao dos docs e limpeza do que nao tinha mais uso.

Details:
A superficie canônica ficou em `README.md` + `docs/{API,ARCHITECTURE,INFRASTRUCTURE,MODELS,README}.md`; `CLAUDE.md` virou ponte curta e `BACKLOG.md` declara que nao ha PACK/BUNDLE ativo. Handoffs Agenda/Redesign e o plano Memory/RAG concluidos sairam do checkout, preservados no Git. Foram removidos `AgendaPanelV2`, print A4 client-side antigo, service worker desativado, estado `.superpowers`, a cadeia invisivel de custo e docs de export stale. Calendar/OAuth server-side e todos os dados runtime foram preservados. `html2canvas` e `@playwright/test` sairam das dependencias diretas; imports runtime antes transitivos foram declarados explicitamente.

Notes:
Validacao: scouting por tres agentes, Knip antes/depois, 83 arquivos/288 testes, TypeScript, lint completo, build Next `16.2.12`, `git diff --check`, `npm audit --omit=dev` com zero vulnerabilidades, restart de `chatgpt.service` e health local/publico `healthy`. Nenhuma rota ou porta mudou, entao `/etc/apache2/APACHE.md` foi apenas consultado.

### 2026-07-28 15:39 - Atmosphere Glass promovido a padrão visual

Context:
Anders aprovou como padrão a experiência visual dark/glass criada a partir da referência do Gaucho Chat e deixou a interpretação clara a critério do Codex, preservando integralmente o funcionamento do produto.

Details:
`app/globals.css` consolidou o sistema Atmosphere Glass com Midnight Glass no dark e Daybreak no light; `WorkspaceFrameV2` identifica o tema por `data-visual-theme="atmosphere-glass"`. A correção `2b7886f` elevou os tokens de cor Shadcn e `--gc-*` para `:root`/`.dark`, porque `Sheet`, dropdowns e outros portals Radix são montados diretamente sob `body` e não herdavam a paleta escopada ao shell. Geometria, ambientação, rail, balões e composer continuam restritos a `.gc-atmosphere-shell`. Acentos de seleção passaram a azul-frio; verde ficou reservado a online, salvo e sucesso.

Notes:
Não houve mudança de auth, providers, streaming, APIs, storage ou infraestrutura. Validação da implementação: 83 arquivos/288 testes, TypeScript, lint, build Next `16.2.12`, Playwright desktop dark/light e mobile, restart de `chatgpt.service`, health local/publico `200` e smoke público sem overlay, overflow ou erros de console. Commits da frente: `158c74d` (experimento), `9f0da47` (promoção a padrão) e `2b7886f` (portals/configurações).

### 2026-08-05 18:53 - Mermaid no Markdown do chat e Canvas

Context:
Os agentes já eram orientados a emitir blocos `mermaid`, mas o renderer tratava esses blocos somente como código, apesar de KaTeX já estar ativo para fórmulas.

Details:
`MermaidDiagram` renderiza SVG sob demanda com Mermaid `11.16.1`, tema claro/escuro, `securityLevel: strict`, alternância código/diagrama e fallback legível para sintaxe inválida. `chatMarkdownRenderer` encaminha fences Mermaid concluídos ao novo componente; `StreamingMarkdown` preserva o CodeBlock durante streaming/assentamento e promove o bloco ao diagrama quando a resposta termina. Testes protegem o roteamento e a transição real de `MessageContent`.

Notes:
Validação: 84 arquivos/293 testes, TypeScript, lint, build Next, `npm audit --omit=dev` sem vulnerabilidades, restart de `chatgpt.service`, health local/publico `200` e smoke Playwright público isolado confirmando SVG, fallback, toggle e zero page errors. O advisory dev-only de `brace-expansion` continua vindo da cadeia ESLint e já existia antes desta rodada. Exportação PDF server-side de Mermaid não foi ampliada neste experimento.

### 2026-08-06 - Gaucho Studio como pagina IDE separada

Context:
Anders escolheu a primeira direção visual do brainstorm: Midnight Glass com navegação de produto e explorer à esquerda, Monaco e console no centro, e assistente contextual à direita.

Details:
`/studio` ganhou shell autenticado próprio, projeto inicial TypeScript persistido em `localStorage`, abas/arquivos editáveis e execução local em Web Worker com rede bloqueada e timeout. `/api/studio/assist` reutiliza a chave OpenAI server-side com `store=false` e `tools: []`; o modelo só sugere código no chat lateral, sem modo agente nem aplicação automática. O rail do chat ganhou acesso direto ao Studio e o Studio retorna ao chat por navegação de página.

Notes:
A rota pública é `/chat/studio`; o proxy Apache existente de `/chat` já cobre a página e a API. Manter a fronteira read-only do assistente até Anders decidir conscientemente por autocomplete ou edição assistida. Validação final: 87 arquivos/302 testes, TypeScript, lint, build Next, `git diff --check`, restart de `chatgpt.service`, health local/público, smoke autenticado do SSE e QA Google Chrome desktop/mobile. O QA também provou Run local, persistência após reload, seletor de modelos, chat streaming e console sem erros; `design-qa.md` registra a comparação com a referência.

### 2026-08-06 11:39 - Fechamento Superpowers e CSP pública do Studio

Context:
Na validação fresca da árvore completa, o Studio funcionava localmente, mas o Chrome público bloqueava o Worker `blob:` do runner. O response carregava a CSP global do Apache e a CSP do Next; por interseção, a política global mais restritiva vencia.

Details:
O `<Location /chat>` em `/etc/apache2/sites-available/ultrassom.ai-optimized.conf` passou a alinhar a CSP do Apache à do app, incluindo `script-src blob:` e `worker-src 'self' blob:`. A mudança permaneceu dentro do bloco `/chat`, ao lado do `ProxyPassReverseCookiePath / /chat`, que não foi movido. `/etc/apache2/APACHE.md` e `docs/INFRASTRUCTURE.md` registram o contrato. `parseStudioWorkspace` também converte uma resposta `streaming` restaurada após reload em falha explícita, preservando conteúdo parcial quando existir.

Notes:
Validação fresca: 87 arquivos/303 testes, `npx tsc --noEmit`, ESLint completo, build Next, `npm audit --omit=dev` zero, `git diff --check`, secret scan limpo, Apache `Syntax OK`, `chatgpt.service` ativo, health local/público 200, página e SSE autenticados 200. O replay no Google Chrome público executou `Resultado: 42`, sem overflow desktop/mobile nem `pageerror`. Permanecem dois warnings não funcionais do Monaco por fallback do language worker ao thread principal; configurar esse worker dedicado é endurecimento futuro, não parte do bundle v1.

### 2026-08-06 12:25 - Revisão multiagêntica e hardening do Gaucho Studio

Context:
Anders pediu olhos externos focados somente na feature nova antes da integração Git. Três revisores read-only cobriram arquitetura/testes, segurança e experiência frontend; o agente principal consolidou e implementou apenas achados comprovados.

Details:
O runner deixou de depender apenas de stubs de APIs e passou a carregar de `/api/studio/runner`, rota autenticada cuja CSP pública efetiva inclui `connect-src 'none'`. O protocolo ganhou token privado e orçamento de mensagens/texto. O runner agora rejeita imports relativos com explicação clara, oferece Stop e associa o console ao arquivo realmente executado. O stream do assistente exige marcador terminal e preserva EOF/abort como `interrupted`. A persistência ganhou limite de histórico, flush no `pagehide`, tolerância a leitura bloqueada e fallback de quota que prioriza arquivos. O Explorer ficou acessível no mobile; o exemplo inicial passou a ser executável isoladamente, migrando apenas o conteúdo legado intocado.

Notes:
Validação final: 92 arquivos/318 testes, `npx tsc --noEmit`, ESLint completo, build Next `16.2.12`, `npm audit --omit=dev` zero, `git diff --check`, secret scan limpo, Apache `Syntax OK`, restart de `chatgpt.service` e health local/público 200. O smoke Google Chrome autenticado provou Run, associação do console, Stop, Explorer mobile, CSP restrita, zero requests externos na tentativa de rede, zero overflow, zero `pageerror` e zero erros de console. O SSE real retornou delta e `[DONE]`. O bundle continua aguardando revisão de Anders; resolução de grafo de imports, autocomplete e modo agente permanecem fora da v1.

### 2026-08-07 13:09 - Gaucho Studio Python Workspace: cliente, FIM e entrega viva

Context:
Continuação da frente aprovada de manhã (Tasks 1-5 já commitadas). Anders liberou a retomada e forneceu a senha do step-up auth para fechar a entrega.

Details:
Task 6 entregou o cliente do modo servidor com a lógica em lib pura (`lib/studio/serverWorkspace.ts`: parser SSE, árvore, autosave com debounce, máquina unlock/replay e controller testados em environment node), hook fino `useStudioServerWorkspace` via `useSyncExternalStore`, `StudioServerExplorer` novo, alternância Local ↔ Python no shell, modal de senha, console SSE ao vivo reusando `StudioConsole` (comando parametrizado) e ações salvar/restaurar/importar/resetar com `ConfirmDialog`. `"python"` entrou em `StudioFileLanguage`, badges, ícones e nas allowlists do assistente. Task 7 inverteu o contrato do FIM: python elegível no cliente, aceito no parser da rota e incluído no selector do `registerInlineCompletionsProvider` (lacuna não listada no plano). Task 8 definiu `STUDIO_WORKSPACE_PASSWORD` no `.env.production` (backup criado), reiniciou `chatgpt.service` e atualizou API.md, ARCHITECTURE.md, INFRASTRUCTURE.md, BACKLOG.md e CLAUDE.md.

Notes:
Validação: 462 testes, tsc, lint, build e `git diff --check` limpos; health local/público 200. Prova viva via API autenticada: run real com import local, log em arquivo (dono `studio`), OpenAI respondendo com a chave herdada do env (nunca em argv), `PermissionError`/`OSError` nas tentativas de escrita em `/root` e `/etc`, Stop matando loop infinito (`aborted` em 4 s), roundtrip salvar → resetar → restaurar byte a byte (sha256 idêntico), e negativos corretos (401 sem cookie, `studio_workspace_locked` sem token, senha errada rejeitada). Smoke Playwright em produção: unlock pela UI, árvore real, main.py aberto sozinho, run com console SSE ao vivo (268 ms), autosave UI→disco comprovado por mtime, ghost text FIM em python observado, zip salvo no archive e baixado pelo browser. Timeout do run segue coberto pela prova de `RuntimeMaxSec` da Task 1 + testes do runner (não re-provado ao vivo com env curto). `PRE_EXISTING_FAILURE`: advisory `pdfjs-dist` no `npm audit` (major 6.x, fora da frente). Commits locais sem push.

### 2026-08-12 20:20 - Studio Python-only, splitters e console interativo

Context:
Anders aprovou o Studio Python e pediu a retomada do aperfeiçoamento: remover a aba TypeScript (modo Local), permitir redimensionar os painéis e destravar o terminal, que era só um visor de saída. Terminal decidido em fases: stdin interativo agora, PTY completo como frente futura.

Details:
Modo Local removido por inteiro: `StudioExplorer`, runner Web Worker (`lib/studio/runner*`, `runnerProtocol*`), rota `GET /api/studio/runner`, `lib/server/studioRunner*`, compile TS do `StudioEditor` e CSP especial no `proxy.ts`. `useStudioWorkspace` virou `useStudioPrefs` com snapshot `version: 2` (autocomplete, modelo, histórico do assistente; migração de v1 preserva esses campos e descarta arquivos TS). Shell ganhou estados explícitos para servidor desabilitado e workspace bloqueado (cancelar a senha não cai mais em modo Local). Splitters: `lib/studio/layout.ts` (clamps puros, editor ≥ 460 px) + `hooks/useStudioLayout.ts` (CSS vars, pointer capture, persistência em `gaucho-studio:layout:v1`, duplo clique reseta, setas como acessibilidade, gate ≥ 1121 px/pointer fine). Console interativo: `writeStdin` no runner manager, rota `POST /api/studio/workspace/run/stdin` (8 KiB, 409 sem run), `sendStdin` no controller, campo de entrada no `StudioConsole` durante o run, eco como evento `command` no SSE e flush de linha parcial após 150 ms para prompts de `input()` sem newline.

Notes:
TDD red→green em runner (stdin, eco, flush parcial com prova de vida pré-close), controller, layout e console. Validação: 466 testes/101 arquivos, tsc, lint e build limpos. Prova viva em build de produção (porta 3999, Playwright headless): unlock, splitters arrastados com persistência pós-reload e reset por duplo clique, e script `input()` real na jail systemd mostrando o prompt enquanto bloqueado em stdin, eco `$ Fable` e resposta — arquivo temporário de teste removido depois. Docs atualizadas: API.md, ARCHITECTURE.md, README.md, CLAUDE.md e Estado Atual. Fase 2 do terminal (PTY restrito com xterm.js) registrada como frente futura, não iniciada.

### 2026-08-12 21:10 - Token do workspace em sessionStorage e Ctrl+Enter

Context:
Sequência imediata da entrega Python-only: Anders aceitou as sugestões pendentes — tirar o atrito do reload (senha de novo a cada F5) mantendo a senha como gate, e o atalho de execução.

Details:
`createServerWorkspaceController` ganhou `tokenStorage` injetável (default `window.sessionStorage`, chave `gaucho-studio:workspace-token:v1`): unlock persiste o token, 401 `studio_workspace_locked` limpa, e um controller novo restaura — reload na mesma aba não pede senha; fechar a aba, TTL de 60 min e restart do serviço seguem exigindo. Ctrl/Cmd+Enter executa o arquivo ativo: `addCommand` no Monaco (sobrescreve o insertLineAfter padrão) + listener global no shell, com guarda `runnable` e tooltip no botão Run.

Notes:
TDD red→green nos dois testes novos do controller (persistência/restauração e limpeza no locked); 468 testes, tsc, lint e build limpos. Smoke Playwright em build de produção: token gravado, reload sem modal com árvore carregada, Ctrl+Enter rodando de fora e de dentro do Monaco (run de teste interrompido via Stop). ARCHITECTURE.md atualizada; deploy com restart do chatgpt.service e health local/público 200.

### 2026-08-13 09:15 - Markdown preview no Studio (bundle 2 do pack v2)

Context:
Primeiro bundle executado do PACK "Gaucho Studio v2" aprovado por Anders: renderizar `.md` do workspace reusando o pipeline de markdown do chat.

Details:
`components/studio/StudioMarkdownPreview.tsx` renderiza o arquivo com `chatMarkdownComponents` (Mermaid, KaTeX com import do CSS, syntax highlight, tabelas GFM), deliberadamente sem `normalizeChatMarkdown` e sem `remarkBreaks` — heurísticas para saída de LLM que alterariam a semântica de um arquivo real (teste cobre soft wrap e parágrafo único). No `GauchoStudioShell`, quando o arquivo ativo é markdown a linha de breadcrumbs ganha o seletor `Código / Dividido / Preview` (default Dividido; estado local da sessão); o split é grid 1fr/1fr que empilha ≤ 860 px, com o Monaco vivo e o preview atualizando a cada tecla.

Notes:
TDD red→green em `StudioMarkdownPreview.test.tsx` (3 casos); 471 testes, tsc, lint e build limpos. Smoke Playwright em build de produção (porta 3999, jail real): três modos alternando corretamente, tabela/Mermaid/KaTeX renderizados, live-update de heading digitado, toggle ausente em `.py`; arquivo de teste removido do workspace ao final. Deploy com restart do chatgpt.service e health local/público 200. Próximo bundle: Terminal PTY (exige rodada de desenho).

### 2026-08-13 10:35 - Terminal PTY no Studio (bundle 1 do pack v2)

Context:
Desenho fechado com Anders na mesma manhã (SSE+POST; 1 sessão com idle-kill; painel próprio). Risco técnico nº 1 — `node-pty` encaminhando o PTY pra dentro da jail — foi eliminado por spike antes do plano: `systemd-run --pty` com as propriedades do runner passou 6/6 checks (uid studio, cwd /workspace, pip do venv, ProtectHome negando /root, TTY real, SIGWINCH propagado).

Details:
`lib/server/studioTerminal.ts` (TDD, 13 testes): `StudioTerminalManager` mantém uma sessão bash (`gaucho-studio-term-*`, `RuntimeMaxSec=8h` de backstop), idle-kill de 30 min resetado por input, buffer de replay de 200 KiB e um stream por vez; abort do SSE solta o stream sem matar a sessão (reanexo com replay — um `pip install` sobrevive a um toggle acidental da view). Rotas finas em `/api/studio/workspace/terminal/{stream,input,resize,close}` gated por `requireStudioWorkspaceAccess`. `lib/studio/terminalClient.ts` (TDD, 8 testes): parser SSE próprio, batch de teclas em 16 ms, resize com debounce de 150 ms, estados connecting/open/closed/error com `exitReason`. `components/studio/StudioTerminal.tsx` monta xterm.js + addon-fit (import dinâmico, client-only) com header de status e Encerrar/Nova sessão; no `GauchoStudioShell` a view toma a área editor/console (grid-row 1/-1), botão no topbar + Ctrl+` (via `event.code`, guardado por unlocked).

Notes:
495 testes (24 novos), tsc, lint e build limpos. Smoke Playwright em build de produção: unlock → terminal → `id` (uid studio), `pip --version` do venv, fechar/reabrir view com replay do buffer, Encerrar → "Sessão encerrada" → Nova sessão limpa, Ctrl+` alternando nos dois sentidos; zero units residuais no host ao final. Deploy com restart do chatgpt.service e health local/público 200. Dependências fixadas: `node-pty@1.1.0`, `@xterm/xterm@6.0.0`, `@xterm/addon-fit@0.11.0`. Decisão de paridade: o terminal herda `OPENAI_API_KEY` como o runner (mesmos scripts devem rodar via `python` no bash). Próximo bundle: aba notebook (exige rodada de desenho com Anders — kernel persistente).

### 2026-08-13 12:45 - Aba Notebook no Studio (bundle 3 do pack v2 — pack concluído)

Context:
Desenho fechado com Anders: ipykernel real, formato `.ipynb` nbformat v4, saída texto+PNG na v1; plano A "leve" aprovado por ele (helper `jupyter_client` fora da jail em vez de gateway HTTP — a jail não tem `PrivateNetwork`, então o ZMQ do kernel atravessa pela loopback compartilhada e o browser nunca vê porta de kernel). Spike 7/7 e depois validação viva do helper protocolizado 8/8 antes do TDD.

Details:
`lib/server/studio-kernel-bridge.py`: helper `jupyter_client` (JSON por linha no stdin/stdout — execute/shutdown entram; ready/stream/execute_result/display_data/error/done/fatal saem), `allow_stdin=False` (célula com `input()` erra claro em vez de travar), execution_count via execute_reply do shell, heartbeat detecta kernel morto. `lib/server/studioNotebookKernel.ts` (TDD, 13 testes): unit `gaucho-studio-kernel-*` na mesma jail do runner (`MemoryMax=1G`, `RuntimeMaxSec=8h`, connection file `.gaucho-kernel-*.json` no workspace com varredura de órfãos no spawn), 1 kernel por vez, idle-kill 30 min rearmado por execução, interrupt via `systemctl kill -s SIGINT`, shutdown gracioso com stop forçado após 5 s. Rotas `/api/studio/workspace/notebook/{stream,execute,interrupt,shutdown}` gated. `lib/studio/notebookFormat.ts` (TDD, 11 testes): parse/serialize nbformat v4.5 tolerante + reducers puros. `lib/studio/notebookClient.ts` (TDD, 7 testes): SSE + POSTs com token. `components/studio/StudioNotebook.tsx` (+4 testes de helpers): células code em Monaco python compacto (auto-altura, Ctrl+Enter executa, autocomplete FIM com `getLeadingContext` novo no provider concatenando células de código anteriores), markdown renderizado com toggle de edição, outputs stream/result/traceback (ANSI removido)/PNG inline, add/remover célula, header com status + Interromper/Reiniciar; abrir `.ipynb` troca a superfície do editor no `GauchoStudioShell` (badge NB).

Notes:
530 testes/109 arquivos (41 novos), tsc, lint e build limpos. Smoke Playwright em build de produção: unlock → demo.ipynb → "Kernel pronto" → célula 1 (stdout), célula `x` → 42 (estado persistiu), matplotlib → `image/png` inline; outputs e execution_count gravados no arquivo em nbformat válido; Reiniciar kernel → `x` vira NameError (estado zerado, unit antiga morta, 1 unit viva); zero units e connection files ao final. Deploy com restart do chatgpt.service e health local/público 200. Dependências no venv (pinadas): `ipykernel==7.3.0`, `matplotlib==3.10.5`. Extensão útil: varredura de connection files órfãos no spawn (o caso apareceu no próprio smoke quando o node de teste morreu com kernel aberto). `demo.ipynb` ficou no workspace como exemplo funcional. Fechar a view solta só o stream — kernel sobrevive pra reanexo. PACK Gaucho Studio v2 concluído (bundles 2, 1 e 3).

### 2026-08-14 11:05 - Correções pós-uso do Studio (explorer, faixa morta e chat mockup)

Context:
Feedback do Anders após usar terminal/scripts: explorer não refletia arquivos criados fora do Run, havia situação sem como selecionar arquivos, e o painel do assistente reabria sempre com uma conversa de mockup. Diagnóstico reproduzido em runtime (Playwright): (1) `loadTree()` só rodava no bootstrap e no finally do run — nada criado via terminal/kernel aparecia; a árvore ainda era inundada pelos dotfiles que a jail semeia no HOME (`.cache`, `.config`, `.ipython`, `.bash_history`, `.gaucho-kernel-*.json`); (2) faixa morta 600–1120 px: `.fileTree` era `display:none` no modo trilho e o overlay do explorador só existia ≤600 px (o botão "Arquivos" do mobile nav, 600–860, abria um overlay sem estilo); (3) a conversa demo semeada na era v1 (`studio-welcome-*`) era preservada pela migração v1→v2 e ficava eterna no localStorage.

Details:
`studioWorkspaceFs.ts`: `STUDIO_WORKSPACE_HIDDEN_DIRS` ganhou `.cache/.config/.ipython/.jupyter/.local` e novo `isHiddenWorkspaceFile()` (históricos de shell, `.bashrc`/`.profile`, `.gaucho-kernel-*.json`) aplicado na árvore e no zip de save (`studioWorkspaceZip.ts`); dotfile legítimo de projeto (`.env`) continua visível. `GauchoStudioShell.tsx`: re-sync da árvore no focus da janela, polling de 8 s enquanto o terminal está aberto e um refresh final ao fechá-lo; `StudioServerExplorer` ganhou botão "Atualizar arquivos" no projectRow e botão "Abrir explorador" no modo trilho. CSS: overlay do explorador movido para ≤1120 px como drawer (`min(100%, 21rem)`, serverActions visíveis), com overrides ≤860 (respeita mobile nav) e ≤600 (largura cheia). `workspace.ts`: `normalizeMessages` descarta ids `studio-welcome-*` em qualquer snapshot persistido.

Notes:
534 testes/109 arquivos (4 novos, red→green), tsc, lint e build limpos. Smoke Playwright em produção: árvore limpa sem runtime da jail; arquivo criado no filesystem apareceu via botão de refresh; em 1000 px o rail abre o drawer, arquivo novo abre no editor e o drawer fecha; localStorage com mockup injetado voltou ao estado vazio real do assistente. Deploy com restart do chatgpt.service e health local/público 200. Nota de comportamento: zips de "Salvar projeto" agora excluem o estado de runtime da jail (antes iam junto).

### 2026-08-14 19:01 - Explorer do Studio: criar arquivo/pasta, deletar e pastas interativas

Context:
Continuação do feedback do Anders sobre o explorer: a seleção de arquivos foi ajustada na entrega anterior, mas pastas continuavam `div`s inertes (sem clique, sem colapso, sem seleção) e não havia como criar nem excluir nada pela UI — as rotas de delete/rename existiam órfãs no servidor. Faltava também mkdir de pasta vazia no backend.

Details:
`studioWorkspaceFs.ts`: novo `createWorkspaceDirectory()` (mkdir recursivo com `resolveWorkspacePath`, `already_exists` se ocupado, ownership herdado da raiz) + rota `POST /api/studio/workspace/folder` gated. `serverWorkspace.ts`: controller ganhou `createFile(path)` (PUT vazio → loadTree → openFile), `createFolder(path)` (POST folder → loadTree) e `deleteEntry(path)` (DELETE → fecha abas do caminho e da subárvore, realoca aba ativa → loadTree); `openFile` virou função interna compartilhada; novo helper puro `filterVisibleTreeRows(rows, collapsedPaths)`. `StudioServerExplorer.tsx`: pasta virou botão com chevron rotativo (colapsa/expande via estado local + helper, `aria-expanded`) e seleção como destino de criação (`aria-pressed`, highlight); linha "workspace-python" seleciona a raiz; cluster de ações no projectRow (Novo arquivo/Nova pasta/Atualizar, `.treeActions`); toda linha (arquivo e pasta) tem botão Excluir revelado no hover (`.treeRow`/`.treeDeleteButton`). `GauchoStudioShell.tsx`: estado de pasta selecionada + dialog de criação (mostra o destino, guarda contra path já existente na árvore — PUT sobrescreveria) + ConfirmDialog de exclusão com aviso recursivo para pastas; clique em arquivo seleciona a pasta-mãe como destino.

Notes:
541 testes/109 arquivos (7 novos, red→green nas três camadas), tsc, lint e build limpos. Smoke Playwright em produção (1560 px): Nova pasta `validacao-ew` na raiz → apareceu selecionada; Novo arquivo `teste.py` com ela selecionada → criado aninhado, aba aberta, breadcrumb `validacao-ew › teste.py`; clique em `utils` colapsou os filhos e novo clique reabriu; Excluir do arquivo fechou a aba e devolveu o editor pro `main.py`; Excluir da pasta removeu do disco (conferido em `/root/studio-projects/active/`). Deploy com restart do chatgpt.service e health local/público 200. docs/API.md atualizado (rota `folder` + semântica de DELETE recursivo). Nota: rename segue só no backend, sem UI — candidato natural à próxima iteração se o Anders sentir falta.

### 2026-08-20 14:20 - Notebook modo Colab: rich outputs, UX de células, input() e assistente por célula

Context:
Anders quis aproximar o notebook do Studio de uma experiência Colab mantendo o Studio como está (notebook segue view, sem shell novo). Auditoria prévia do kernel concluiu que a fundação (ipykernel na jail + bridge ZMQ + nbformat) estava sólida; os limites da v1 viraram quatro frentes aprovadas: rich outputs, UX de células, kernel robusto e assistente nas células.

Details:
Bridge (`studio-kernel-bridge.py`): mimes ampliados para png/jpeg/svg/html/latex/markdown/plain com cap de 2 MB por mime (texto trunca com aviso, imagem descarta), evento `started` por célula, `allow_stdin` com repasse de `input_request` e `wait_for_input_reply` (executes recebidos durante o input vão para `pending_ops` e rodam depois). Manager (`studioNotebookKernel.ts`): eventos `cell_started`/`input_request`, método `inputReply`, `MemoryMax` 1G→2G. Rotas: nova `POST notebook/input`; `notebook/stream` ganhou ping SSE de 15 s + `cancel()` para soltar stream de aba morta (sem isso, aba fechada abruptamente deixava 409 stream_busy até o kernel morrer). Client (`notebookClient.ts`): eventos novos no parser e `inputReply`. UI (`StudioNotebook.tsx`): render de outputs por prioridade via `notebookOutputView.ts` (svg como data URI sem script; html sanitizado por `sanitizeNotebookHtml.ts` com DOMPurify sem `<style>`; latex/markdown via StudioMarkdownPreview; CSS para tabelas pandas), Shift+Enter/Alt+Enter, mover ↑/↓ (`moveNotebookCell`), divisores hover de inserção (`createNotebookCell`/`insertNotebookCell` extraídos para focar a célula nova), Executar tudo/acima com dispatches serializados, fila visível `[…]`, duração no gutter (`formatCellDuration`), campo inline de input() e assistente por célula (✦ no gutter; `POST /api/studio/assist` com `cell {intent, source, error}` e instrução dedicada de responder um único bloco python; preview streamado e "Aplicar na célula" via `extractPythonCodeBlock`). Deps: `dompurify@3.4.12` (mesma versão do override do monaco) e `jsdom@26.1.0` (dev, ambiente de teste; jsdom 30 exige Node > 20.19).

Notes:
568 testes/112 arquivos (27 novos, red→green por frente), tsc/lint/build limpos, deploy com restart e health local/público 200. Validação Playwright em produção 12/12 com notebook semeado: tabela pandas HTML, PNG matplotlib (exige `%matplotlib inline`), katex, traceback, input() respondido inline ("Buenas, Anders!"), fila, duração, mover célula e assistente corrigindo SyntaxError real. Bug pego na validação: os POSTs paralelos do run-all chegavam fora de ordem no servidor (a célula de input() bloqueou a fila na frente da célula de erro) — corrigido serializando os dispatches no client. pandas+matplotlib instalados no venv da jail. Achado lateral: três venvs acidentais na raiz do repo (`pip/`, `install/`, `selenium/`, criados 13:12 por um provável `python3 -m venv pip install selenium`) quebravam o Turbopack (symlink fora do project root); movidos para `/root/CHATGPT-quarentena-2026-08-20/` sem apagar. Notebook de validação `valida-colab.ipynb` permanece no workspace como demo.

### 2026-08-22 18:10 - Autocomplete do Studio migrado para Codestral (Mistral FIM)

Context:
Anders pediu pesquisa de compatibilidade do Codestral com o autocomplete FIM do Studio e a adoção da API key Mistral dele (encontrada no `config.fish`). Pesquisa confirmou: Codestral 25.08 (`codestral-latest`) segue referência em autocomplete (latência e RepoBench), com FIM nativo em `POST /v1/fim/completions` — request quase idêntico ao do DeepSeek, mas resposta em formato chat (`choices[0].message.content`) e `finish_reason` extra `model_length`.

Details:
`lib/server/studioAutocomplete.ts` ganhou tabela `STUDIO_FIM_PROVIDERS` com prioridade `CODESTRAL_API_KEY` (codestral.mistral.ai, plano dedicado) → `MISTRAL_API_KEY` (api.mistral.ai, pay-as-you-go, em uso) → `DEEPSEEK_API_KEY` (fallback legado). `createStudioFimClient` agora retorna `{ client, provider }`; a rota Mistral usa `client.post("/fim/completions")` do SDK OpenAI (rota não existe no SDK; o post cru preserva `OpenAI.APIError` e o tratamento 429/timeout da route, que não mudou). `model_length` normaliza para `length`; parâmetros mantidos (256 tokens, temp 0.1, timeout 8 s). Contrato do browser intacto — client não mudou. `MISTRAL_API_KEY` adicionada ao `.env.production`; `.env.example`, docs/API.md, docs/ARCHITECTURE.md e docs/MODELS.md atualizados.

Notes:
TDD red→green (7 falhas → 27 testes verdes no módulo+rota); suíte completa 571 testes, tsc/lint/build limpos. Deploy: restart `chatgpt.service`, health local/público 200, validação live autenticada: FIM respondeu `fib(n)` completo via Codestral (`finishReason: stop`). Rota de login para testes autenticados é `/api/auth/login` (não `/api/login`). Preço Codestral: $0.30/M in, $0.90/M out. Se quiser o plano gratuito dedicado, basta criar key em codestral.mistral.ai e definir `CODESTRAL_API_KEY` — a prioridade troca sozinha.

### 2026-08-28 11:28 - Realtime TTS mudo no iPhone: saída pelo elemento `<audio>` no WebKit

Context:
Anders relatou que só o TTS padrão produzia som; o Realtime 2.1 mini ficava mudo. Logs de `/var/log/chatgpt/error.log` e `ultrassom_ssl_access.log` mostraram 16 sessões Realtime hoje pelo iPhone (iOS 18.7/Safari) com `201` na rota, `peer.connection_state: connected`, `track.unmuted` e `audio.started` em 322–1915 ms — o áudio chegava ao navegador. O ramo de playback em `peer.ontrack` tocava o stream remoto por `createMediaStreamSource → AudioContext.destination` com o `<audio>` mudo; no WebKit esse nó com stream WebRTC remoto sai mudo/ínfimo (WebKit 230902, web-audio-api#1722) e Web Audio ainda respeita a chave de silêncio do iPhone. O TTS padrão usa `createBufferSource` (buffer decodificado), que funciona ali — por isso só ele soava.

Details:
`hooks/useRealtimeTtsLab.ts`: nova `prefersMediaElementForRemoteStream()` (iOS de qualquer browser + Safari desktop) faz `ontrack` ir direto para `playRemoteStreamWithElement` (elemento `<audio>` primado no clique, desmutado); Chromium mantém o caminho Web Audio inalterado. `playRemoteStreamWithElement` ganhou `reason` e o evento de telemetria `audio.output_path` (`element`/`web-audio`) passa a registrar qual saída rodou — antes `audio.started` era disparado incondicionalmente no ramo Web Audio e não provava som. Guarda após o fetch (`peerRef.current !== peer || signalingState === "closed"`) evita o `InvalidStateError` em `setRemoteDescription` visto nos logs quando o usuário parava/trocava de engine durante o handshake. Validação: `tsc`, `vitest` (player + rota, 6/6), `eslint` no arquivo, `npm run build`, restart `chatgpt.service`, health local/público 200, rota Realtime 401 sem cookie.

Notes:
Falta o smoke auditivo real no iPhone por Anders; se o elemento estourar `NotAllowedError`, a telemetria mostrará `audio.playback_failed` e o próximo passo é manter o `<audio>` vivo entre sessões em vez de recriá-lo no `cleanup()`. Logs de runtime do serviço vivem em `/var/log/chatgpt/{app,error}.log` (unit usa `StandardOutput=append`), não no journald.

### 2026-08-28 11:45 - Instruções de leitura padrão para TTS e Realtime + botão Restaurar padrão

Context:
Depois do fix do Realtime no iPhone, Anders pediu instruções de leitura boas para deixar como padrão. O default do app era `instructions: ""` e a preferência persistida dele (97 caracteres) sobrepõe qualquer default, então mudar só a constante não chegaria ao uso real.

Details:
`lib/tts/speechText.ts` ganhou `DEFAULT_TTS_INSTRUCTIONS` (PT-BR, 725 caracteres, abaixo do teto de 1200 do normalizador) cobrindo voz, tom, ritmo/pausas, pronúncia de números/siglas/medicamentos/inglês e fidelidade ao texto; `DEFAULT_TTS_PREFERENCES.instructions` aponta para ela, então persona nova e `normalizeTtsPreferences(undefined)` recebem o padrão, enquanto `""` explícito continua significando "sem instruções". `components/settings/SettingsDrawer.tsx` (aba Tuning → Voz) ganhou o botão `Restaurar padrão` ao lado do rótulo, que grava a constante via `updateTtsPreferences` (autosave persiste em `data/persona.json`), desabilitado quando já é o padrão; textarea com `id` + `label htmlFor`, `rows=5` e placeholder explicando o vazio. As instruções valem para `/api/tts` (`gpt-4o-mini-tts`) e são anexadas ao `response.create` do Realtime como `Voice style instructions`. TDD red→green em `lib/tts/speechText.test.ts`; `data/persona.json` não foi tocado.

Notes:
Validação: vitest focado 16/16, `tsc`, eslint nos arquivos, `npm run build`, restart `chatgpt.service`, health local/público 200. Para adotar o padrão, Anders abre Configurações → Tuning → Voz e toca `Restaurar padrão`; a preferência dele (`echo`, 1.1x, balanced) permanece até isso.

### 2026-09-03 01:48 - SoundCase pronto para revisão local

Context:
Nova terceira superfície Gaucho para transformar textos longos em leitura imediata por Realtime e arquivo final durável, com direção automática por Luna, capa, resumo, acervo privado e composição editorial responsiva. Anders escolheu reutilizar a mesma JWT/cookie do Chat e manter automático como padrão com overrides explícitos.

Details:
`/soundcase`, `components/soundcase/*` e `hooks/useSoundCase*` entregam folha autoexpansível, importação `.txt/.md`, direção, onda de progresso confirmado, Realtime segmentado, player/baixar, projetos e versões. `lib/server/soundcase/*` e `/api/soundcase/*` implementam storage privado atômico, revisão CAS com recovery local transitório até a confirmação, snapshots imutáveis, fila/lease/retomada, chunks FLAC concorrência 2, montagem MP3/FLAC/WAV, capa e assets autenticados com Range. A navegação Chat/Studio/SoundCase foi integrada; a JWT protege todas as rotas de usuário, `OPENAI_API_KEY` fica exclusivamente no servidor e o worker usa bearer próprio.

Notes:
Validação local final: 707 testes/138 arquivos, `npx tsc --noEmit`, build Next com `NEXT_PUBLIC_BASE_PATH=/chat` e `git diff --check` limpos; Chrome de produção em 1440x980, 900x980 e 390x844 sem erros de console, incluindo texto longo, resize/rotação, Acervo em tablet e navegação intermediária de Chat/Studio. Branch/worktree: `codex/soundcase` em `.worktrees/soundcase`. Não houve merge, push, instalação das units, alteração do Apache, restart público nem smoke pago; essas ações ficam para o gate de integração, pois as units apontam para `/root/CHATGPT` e o código ainda está isolado na worktree.
