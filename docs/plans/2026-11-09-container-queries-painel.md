# Painel e coluna do chat respondendo ao próprio espaço + polimentos baratos

## Context

Anders pediu sugestões de polimento e modernização do layout do Gaúcho Chat, com a suspeita de que os componentes reativos ainda dependem demais do tamanho do dispositivo. A leitura confirmou a suspeita, com medida: são 340 variants `md:` nos componentes contra 3 regras `@container` no app inteiro. A maior parte (~260) troca densidade entre toque e mouse e está certa como está. O problema real é o **miolo do painel operacional**: ele vai de 320 px (celular) a 956 px (iPhone deitado) no mobile e de 500 a 760 px no desktop, mas Pulse e Descobrir decidem altura de capa e arranjo olhando o monitor. Anders escolheu as frentes A (container queries) + D (polimentos baratos), com Studio e SoundCase congelados.

Resultado esperado: o conteúdo do painel passa a responder à largura do painel; a coluna do chat perde código morto e remendo duplo; e entram dois polimentos de leitura de baixo risco.

## Três correções ao que eu disse antes de ler tudo

- **Os balões já estão certos.** A largura deles vem de `min(76%, 42rem)` e `min(88%, 46rem)` em `app/globals.css` (~1438 e ~1466), que é relativa à coluna. As classes `md:max-w-[76%] min-[1490px]:max-w-[78%]` em `MessageBubble.tsx:191-192` e `max-w-3xl lg:max-w-[50rem] min-[1490px]:max-w-[60rem]` em `ChatContainer.tsx:552` são código morto, vencidas pelo tema Atmosphere (única shell). Ali o trabalho é só limpeza.
- **O prop `embedded` do Descobrir fica.** Dos 28 ramos, a maioria troca *conteúdo* (cabeçalho, botões, estilo do cartão), não tamanho. Só os ramos de dimensão (alturas de capa e grade) migram.
- **`scrollbar-gutter` quase não se aplica.** A rolagem do chat e do painel é Radix (barra sobreposta); só o Descobrir usa rolagem nativa. Sai do escopo.

## Abordagem

Variants com nome próprio em `app/globals.css`, ao lado do `@custom-variant md` que já existe (linha 13), para que o corte more num lugar só e a classe se leia sozinha:

```css
@custom-variant panel-cozy (@container gc-panel (width >= 30rem));
@custom-variant panel-wide (@container gc-panel (width >= 40rem));
@custom-variant chat-wide  (@container gc-chat  (width >= 50rem));
```

Os cortes foram escolhidos para **não mudar nada nas larguras de hoje**: 30rem (480 px) fica abaixo do painel desktop normal (500–600) e acima dos celulares em pé; 40rem (640 px) é exatamente o piso do painel ampliado (640–760); 50rem (800 px) é o corte que a regra crua `@container gc-chat (width < 800px)` já usa. O container `gc-chat` já existe em `.gc-chat-column`. Tailwind 4 instalado traz container query nativa, sem dependência nova.

Primeiro passo da implementação: confirmar a sintaxe do `@custom-variant` com `@container` na doc do Tailwind 4 (Context7) e no CSS do build isolado; se a forma curta não gerar, usar a forma em bloco com `@slot`.

## Blocos (cada um com conferência do Anders antes do seguinte)

### Bloco 1 — Painel vira container, sem mudança visual nas larguras atuais

- `components/workspace-v2/ContextPanelV2.tsx`: a raiz ganha a classe `gc-panel-container`; em `app/globals.css`, `.gc-panel-container { container: gc-panel / inline-size; }`. A raiz serve tanto ao `aside` desktop quanto ao sheet mobile.
- `components/workspace-v2/PulsePanelV2.tsx:193,199` e `components/discover/DiscoverPage.tsx:345,347` (só os ramos `embedded`): alturas de capa `md:h-*` viram `panel-cozy:h-*`.
- Efeito visível único: iPhone deitado e celulares largos (sheet ≥ 480 px) passam a mostrar a capa na altura confortável em vez da tira estreita.

### Bloco 2 — Painel ampliado aproveita a largura (mudança visível)

DECISÃO proposta, vetável na conferência: com `panel-wide` (painel ampliado no desktop, ou sheet ≥ 640 px no mobile), os cartões do Pulse (lista em `PulseActivityPanelV2`) e do Descobrir embutido (`DiscoverPage.tsx:336`) vão para duas colunas; cartão aberto ocupa as duas, como a página `/discover` já faz com `md:col-span-2`. Hoje o ampliado só estica os cartões. A página `/discover` independente não muda nesta rodada.

### Bloco 3 — Coluna do chat: limpeza e fim do remendo duplo

