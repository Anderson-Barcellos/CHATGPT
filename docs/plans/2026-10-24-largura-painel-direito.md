# Largura estável do painel direito e atalho mobile

## 1. Entendimento e aprovação

Objetivo: manter o painel direito com 500 px normais/640 px ampliados no desktop, alinhando a gaveta tablet e acrescentando Descobrir à faixa mobile.

### 1.1 Entrevista e aprovação

Anders confirmou 500/640 px e informou monitor 3440 com resolução virtual 6880. Plano aprovado por “PLEASE IMPLEMENT THIS PLAN” em 2026-10-24. Depois autorizou publicação: “POde dar deploy depois pra nos conferirmos”. Nenhuma pergunta material pendente. Execução solo, sem autorização de commit/push.

Correção confirmada após a primeira conferência pública: o comportamento de gaveta da faixa intermediária continua até 1280 px inclusive, para não apertar os componentes do chat; a lateral fixa começa em 1281 px.

## 2. Agrupamentos

### Painel e espaço do chat

- Objetivo: evitar salto de largura e compressão do chat; a lateral fixa começa somente depois de 1280 px e não cresce em 1536 px.
- Escopo: `app/globals.css`, `components/workspace-v2/WorkspaceLayoutV2.tsx` e testes visuais.
- Contrato: 500 px normal, 640 px ampliado, recolhido preservado; tablet no máximo 500 px/96vw; mobile e paisagem curta com toque em tela cheia.
- Dependências: shell e painel existentes. Sem novas dependências ou APIs.
- Testes: 1199, 1200, 1279, 1280, 1281, 1288, 1289, 1440, 1536, 3440 e 6880 px; ampliar/reduzir, recolher/reabrir e redimensionar aberto; header compacto abaixo de 640 px disponíveis no chat.
- Pronto: medidas constantes, busca acessível por ícone quando necessário, chips acomodados e controles do composer sem cortes; leitura/player/rascunho preservados ao ampliar/reduzir.
- Preservar: dados, API, providers, cards, abas e geometria mobile.

### Atalho mobile (depois do painel)

- Objetivo: Nova conversa · Pulse · Descobrir · Notas · Rotinas na faixa principal.
- Escopo: navegação do shell e harness/testes correspondentes.
- Contrato: novo botão chama `openContextPanel("discover")`; cinco colunas legíveis com alvos de toque adequados desde 320 px.
- Dependências: geometria anterior estabilizada.
- Testes: 320/390 px e paisagem com toque; abrir diretamente Descobrir, fechar e alternar seções.
- Pronto: feed em tela cheia na aba correta sem overflow.
- Preservar: navegação desktop e demais ações mobile.

### Validação e publicação autorizada

- Worktree `/root/worktrees/gaucho-panel-width`, branch `codex/panel-width`, base HEAD `992b68d` + WIP da entrega publicada preservado.
- DECISÃO: candidata mantém seis arquivos DeepSeek max da fonte publicada. O código low do checkout vivo não será alterado nem publicado.
- Gates: testes focados; `npm test`; typegen Next com `/chat`; `npx tsc --noEmit`; `npm run lint`; `npm run build` isolado; três harnesses Discover completos; `git diff --check`.
- Browser plugin indisponível: usar Chrome/Playwright, dados sintéticos e `GAUCHO_ISOLATED_RUNTIME=true`. Provar medidas, UI e console, com capturas nos limites e dispositivos representativos.
- Registro técnico: diário append-only, evidências em `/root/.cache/gaucho-panel-width/evidence`, estado em BACKLOG.
- Após gates/revisão, publicar com backup e restart somente de chatgpt.service; validar saúde local/pública e UI pública com APIs sintéticas, preservar ponte e agendadores.
- Parada: gate falho bloqueia promoção; preservar produção/WIP. Commit/push fora do escopo.

## 3. Decisões de integração

DECISÃO: usar o estado de abertura existente como intenção única para gaveta e lateral. O estado local de recolhimento duplicava essa intenção e fazia um painel aberto desaparecer ao cruzar o breakpoint; a abertura deve sobreviver ao redimensionamento.

DECISÃO: a busca responde à largura da coluna do chat por container query; a condição exclui mobile para preservar o cabeçalho compacto atual. Ampliação/redução mantém a mesma árvore; a mudança entre modal/tablet e inline segue a montagem própria de cada superfície.

DECISÃO: a inspeção real a 1280 px/640 px de painel mostrou sobreposição dos cartões de boas-vindas, cujo grid respondia à janela inteira. `components/chat/ChatContainer.tsx` recebe apenas classes de integração; o grid empilha abaixo de 800 px disponíveis no chat. Em `GauchoChatShellV2`, criar/trocar conversa continua fechando somente a gaveta nas telas menores, preservando o comportamento desktop após a unificação da abertura.

DECISÃO: a faixa mobile usa cinco colunas com ícones alinhados e altura mínima de 54 px para preservar alvos de 44 px. Abaixo de 375 px, o texto visível do primeiro botão é Nova; o nome acessível permanece Nova conversa.

DECISÃO: após a conferência pública, Anders corrigiu a fronteira do painel para preservar o comportamento intermediário também entre 1200 e 1280 px. Em 1280 px inclusive, o painel é gaveta de até 500 px; a lateral fixa de 500/640 px entra a partir de 1281 px.

DECISÃO: a segunda conferência revelou a animação residual do Sheet ao crescer de 1280 para 1281 px: a lateral já estava montada enquanto a gaveta fechava por 300 ms. A gaveta passa a existir na árvore somente abaixo do breakpoint; ao entrar na lateral, desmonta no mesmo commit, sem duplicar overlay ou conteúdo e sem perder a intenção de abertura/aba ativa.
