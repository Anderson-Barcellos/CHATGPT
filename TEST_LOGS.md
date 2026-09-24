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

## 2026-09-23 — Grok Realtime Orion no mini-player

| Gate | Comando | Resultado |
|---|---|
| Focado | `npx vitest --run hooks/useGrokMessageRealtime.test.tsx app/api/realtime/grok-session/route.test.ts components/chat/MiniAudioPlayer.test.tsx` | exit 0; 3 arquivos/6 testes após a correção final |
| Suíte completa | `npm test` | exit 0; 191 arquivos/980 testes |
| TypeScript | `npx tsc --noEmit` | exit 0 |
| Lint inicial | `npm run lint` | interrompido, exit 130: varria snapshot compilado antigo `.next-before-sc2-20260906T170822Z` |
| Lint do fonte | `npm run lint -- --ignore-pattern '.next-before-sc2-20260906T170822Z/**'` | exit 0; 0 erros, 1 warning anterior em `CommandComposerContainerV2.test.tsx` |
| Build isolado inicial | `npm run build` em `/root/.cache/chat-grok-orion-qa-20260923` | exit 1: Turbopack recusou `node_modules` por symlink externo |
| Build intermediário | `npm run build` na worktree | interrompido, exit 1: os dois arquivos finais ainda não tinham sido copiados da origem |
| Build isolado final | `npm run build` na mesma worktree com dependências copiadas | exit 0; 42 páginas, warnings anteriores de Edge/instrumentation e tracing Studio |
| Whitespace | `git diff --check` | exit 0 |

Produção não recebeu build nem restart. Sem smoke de chamada paga ou QA visual autenticado nesta rodada.

## 2026-09-23 — Orion TTS e remux, preparação conjunta

| Gate | Comando | Resultado |
|---|---|---|
| Focado TTS/merge | `npx vitest --run app/api/tts/xai/route.test.ts app/api/tts/xai/merge/route.test.ts hooks/useAssistantTts.xai.test.tsx` | exit 0; 3 arquivos/7 testes |
| Suíte completa | `npm test` | exit 0; 194 arquivos/989 testes |
| TypeScript | `npx tsc --noEmit` | exit 0 |
| Lint fonte | `npm run lint -- --ignore-pattern '.next-before-sc2-20260906T170822Z/**'` | exit 0 após correção do cache; 0 erros, 1 warning anterior em `CommandComposerContainerV2.test.tsx` |
| Build isolado `/chat` | `NEXT_PUBLIC_BASE_PATH=/chat npm run build` em `/root/.cache/chat-grok-orion-qa-20260923` | exit 0; 42 páginas, avisos anteriores de Edge/instrumentation e tracing Studio |
| Whitespace | `git diff --check` | exit 0 |

Smoke MP3 sintético: concatenar bytes de dois clips 24 kHz/128 kbps fez o decoder acusar `Header missing`; `ffmpeg -f concat -c copy` gerou duração de 2,112 s e decodificou sem erro. O teste da rota `/api/tts/xai/merge` repete o remux com dois tons sintéticos, sem provider nem dados persistidos.

Incidente e reparo: build iniciado por engano no checkout produtivo e interrompido (exit 130), removendo `.next/BUILD_ID`. Rebuild limpa do `main` `6b7369e` com `/chat` em `/root/.cache/chat-recover-current-20260923` (exit 0), instalação da build `aJPIu6zJdyljl43INV-L_` e `systemctl restart chatgpt.service` (exit 0). Health local/público HTTP 200; serviço ativo; anônimo na rota de voz HTTP 401. Mudança Orion continua somente em código e build isolada. Sem chamada paga ou QA visual autenticado.

## 2026-09-23 — Publicação Orion e QA público

| Verificação | Resultado |
|---|---|
| Build publicada | `KhPboi2KcAMFtcuOOMWiJ`; script `/root/.cache/chat-orion-deploy-20260923/publish.sh` exit 0; backup `next-before` = `aJPIu6zJdyljl43INV-L_` |
| Serviço/timers | `chatgpt.service`, `chatgpt-pulse.timer`, `chatgpt-soundcase.timer` e `.path` ativos |
| Health | local e público HTTP 200, `healthy` |
| Auth novas rotas | `POST /api/realtime/grok-session`, `/api/tts/xai` e `/api/tts/xai/merge`: HTTP 401 anônimo local e público |
| Smoke xAI público autenticado | `/root/.cache/chat-orion-deploy-20260923/voice-smoke.mjs` exit 0; dois clips TTS (66.048/48.000 bytes), MP3 remuxado (114.476 bytes) decodifica sem erro; Realtime 183.840 bytes PCM, primeiro áudio 2.087 ms |
| Chrome público desktop/mobile | `/root/.cache/chat-orion-deploy-20260923/player-smoke.cjs` exit 0; 1440×900 e 390×844, player com TTS Orion e Grok Realtime, zero pageerrors/escritas; capturas `player-desktop.png`/`player-mobile.png` inspecionadas |

QA usou texto/conversa sintéticos. Nenhuma conversa, nota ou outro dado do app foi gravado; duas chamadas TTS curtas e uma Realtime foram feitas para verificar o provider real. Apache/porta/proxy intactos, sem commit ou push.
