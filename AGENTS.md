# AGENTS.md

## Visao Geral

Projeto de chat multimodal em `Next.js 16` com `React 19`, `TypeScript`, `Zustand` e `TanStack Query`, usando a `Responses API` da OpenAI.

Principais areas:

- `components/chat/*`: experiencia principal do chat, baloes, input, reasoning e export
- `components/workspace-v2/*`: shell atual do Gaucho Chat, rail de conversas, canvas central, composer e painel Canvas/Artefato
- `hooks/useChat.ts`: streaming, reasoning, citacoes, persistencia e fluxo de envio
- `lib/chat/useStreamingTextBuffer.ts`: buffer STT-style do texto do assistente
- `lib/models/modelConfig.ts`: catalogo de modelos e metadados usados no seletor
- `app/api/chat/route.ts`: proxy server-side para OpenAI
- `data/*.json`: persistencia local simples para conversas e persona

## Estado Atual Do Projeto

- Modelo padrao atual: `chat-latest` (GPT-5.5 Instant)
- Shell ativo: `GauchoChatShellV2` / `WorkspaceFrameV2` — redesign completo (S0-S12)
- Tokens `--gc-*` unificados em `app/globals.css`; light/dark completos
- Canvas overlay flutuante draggable/resizable (`CanvasOverlayV2`); mobile = Sheet full-screen
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