- Remover as classes mortas de largura em `MessageBubble.tsx:191-192` e `ChatContainer.tsx:552`; conferir se `min-[1490px]:max-w-[58rem]` do composer (`WorkspaceLayoutV2.tsx:635`) está viva antes de tocar.
- Boas-vindas (`ChatContainer.tsx:177-178`): `lg:grid-cols-[…] lg:gap-9` vira `chat-wide:…` e sai a regra crua de override em `globals.css` (~1172-1181), que hoje desfaz por container o que o `lg:` fez por viewport.
- Diferença de comportamento: entre 768 e 1023 px de janela, se a coluna tiver ≥ 800 px, as boas-vindas ganham duas colunas (hoje ficam em uma). Conferir no QA se isso ocorre de fato com a trilha visível.

### Bloco 4 — Polimentos de leitura

- `text-wrap: balance` em títulos curtos e estáticos: título das boas-vindas, títulos de cartão do Pulse/Descobrir, `h1–h3` do markdown.
- `text-wrap: pretty` só em texto estático (artigo do Descobrir, cartões do Pulse). **Não** no balão em streaming: reequilibrar as últimas linhas a cada token faz o texto dançar.
- Os dois `100vh` de `globals.css` (linhas 89 e 820) ganham o par `100dvh` com fallback.

### Bloco 5 — Condicional: thread longa mais leve

`content-visibility: auto` em `.gc-message-row` é o item de maior risco: conversa com o `ResizeObserver` de auto-rolagem (`ChatContainer.tsx:495`), com a animação `layout` do framer-motion e com a busca na página. Só entra se uma medição prévia (trace de performance numa thread sintética longa, via Chrome DevTools MCP) mostrar ganho material. Sem ganho, registro o número no BACKLOG e não mexo.

## Fora do escopo

Régua tipográfica em `vw` (letra acompanha a tela, não a caixa; trocar por `cqi` desfaria o conserto de 28/10); os ~60 tokens `--gc-mobile-*`; corte de encaixe do painel em 1773 px (frente B, fica como próxima candidata); Studio e SoundCase; `data/*.json`.

## Método e verificação

- Trabalho em worktree isolada (`/root/worktrees/gaucho-container-queries`, base `a572615`): este checkout é a produção e `npm run build` aqui equivale a deploy.
- TDD red→green por bloco. Contratos de CSS em `app/globals.visual.test.ts` (container declarado, três variants com seus cortes, override das boas-vindas removido, regras de `text-wrap`). Contratos de classe em `PulsePanelV2.test.tsx`, `DiscoverPage.test.tsx`, `ContextPanelV2.test.tsx`, `ChatContainer.test.tsx` e nos testes de `MessageBubble`.
- QA visual com o harness existente `scripts/qa-discover-panel.mjs` (13 cenários) mais uma varredura nova: estilos computados **idênticos antes/depois** em 390 px (mobile), 1280 px (flutuante 500) e 1920 px (encaixado 600); duas colunas no ampliado; iPhone deitado 956 × 440; claro e escuro.
- Gates completos antes de declarar pronto: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` (na worktree) e o Playwright inteiro; resultados em `TEST_LOGS.md`.
- Registro: plano copiado para `docs/plans/2026-11-09-container-queries-painel.md` e entrada no `BACKLOG.md`.
- Commit, push e publicação só com pedido explícito do Anders. Safari/iPhone físico segue dependendo da conferência dele no aparelho.

## Correções durante a execução

- **Bloco 2, corte do ampliado:** `panel-wide` ficou em 38.75rem (620 px), não em 40rem. A borda do aside tira 1 px do miolo, e o painel ampliado mínimo (640 px) media 639 px, abaixo do corte original. 620 px é o meio do caminho entre o teto do painel normal (600) e o piso do ampliado (640).
- **Bloco 2, grade:** `grid-flow-row-dense` para não deixar buraco quando o cartão aberto ocupa as duas colunas.
- **Bloco 4, títulos de cartão:** ficaram fora do `balance`. Prova no Chrome 156 mostrou que o equilíbrio não age em título com `line-clamp`.
- **Bloco 4, `100dvh`:** sem mudança. Os dois `100vh` já eram a linha de fallback de pares com `dvh`; a contagem inicial leu o fallback como pendência.

- **Bloco 5, resultado:** medido e descartado em 09/11; nenhum arquivo do app mudou. Abrir a thread não ganha (o custo é script, não layout) e rolar até o topo piora por causa da altura estimada das linhas fora da tela. A rodada longa de repetições foi interrompida de comum acordo com Anders. Números e ressalvas no `BACKLOG.md`.
