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

- Modelo padrao atual: `gpt-5.1-chat-latest` (GPT-5.1 Instant)
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

### 2026-05-25 00:30 - Documentacao consolidada e docs antigos removidos

Context:
Depois da estabilizacao do login e do loop mobile, Anders pediu uma limpeza maior da documentacao, com uso de agentes para mapear docs antigas e consolidar uma fonte atualizada.

Details:
A documentacao publica foi reduzida para fontes canonicas: `README.md`, `docs/README.md`, `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/INFRASTRUCTURE.md` e `docs/MODELS.md`. Foram removidos docs antigos/duplicados que apontavam para Vercel, Docker, Nginx, instalacao Apache legada ou arquitetura gerada: `docs/APACHE_INSTALL.md`, `docs/DEPLOYMENT.md`, `docs/COMPONENTS.md` e `docs/architecture/*`. `apache-config/chat.conf` foi atualizado para incluir `ProxyPassReverseCookiePath / /chat` e endpoints atuais de PDF/TTS/Realtime.

Notes:
O criterio novo e manter `README.md` como entrada, `docs/API.md` para contrato de rotas, `docs/ARCHITECTURE.md` para desenho do app, `docs/INFRASTRUCTURE.md` para Apache/systemd/env/deploy, `docs/MODELS.md` para catalogo, e `AGENTS.md` como memoria operacional append-only. Nao recriar docs separados de deploy Apache/Vercel sem necessidade; isso foi a fonte principal de drift.
