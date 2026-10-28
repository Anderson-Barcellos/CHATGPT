# Painel operacional flutuante no desktop

Plano de 2026-10-28, com decisões de Anders tomadas na conversa (skill frontend-design convidada por ele).

## Problema

Hoje a lógica está invertida. Até 1280 px o painel é uma gaveta modal (Sheet) por cima do chat; a partir de 1281 px (`CONTEXT_SIDEBAR_BREAKPOINT`, `lib/layout/breakpoints.ts`) ele vira lateral fixa de 500/640 px e espreme a coluna do chat, justo na faixa em que Anders trabalha (1920 px com DPR 1,3375 ≈ 1435 px CSS).

## Decisões de Anders

1. No desktop, sobreposição **flutuante e não modal**: sem escurecer o fundo e com o chat livre para ler, rolar e digitar com o painel aberto. Fecha pelo botão ou por Esc.
2. **Encaixe** lateral só quando o painel não reduz a largura máxima do quadro de mensagens (`.gc-chat-thread`, `max-w-[60rem]` desde 1490 px, mais `md:px-5`). Cabeçalho e composer podem encolher.
3. **Largura** fluida `clamp(500px, 40vw, 600px)`; o modo ampliado vai para cerca de 760 px.

## Desenho

- **Corte de encaixe derivado, não chutado.** Soma da trilha de conversas (14,5rem = 232 px), do quadro (960 + 40 px), do painel encaixado (600 px), de 2 × `--gc-shell-gutter` (0,35rem) e das bordas (~4 px): ≈ 1848 px (refeito na execução: 1773 px, ver abaixo). A constante nasce em `breakpoints.ts` com a conta no comentário, e as classes `min-[1281px]` passam para o valor novo, inclusive no cabeçalho, em `ContextPanelV2` e em `globals.visual.test.ts`.
- **Faixa flutuante (md até o corte − 1).** O mesmo `<aside>` vira painel absoluto ancorado à direita, dentro do `.gc-clinical-shell`, com `z` acima do chat.
  - Visual: vidro Atmosphere (`--gc-glass-bg-strong`, `backdrop-blur`), borda esquerda e cantos esquerdos arredondados. A sombra lateral profunda indica camada sem bloquear.
  - Entrada com o `SlideIn` existente, respeitando `prefers-reduced-motion`.
  - Sem overlay, foco não preso. Esc fecha quando o foco está no painel ou quando nenhum outro diálogo está aberto. O botão "Abrir painel" do cabeçalho segue como gatilho, e o trilho recolhido de 2,85rem só existe no modo encaixado.
  - A largura não passa de `calc(100% − 3rem)` em telas estreitas (768–1023).
- **Mobile.** Continua com o Sheet em tela cheia, sem mudança.
- **Tokens.** `--gc-shell-context-width: clamp(500px, 40vw, 600px)`; o token ampliado passa a ~760 px, com limite equivalente.

## Arquivos

`lib/layout/breakpoints.ts`, `components/workspace-v2/WorkspaceLayoutV2.tsx` (aside, Sheet só no mobile, cabeçalho), `components/workspace-v2/ContextPanelV2.tsx`, `app/globals.css` (tokens e estilo flutuante), `app/globals.visual.test.ts`, `components/workspace-v2/WorkspaceLayoutV2.test.tsx`, `scripts/qa-discover-panel.mjs` (fronteira do harness).

## Verificação

- TDD: RED no contrato novo (constante derivada, tokens, painel sem overlay na faixa flutuante, Sheet só no mobile).
- Suítes completas e build em cópia isolada.
- Playwright em 1024, 1280, 1440, 1847, 1848, 1920, 390 e paisagem curta, conferindo três coisas:
  - o chat continua clicável e digitável com o painel aberto;
  - a largura do quadro de mensagens não muda ao encaixar;
  - Esc fecha o painel.
- Deploy só com pedido explícito.

## Execução (2026-10-28)

O print de Anders mostrou que o quadro de mensagens real é mais estreito que a coluna inteira. Por isso o corte saiu dos balões, não do `.gc-chat-thread`: o balão do usuário `min(76%, 42rem)` enche com 884,2 px de área útil. Somando trilha 232, painel 600, thread 40 e chrome 16, o corte fica em **1773 px** (`CONTEXT_SIDEBAR_BREAKPOINT`, derivado em `breakpoints.ts`). A QA varreu 1773–1900 px e os balões ficaram no máximo (672/736) em todas as larguras. Detalhes em `TEST_LOGS.md`.
