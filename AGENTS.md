# AGENTS.md

## Visao Geral

Projeto de chat multimodal em `Next.js 16` com `React 19`, `TypeScript`, `Zustand` e `TanStack Query`, usando a `Responses API` da OpenAI.

Principais areas:

- `components/chat/*`: experiencia principal do chat, baloes, input, reasoning e export
- `components/workspace-v2/*`: shell atual do Gaucho Chat, rail de conversas, canvas central, composer e painel operacional
- `hooks/useChat.ts`: streaming, reasoning, citacoes, persistencia e fluxo de envio
- `lib/chat/useStreamingTextBuffer.ts`: buffer STT-style do texto do assistente
- `lib/models/modelConfig.ts`: catalogo de modelos e metadados usados no seletor
- `app/api/chat/route.ts`: proxy server-side para OpenAI
- `data/*.json`: persistencia local simples para conversas e persona

## Estado Atual Do Projeto

- Modelo padrao atual: `gpt-5.3-chat-latest` (GPT-5.3 Instant)
- Shell ativo: `GauchoChatShellV2` / `WorkspaceFrameV2` — redesign completo (S0-S12)
- Tokens `--gc-*` unificados em `app/globals.css`; light/dark completos
- Preview de artefatos via `ArtifactPreviewSheet`; painel lateral focado em atividade e notas
- Command palette cmd+k (`CommandPalette` + `cmdk`)
- Quick actions nos balões do assistente (`QuickActionsBar`)
- Toolbar de seleção de texto estilo Notion (`SelectionToolbar` + `useTextSelection`)
- Export dropdown com Markdown/JSON/PDF/Clipboard (`ExportDropdown` + `useExport`)
- NotesContext para bridge texto→notas (`NotesProvider`)
- Primitivos de animação framer-motion em `components/motion/`
- `MessageBubble` usa `motion.div` com `layout` (streaming suave); `AnimatePresence` no loop
- Chips do header conectados ao estado real (model, reasoning, responseMode)
- Breakpoints: `md=768`, `lg=1024 (sidebar)`, `xl=1280 (painel contextual)`
- Balões de assistente devem manter key estável por `message.id`; não incluir `artifact.id`
- `MessageStreamStatus`: `"streaming" | "completed" | "aborted" | "failed" | "interrupted"` — `aborted` = usuário cancelou, `interrupted` = conexão caiu/reload mid-stream, `failed` = erro de API

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

## Validacao Antes De Fechar Trabalho

Rodar, quando fizer sentido:

- `npm run build`
- `npx tsc --noEmit`
- `npm run lint` se a rodada exigir validacao mais ampla

## Observacoes Operacionais

- O repo remoto atual e `origin -> https://github.com/Anderson-Barcellos/CHATGPT.git`
- O branch principal rastreado e `main`
- Evitar sobrescrever mudancas locais nao relacionadas sem confirmar antes

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
`app/api/auth/login/route.ts` passou a validar `username` + `password`, e `lib/server/auth.ts` ganhou `AUTH_USERNAME` alem de fixar o `Path` do cookie no `NEXT_PUBLIC_BASE_PATH` (`/chat` em producao). `app/login/page.tsx` agora renderiza formulario com usuario e senha, e `app/page.tsx` parou de prefixar manualmente `/login`, deixando o redirect server-side respeitar o `basePath` nativo do Next. Em producao, `.env.production` ficou com `AUTH_ENABLED=true`, `AUTH_USERNAME=anders` e `AUTH_PASSWORD=1103`. No Apache, `ProxyPassReverseCookiePath / /code/` foi restringido ao bloco de `/code/`, `APACHE.md` foi atualizado para refletir que `/chat` usa JWT/app auth, e o `chatgpt.service` + `apache2` foram recarregados com validacao real.

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
