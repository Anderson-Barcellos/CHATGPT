# AGENTS.md

## Visao Geral

Projeto de chat multimodal em `Next.js 16` com `React 19`, `TypeScript`, `Zustand` e `TanStack Query`, usando a `Responses API` da OpenAI.

Principais areas:

- `components/chat/*`: experiencia principal do chat, baloes, input, reasoning e export
- `components/sidebar/*`: lista de conversas e navegacao lateral
- `components/layout/*`: shell principal da aplicacao
- `hooks/useChat.ts`: streaming, reasoning, citacoes, persistencia e fluxo de envio
- `lib/models/modelConfig.ts`: catalogo de modelos e metadados usados no seletor
- `app/api/chat/route.ts`: proxy server-side para OpenAI
- `data/*.json`: persistencia local simples para conversas e persona

## Estado Atual Do Projeto

- Modelo padrao atual: `gpt-5.3-chat-latest`
- Seletor de modelos ja inclui `gpt-5.4` e `gpt-5.3-chat-latest`
- Acoes de mensagem e conversa foram polidas com confirmacao explicita via dialog
- Header agora mostra contexto da conversa ativa e do modelo selecionado
- Sidebar ganhou estado ativo mais claro e fluxo melhor ao excluir a conversa aberta
- Reasoning foi movido para um painel proprio, com estado explicito e visual mais consistente

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

## Proximos Pontos De Atencao

### Alta prioridade

- Revisar o markdown das mensagens do chat com foco em `\\n` literal, `/n` indevido e consistencia entre renderizadores
- Decidir se vamos unificar de vez `MessageContent` com `ChatMarkdown`
- Revisar `rehypeRaw` no fluxo principal de markdown e endurecer a estrategia de renderizacao
- Melhorar o auto-scroll durante streaming para nao puxar a leitura enquanto o usuario esta acima

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
