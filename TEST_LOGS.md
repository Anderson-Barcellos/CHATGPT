# TEST_LOGS.md — Reatividade mobile para iPhone 17 Pro Max (2026-09-13)

Registro da primeira execução de cada teste unitário criado ou alterado nesta entrega, seguido dos gates completos na cópia isolada `/root/.cache/chat-mobile-iphone-20260913`.

## Unitários — primeira execução (RED, antes da implementação)

Comando: `npx vitest run app/globals.visual.test.ts components/workspace-v2/WorkspaceLayoutV2.test.tsx hooks/useIsMobile.test.ts hooks/useVisualViewport.test.ts`

```
 × treats short coarse landscape as mobile in Tailwind md and in the raw media blocks
 × follows the iOS visual viewport so the keyboard shrinks the shell instead of pushing it
 × respects lateral safe areas for the Dynamic Island in landscape
 × keeps mobile scrolling fluid: no per-bubble blur, contained overscroll and manipulation touch-action
 × considera mobile a largura estreita ou a paisagem curta com toque
 × consulta o matchMedia com a media query compartilhada
 × renders the V2 workspace regions with the Gaucho Chat identity
 FAIL  hooks/useVisualViewport.test.ts — Failed to resolve import "@/hooks/useVisualViewport"
 Test Files  4 failed (4)
      Tests  7 failed | 10 passed (17)
```

## Unitários — primeira execução após implementação (GREEN)

`hooks/useIsMobile.test.ts` + `hooks/useVisualViewport.test.ts` (breakpoints, hook de viewport):

```
 Test Files  2 passed (2)
      Tests  9 passed (9)
```

Contratos de CSS/markup + vizinhos que mockam `useIsMobile` (`app/globals.visual.test.ts`, `WorkspaceLayoutV2.test.tsx`, `hooks/`, `MessageBubble.test.ts`, `QuickActionsBar.test.tsx`):

```
 Test Files  11 passed (11)
      Tests  49 passed (49)
```

## Gates completos (cópia isolada)

| Verificação | Comando | Resultado |
|---|---|---|
| Suíte vitest completa | `npx vitest run` | `Test Files 172 passed (172)` · `Tests 857 passed (857)` |
| TypeScript | `npx tsc --noEmit` | exit 0, sem erros |
| Lint | `npm run lint` | exit 0, 0 erros, 1 warning preexistente (`_content` em `CommandComposerContainerV2.test.tsx`) |
| Build | `npm run build` (cópia) | exit 0, build aprovada (1 warning preexistente do Turbopack: NFT tracing do Studio) |
| Whitespace | `git diff --check` | ok |

## QA visual (Chrome/Playwright emulando iPhone 17 Pro Max, DPR 2, touch)

Harness: `/root/.cache/chat-mobile-iphone-qa.mjs`; capturas e métricas em `/root/.cache/chat-mobile-iphone-evidence/{before,after}-*`.

| Cenário | Antes | Depois |
|---|---|---|
| 440×956 retrato (claro/escuro/welcome) | header 103 px, composer 91 px, blur(18px) por balão, overscroll `auto`, touch-action `auto` | mesma geometria (pixel-idêntico), blur `none`, overscroll `contain`, touch-action `manipulation` |
| 956×440 paisagem (claro/escuro) | layout de **tablet**: rail lateral, chips, dica "Enter envia", thread visível 210 px | layout mobile: sem rail de tablet, thread visível 244 px, composer mobile |
| overflow horizontal / pageerror | 0 / nenhum | 0 / nenhum |

Não emulável no harness: teclado do iOS (`visualViewport`), conferir no aparelho após deploy.
