# Relatório — Corrigir a barra de ações cortada no mobile

## Barra de ações contida no balão

Arquivos tocados: `components/chat/MessageBubble.tsx`, `app/globals.css` e `app/globals.visual.test.ts`. Este relatório registra o fechamento do grupamento; o WIP preexistente de retratos internos e largura mobile do assistente foi preservado.

`DECISÃO:` a barra de sete ou oito ações passa a usar a mesma geometria contida no balão. O modificador condicional `gc-message-quick-actions-wide` e sua compensação antiga de `margin-left: -2.31rem` foram removidos, mantendo `width: fit-content`, `max-width: 100%`, `flex-wrap` e os alvos táteis mobile de 40 px.

Resultados:

- Contrato em vermelho antes da correção: `npx vitest run app/globals.visual.test.ts` — 1 arquivo, 12 testes; 11 passaram e 1 falhou, exit 1, identificando o seletor legado.
- Gate focado final: `npx vitest run app/globals.visual.test.ts components/chat/QuickActionsBar.test.tsx components/chat/MessageBubble.test.ts` — 3 arquivos, 17 testes; 17 passaram, 0 falhas, 0 skips, exit 0.
- Gate de whitespace: `git diff --check` — nenhuma ocorrência, exit 0.
- Revisão estática do markup/CSS: sete ações são incondicionais e `Regenerar` permanece a oitava ação condicional; a barra interna conserva `flex-wrap`, o invólucro mobile conserva `fit-content` com `max-width: 100%` e nenhuma margem lateral negativa; pesquisa web e referências não foram alteradas.

Bloqueios: nenhum.

## Aceitação integrada e registro

Arquivos tocados neste grupamento: `BACKLOG.md`, `docs/DIARIO-AGENTS.md` e este relatório. A entrega foi registrada como `pronta para revisão`; as entradas e o WIP alheios foram preservados.

`DECISÃO:` nenhuma segunda instância Next foi iniciada. Como o boot executaria `instrumentation.ts` e poderia parar units Studio vivas por wildcard, o QA Chrome/Playwright usou `page.setContent()` com DOM sintético e o CSS real da build isolada, sem servidor, provider ou persistência. A build continuou segura em cópia isolada, pois `register()` não roda durante `next build`.

Resultados:

- `npm test` — 172 arquivos e 861 testes; 172 arquivos passaram, 861 testes passaram, 0 falhas, 0 skips, exit 0.
- `npx tsc --noEmit` — nenhuma ocorrência, exit 0.
- `npm run lint` — após 8min21s, 92.830 problemas: 4.446 erros e 88.384 warnings, exit 1. A saída confirmou a contaminação pelo snapshot compilado conhecido `.next-before-sc2-20260906T170822Z`; fora dele apareceu somente o warning anterior de `_content`.
- `npm run lint -- --ignore-pattern '.next-before-sc2-20260906T170822Z/**'` — 0 erros e 1 warning anterior em `CommandComposerContainerV2.test.tsx`, exit 0.
- `git diff --check` — nenhuma ocorrência, exit 0.
- Primeira tentativa de `NEXT_PUBLIC_BASE_PATH=/chat npm run build` em `/root/.cache/chat-mobile-actions-build-sd0bOT` — exit 1: Turbopack recusou o symlink externo de `node_modules`; falha do isolamento, não do código.
- Build final com o mesmo comando em `/root/.cache/chat-mobile-actions-build-hardlinks-dEHY6z`, usando hardlinks locais — compilação e TypeScript aprovados, 41/41 páginas estáticas, exit 0; permaneceu apenas o warning conhecido de NFT tracing do Studio.
- QA Chrome/Playwright isolado — 10/10 cenários aprovados em 320×844, 390×844, 430×932, 767×900 e 956×440, claro/escuro, exit 0. Em 320 px a barra quebrou em duas linhas; em 390/430 px as oito ações ficaram em uma linha. Documento, thread, balão e barra tiveram `scrollWidth <= clientWidth`; primeiro e último botões ficaram inteiros e contidos; alvos mínimos mediram 40×40 px; zero `pageerror` e erro de console.
- Evidências: métricas e harness em `/root/.cache/chat-mobile-actions-qa-uiiYST/metrics.json` e `/root/.cache/chat-mobile-actions-qa-uiiYST/qa.mjs`; capturas conferidas em `barra-320-light.png` e `barra-390-dark.png`.

Revisão independente do orquestrador: `npm test` repetiu 172/172 arquivos e 861/861 testes, exit 0; `npx tsc --noEmit` repetiu com exit 0; o lint do fonte repetiu com 0 erros, 1 warning anterior e exit 0; a build isolada repetiu 41/41 páginas com exit 0; o harness Chrome/Playwright repetiu 10/10 cenários com exit 0 e as mesmas métricas de contenção, quebra e alvo tátil.

Bloqueios: nenhum. Contratempo resolvido: a primeira cópia de build usava symlink incompatível com Turbopack; a repetição segura com hardlinks passou sem tocar o checkout de produção.
