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

- Modelo padrao atual: `gpt-5.3-chat-latest`
- Seletor de modelos ja inclui `gpt-5.4` e `gpt-5.3-chat-latest`
- Acoes de mensagem e conversa foram polidas com confirmacao explicita via dialog
- A rota principal usa `GauchoChatShellV2` / `WorkspaceFrameV2`
- Sidebar/rail v2 ganhou busca, filtros, estado ativo e scroll interno real
- Painel direito v2 possui abas `Canvas`, `Artefato`, `Atividade` e `Notas`
- Canvas Markdown renderiza documentos, HTML e quiz em area maior usando os renderizadores de artifact existentes
- Bolhas usam tokens `--v2-*` em claro/escuro, sem `dark` forcado no shell
- Balões de assistente devem manter key estavel por `message.id`; nao incluir `artifact.id`, para nao remontar no fim do stream e reiniciar visualmente o buffer
- Reasoning possui estado explicito e renderizacao dedicada

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
- Removido bloco `.dark { --app-* }` de `app/globals.css` (linhas 167-175)
- `MessageBubble.tsx:316` migrado defensivamente de `--app-border-active` + `--app-control-surface` para `--v2-border` + `--v2-control` (avatar do usuario)
- Inline de `APP_PANEL_SHEET_CLASS` no `SettingsDrawer.tsx` antes de remover `lib/layout/panels.ts`
- Removido widget "Como fica no mobile" e variavel `mobilePreviewConversation` em `ConversationRailV2.tsx` (artefato de design-time)
- Removidos: `vercel.json`, `DOCKER_PLAN.md`, `docs/REVISAO_PROTOTIPO.md`, `docs/superpowers/`
- Adicionadas dependencias: `framer-motion 12.38.0`, `cmdk 1.1.1` (para sprints S2 e S7)
- Tag de retorno: `pre-redesign-s0` em `9d36822`

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
