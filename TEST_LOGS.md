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

## 2026-09-25 — Composer mobile em cápsula, anexo de volta e bugs vizinhos (Claude)

Worktree isolada `/root/.cache/gaucho-composer-capsule-20260925`, branch `claude/composer-capsule-20260925`, base `b73b2a3`.

### Unitários — primeira execução (RED, antes da implementação)

Comando: `npx vitest --run components/workspace-v2/WorkspaceLayoutV2.test.tsx`

```
 × keeps the command bar controls visible and grouped
 × lists Documento alongside both Deepsearch levels for mobile and desktop menus
 × lights the modes button in amber while Quiz is active
 × shows the audio wave only while recording and keeps transcription distinct
 × restores the manual attachment picker next to the modes control
      Tests  5 failed | 2 passed (7)
```

### Unitários — primeira execução após implementação (GREEN)

```
      Tests  7 passed (7)
```

`app/globals.visual.test.ts` falhou na primeira suíte completa por travar os tokens antigos (`controls-y 0`, `control-height 1.9rem`, `send-size 2.0625rem`); contrato atualizado para `0.25rem`/`2.25rem`/`2.375rem` e densidade `2rem` abaixo de 360 px: `Tests 13 passed (13)`.

### Gates completos

| Gate | Comando | Resultado |
|---|---|---|
| Suíte completa | `npm test` | exit 0; 194 arquivos/992 testes |
| TypeScript | `npx tsc --noEmit` | exit 0 |
| Lint | `npm run lint` | exit 0; 0 erros, 1 warning anterior (`_content` em `CommandComposerContainerV2.test.tsx`) |
| Build isolado `/chat` | `NEXT_PUBLIC_BASE_PATH=/chat npm run build` na worktree | exit 0 |
| Whitespace | `git diff --check` | exit 0 |

### QA visual (Chrome/Playwright, API 100% sintética, `next dev` isolado na 3041, auth desligada, sem chaves)

16/16 cenários mobile (320 dark, 375 light, 390 dark, 430 light × parado/Quiz/modelo trocado/gravando com microfone falso): `pageOverflow=false`, `stripOverflow=false`, nenhum botão fora da faixa, zero `pageerror`. Desktop 1280: menu Documento lista Documento/Deepsearch Medium/High, anexo lista Arquivo/Imagem, sem overflow. A primeira rodada revelou vazamento do Pro sobre o Rec em 320/375 px (`Button` com `shrink-0`), corrigido deixando só o modelo encolher; em 320 px o modelo virava “G.”, corrigido com densidade própria abaixo de 360 px. Capturas e roteiros em `/root/.cache/gaucho-composer-capsule-evidence`. Porta 3041 liberada ao fim.

## 2026-09-25 — Prompt de Deep Research com agente único (Claude)

`lib/chat/deepResearchPrompt.test.ts`, primeira execução (RED): `Error: Cannot find package '@/lib/chat/deepResearchPrompt'` — `Tests no tests`. Teste de encaixe acrescentado depois: `1 failed | 3 passed (4)`. GREEN: `Tests 4 passed (4)`.

| Gate | Resultado |
|---|---|
| `npm test` | exit 0; 195 arquivos/996 testes |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | exit 0; 0 erros, 1 warning anterior |
| `NEXT_PUBLIC_BASE_PATH=/chat npm run build` | exit 0 |
| `git diff --check` | exit 0 |

Troca dos modelos (Medium → `gpt-6-luna` high; High → `gpt-6-sol` high) não aplicada: os IDs não existem no catálogo e a conferência na API foi barrada pela proteção de credenciais.

## 2026-09-25 — Composer mobile em cápsula única contínua (Claude)

Primeira execução (RED) de `WorkspaceLayoutV2.test.tsx` + `app/globals.visual.test.ts`: `Tests 6 failed | 15 passed (21)` — cápsula sem `flex-1`, sem `data-active` no modo Quiz, sem `data-recording`, modelo sem `data-composer-segment="model"`, tokens 2.5rem/segmento ausentes e seletor elástico ausente. GREEN: `Tests 21 passed (21)`.

| Gate | Comando | Resultado |
|---|---|---|
| Suíte completa | `npm test` | exit 0; 196 arquivos/1003 testes |
| TypeScript | `npx tsc --noEmit` | exit 0 |
| Lint dos arquivos tocados | `npx eslint <4 arquivos>` | exit 0 |
| Lint geral | `npm run lint` | PRE_EXISTING_FAILURE: 4446 erros, todos em `.next-before-sc2-20260906T170822Z/` (backup antigo de build, fora do diff) |
| Build isolado `/chat` | `NEXT_PUBLIC_BASE_PATH=/chat npm run build` na worktree | exit 0 |
| Whitespace | `git diff --check` | exit 0 |

### QA visual (Playwright + Chrome DevTools, API sintética, `next dev` isolado na 3041, auth desligada)

12/12 cenários mobile (390 dark/light, 320 dark, 430 light × parado/Pro/Deepsearch): `overflow=false`, modelo sem truncamento em todas as larguras, zero `pageerror`. A primeira rodada mostrou "GPT-5.6 L…" em 320 px; corrigido com segmento de 1.75rem e padding menor no modelo abaixo de 360 px. Desktop 1440 conferido idêntico ao anterior. Gravação real não exercitada (sem microfone falso nesta rodada); coberta pelo teste de markup `data-recording`. Capturas e roteiro em `/root/.cache/gaucho-composer-single-capsule-evidence`.

## 2026-09-26 — Merge GPT-6 + Deepsearch em Luna/Sol (Claude)

Merge de `codex/gpt6-usage-audit-20260924`: 196 arquivos/1010 testes e tsc exit 0 antes do commit. `lib/chat/deepsearchConfig.test.ts`, primeira execução (RED): `Tests 3 failed (3)` (Grok/`gpt-5.4` ainda no perfil). GREEN: `3 passed`.

| Gate | Comando | Resultado |
|---|---|---|
| Suíte completa | `npm test` | exit 0; 196 arquivos/1011 testes |
| TypeScript | `npx tsc --noEmit` | exit 0 |
| Lint | `npm run lint -- --ignore-pattern '.next-before-sc2-20260906T170822Z/**'` | exit 0; 0 erros, 1 warning anterior |
| Build isolado `/chat` | `NEXT_PUBLIC_BASE_PATH=/chat npm run build` na worktree | exit 0 |
| Whitespace | `git diff --check` | exit 0 |

## 2026-09-27 — iOS 27: sonda de viewport, Bloco 1 (Claude)

`lib/layout/viewportProbe.test.ts`, primeira execução (RED): `Failed to resolve import "@/lib/layout/viewportProbe"` — `Test Files 1 failed`, `Tests no tests`. GREEN: `Tests 5 passed (5)`.

| Gate | Comando | Resultado |
|---|---|---|
| Suíte completa | `npm test` | exit 0; 197 arquivos/1016 testes |
| TypeScript | `npx tsc --noEmit` | exit 0 |
| Lint | `npm run lint -- --ignore-pattern '.next-before-*/**'` | exit 0; 0 erros, 1 warning anterior |
| Build isolado `/chat` | `NEXT_PUBLIC_BASE_PATH=/chat npm run build` em `/root/.cache/chat-ios27-probe` | exit 0; rota `ƒ /viewport-probe` |
| Whitespace | `git diff --check` | exit 0 |

QA Playwright (`next dev` isolado na 3041, `AUTH_ENABLED=false`, iPhone 15 Pro Max emulado, dark/light): zero `pageerror`, sem overflow horizontal, réguas/barras/painel legíveis. Emulação é aba de navegador, não standalone: a leitura real depende do iPhone do Anders.

## 2026-09-27 — Modelos padrão por seção (Claude)

Primeira execução (RED) do conjunto (settingsStore, persistência, Studio, SoundCase, Pulse store/config, Documento, Deepsearch): `Test Files 8 failed (8)`, `Tests 8 failed | 43 passed (51)`; `lib/chat/documentConfig.test.ts` sem módulo. GREEN (com PulsePanelV2 e useChat): `Test Files 10 passed (10)`, `Tests 60 passed (60)`.

| Gate | Comando | Resultado |
|---|---|---|
| Suíte completa | `npm test` | exit 0; 199 arquivos/1025 testes |
| TypeScript | `npx tsc --noEmit` | exit 0 |
| Lint | `npm run lint -- --ignore-pattern '.next-before-*/**'` | exit 0; 0 erros, 1 warning anterior |
| Build isolado `/chat` | `NEXT_PUBLIC_BASE_PATH=/chat npm run build` em `/root/.cache/chat-ios27-probe` | exit 0; BUILD_ID `uZstdqKc_MmvSHgrwQ8sT` (aviso antigo de `process.exit` no instrumentation) |
| Whitespace | `git diff --check` | exit 0 |

## 2026-09-27 — `scripts/deploy.sh` / `npm run deploy` (Claude)

`scripts/deploy.test.ts`, primeira execução (RED): `Tests 4 failed | 3 passed (7)`. Os 3 de recusa passaram só porque o script ainda não existia (bash sai ≠ 0 sem tocar nada). GREEN: `7 passed (7)`. Caso novo de pasta `lib/data` e `.env.production` na cópia: RED `1 failed | 6 passed (7)` (exclude sem âncora), GREEN `7 passed (7)`.

| Gate | Comando | Resultado |
|---|---|---|
| Suíte completa | `npm test` | exit 0; 200 arquivos/1032 testes |
| TypeScript | `npx tsc --noEmit` | exit 0 |
| Lint | `npm run lint -- --ignore-pattern '.next-before-*/**'` | exit 0; 0 erros, 1 warning anterior |
| Sintaxe | `bash -n scripts/deploy.sh` | exit 0 (shellcheck não instalado) |
| Gates numa cópia sem `data/` | `bash scripts/pre-deploy.sh --skip-build` em `/root/.cache/chat-ios27-probe` | typegen, tsc, lint e 199/1025 testes aprovados |
| Build | — | não repetido: o código do app é o mesmo da build `uZstdqKc_MmvSHgrwQ8sT` (só scripts, docs e `package.json#scripts` mudaram) |
| Whitespace | `git diff --check` | exit 0 |

## 2026-09-27 — iOS 27 PWA, Bloco 2a: teclado e safe area do composer (Claude)

`hooks/useVisualViewport.test.ts`, primeira execução (RED): `Tests 6 failed | 4 passed (10)` (altura ainda travada com teclado fechado, `physicalViewportHeight` inexistente, sem `data-standalone`/gap, sem `scrollTo` ao fechar). `app/globals.visual.test.ts` (RED): `1 failed | 14 passed (15)` (regra do dock em standalone ausente). GREEN: `10 passed (10)` e `15 passed (15)`; com `WorkspaceLayoutV2.test.tsx`, `32 passed (32)`.

| Gate | Comando | Resultado |
|---|---|---|
| Suíte completa | `npm test` | exit 0; 200 arquivos/1037 testes |
| TypeScript | `npx tsc --noEmit` | exit 0 |
| Lint | `npm run lint -- --ignore-pattern '.next-before-*/**'` | exit 0; 0 erros, 1 warning anterior |
| Build isolado `/chat` | `NEXT_PUBLIC_BASE_PATH=/chat npm run build` em `/root/.cache/chat-ios27-probe` | exit 0; BUILD_ID `dCx1O7ggY_iV14A1BR53I` |
| Whitespace | `git diff --check` | exit 0 |

QA Playwright (`next dev` isolado na 3041, `AUTH_ENABLED=false`, iPhone 15 Pro Max emulado): com `navigator.standalone = true` (dark/light) → `data-standalone` presente, gap `193px` (tela 932 − viewport 739 do emulador), sem `--gc-visual-viewport-height` em repouso, frame 739 = innerHeight, dock 2.76px (safe area 0 no Chromium); aba normal sem atributo nem mudança; zero `pageerror` e overflow. A safe area real e o ciclo do teclado só se validam no iPhone. `.next/dev` (793 MB) do dev server removido da build isolada antes do deploy.

## 2026-10-12 — Descobrir IA com a largura do painel operacional (Claude)

Teste novo em `app/globals.visual.test.ts`: "gives Descobrir the same token-driven width as the right context panel" (Descobrir usa `--gc-shell-context-width`, salto 2xl vira token em `@media (min-width: 96rem)`, um só `:root` com tokens `--gc-shell-*`, sem `2xl:w-[` no `WorkspaceLayoutV2.tsx`, sem regra CSS duplicando a largura do painel recolhido).

Primeira execução (RED), `npx vitest run app/globals.visual.test.ts`:

```
 × gives Descobrir the same token-driven width as the right context panel
   AssertionError: expected '…width: 360px;\n  max-width: 32%;…' to contain 'width: var(--gc-shell-context-width);'
 Test Files  1 failed (1)
      Tests  1 failed | 15 passed (16)
```

Após implementação (GREEN), `npx vitest run app/globals.visual.test.ts components/workspace-v2`:

```
 Test Files  8 passed (8)
      Tests  34 passed (34)
```

Gates completos em cópia isolada `/root/.cache/chat-discover-width-20261012` (sem `.env*`, `.git` e `data`):

```
npm test           → 212 files, 1086 passed
npx tsc --noEmit   → exit 0
npm run lint       → 0 errors, 1 warning pré-existente (CommandComposerContainerV2.test.tsx, não tocado)
npm run build      → exit 0 (NEXT_PUBLIC_BASE_PATH=/chat)
```

Teste novo em `app/globals.visual.test.ts`: "lets the mobile panel density win over the desktop Atmosphere panel spacing" (os quatro tokens `--gc-mobile-context-header-*`/`--gc-mobile-panel-content-*` em um único `:root` anterior ao bloco mobile de 0,6375rem, preservando 0,55rem no desktop).

Primeira execução (RED), `npx vitest run app/globals.visual.test.ts`:

```
 × lets the mobile panel density win over the desktop Atmosphere panel spacing
   AssertionError: expected [ …(2) ] to have a length of 1 but got 2
      Tests  1 failed | 16 passed (17)
```

Após implementação (GREEN), `npx vitest run app/globals.visual.test.ts components/workspace-v2 components/settings`:

```
      Tests  35 passed (35)
```

## 2026-10-13 — Modelos: DeepSeek V4.1 Flash, GPT-6.1 Sol, GPT-5.6 Sol de volta, sem Grok (Claude)

Escopo: `deepseek-flash` substitui `deepseek-v4-pro` (alias); `gpt-6.1-sol` substitui `gpt-6-sol` (aliases `gpt-6-sol` e `gpt-5.6-terra`); `gpt-5.6-sol` volta como modelo próprio com Pro; Grok sai de chat, Pulse e Studio (`grok-4.7` e `gpt-5.4-mini` resolvem para `gpt-6-luna`); extrações internas (Pulse e rascunho de agenda) em Luna `low`; `xaiChat` apagado; `xaiBackground` só finaliza jobs legados. Chave xAI segue apenas na voz.

Probes reais (chamadas pequenas): `gpt-6.1-sol` recusa `reasoning.effort=none` (400) e responde com `max`; `gpt-5.6-sol` responde `completed` em modo Pro; `deepseek-flash` responde e é o V4.1 Flash.

Primeiras execuções (RED), por grupo:

```
catálogo (lib/models/modelConfig.test.ts)                 → 6 failed
chatRequest (aliases)                                      → 6 failed | 13 passed
settingsStore + persistência                               → 8 failed | 19 passed
DeepSeek / deepsearch / curadoria / FIM do Studio          → 10 failed | 33 passed
Pulse config/store (resolveLegacyPulseModel)               → 8 failed | 8 passed
PulsePanelV2 "Pulse model selector"                        → 2 failed | 1 passed
Studio models.test.ts + workspace.test.ts                  → 8 failed | 12 passed
xaiBackground + rotas sync/reconcile                       → 2 failed | 14 passed
extrações Pulse/calendar com Luna                          → 6 failed | 2 passed
```

Testes que já passaram no RED (a resolução de alias desviava o fluxo antes do ramo Grok, confirmando que esses ramos estavam mortos): store "devolve o esforço none do GPT-6.1 Sol ao default suportado"; `runnerStart.test.ts` (rotina salva com Grok roda no Luna; chave OpenAI ausente vira failed); `studioAssistant.test.ts` (mini/grok → `gpt-6-luna` com `web_search_preview`); `app/api/chat/route.test.ts` "modelos legados de Grok e mini" (7 passed).

Após implementação (GREEN), por grupo:

```
catálogo + chatRequest            → 29 passed / 27 passed
settingsStore + persistência      → verdes
documentConfig/DeepSeek           → 43 passed
PulsePanelV2                      → 3 passed
runnerStart                       → 4 passed
lib/studio + components/studio    → 165 passed
xaiBackground + rotas             → 23 passed
extrações                         → 21 passed
```

Suíte inteira no checkout (sem build): `npx tsc --noEmit` → exit 0; `npx vitest run` → 212 files, 1093 passed. Gates completos em cópia isolada registrados abaixo.

Gates completos em cópia isolada `/root/.cache/chat-models-20261013` (sem `.env*`, `.git` e `data`):

```
npm test           → 212 files, 1093 passed
npx tsc --noEmit   → exit 0
npm run lint       → 0 errors, 1 warning pré-existente (CommandComposerContainerV2.test.tsx, não tocado)
npm run build      → exit 0 (NEXT_PUBLIC_BASE_PATH=/chat)
```

## 2026-10-14 — Nome do DeepSeek V4.1 Flash nas mensagens residuais (Claude)

Sobraram três textos "DeepSeek V4 Pro" depois da troca de 13/10: duas mensagens de erro de `app/api/chat/route.ts` (modo não padrão e streaming obrigatório) e o aviso de verbosity em `components/settings/SettingsDrawer.tsx`. Teste novo em `app/api/chat/route.test.ts` (describe "DeepSeek V4.1 Flash na rota", 3 casos, inclui o id antigo `deepseek-v4-pro`).

Primeira execução (RED), `npx vitest run app/api/chat/route.test.ts`:

```
 FAIL  … > aceita o id antigo deepseek-v4-pro e cobra pelo nome novo
 AssertionError: expected 'DeepSeek V4 Pro esta habilitado somen…' to contain 'DeepSeek V4.1 Flash'
      Tests  3 failed | 7 passed (10)
```

Após a correção (GREEN): `Tests  10 passed (10)`.

## 2026-10-15 — Claude no chat (Codex)

Snapshot: /root/.cache/gaucho-claude-20261015/source; logs completos em ../evidence/gates.jsonl e arquivos individuais.

- npm test -- --maxWorkers=2: exit 0, 213 arquivos, 1.126 testes, nenhum skip.
- NEXT_PUBLIC_BASE_PATH=/chat npx --no-install next typegen e npx --no-install tsc --noEmit: exit 0.
- npm run lint: exit 0, um warning preexistente de parâmetro não usado.
- NEXT_PUBLIC_BASE_PATH=/chat npm run build: exit 0, 43/43 páginas; dois avisos preexistentes Edge/tracing Studio.
- node ../evidence/browser-qa.cjs: exit 0, oito checks desktop/mobile, sem erros de página/console na rodada final. Chat e indexação/sugestões automáticas simulados; autenticação/persistência sintéticas reais. Capturas inspecionadas; conversa removida e servidor encerrado.
- Anthropic real: Models API 200 ambos; texto/imagem Sonnet e Opus; busca/fetch com citações e continuidade de memória Sonnet. Fixtures removidas.
- git diff --check: exit 0.

Ocorrências intermediárias: prefixo incorreto no harness; guard TypeScript corrigido; timeout SoundCase resolvido em uma repetição com dois workers sem alterar teste/timeout; PNG inválido substituído; mocks/seletores de browser corrigidos. Registro completo em docs/plans/2026-10-15-claude-no-chat-report.md. Sem publicação/restart de produção.

## Publicação autorizada — 2026-10-15

Anders autorizou publicar e comitar. Fonte original conferida contra baseline, sem divergências. DECISÃO: preservar o WIP anterior na main; aplicar somente o patch desta entrega e importar os commits na branch codex/claude-chat-20261015, sem merge do histórico sintético. Commits de implementação 7e444d2 e documentação 40d44c6.

Drop-in 50-anthropic instalado, daemon-reload e publicação via scripts/deploy.sh --from /root/.cache/gaucho-claude-20261015/source, exit 0. Build s8Q5n0uSF_K2_bQfWeKMa; backup /root/.cache/gaucho-deploy/20261015T110653Z/next-before. Preservar a origem da build. Serviço reiniciado e active; health local/público 200 healthy. Chamadas sintéticas autenticadas na rota pública com Sonnet e Opus: 200, texto e conclusão SSE em ambos, sem tools e sem persistir conversa. Chunk público dos modelos idêntico à build validada. Evidências: deploy.log, published-results.json e public-assets.json no diretório evidence da entrega.

Nenhuma mudança em proxy/porta, nenhum reload Apache ou push. Chave carregada no processo e nunca emitida. APACHE.md atualizado. Gates de código anteriores permanecem válidos: publicação não alterou código; somente registros operacionais foram atualizados.

## 2026-10-15 — Reasoning do DeepSeek V4.1 Flash em `low` (Claude)

Pedido de Anders: reasoning do DeepSeek como `low`. Sondagem real (mesma pergunta, `thinking` habilitado): `low` → 65 tokens de raciocínio; `max` → 156. Trava do store (`xhigh` → `low`) e parâmetro enviado à API (`max` → `low`) trocados; tooltip do compositor, descrição do catálogo, ARCHITECTURE e MODELS alinhados.

Primeira execução (RED), `npx vitest run stores/settingsStore.test.ts lib/server/deepseekChat.test.ts`:

```
 FAIL  settingsStore.test.ts > locks DeepSeek V4.1 Flash to low reasoning and high verbosity
 AssertionError: expected 'xhigh' to be 'low'
 FAIL  deepseekChat.test.ts > builds a text-only DeepSeek V4.1 Flash request with low reasoning
      Tests  2 failed | 28 passed (30)
```

Gates com o adapter Anthropic de Anders presente (`@anthropic-ai/sdk` 0.134.0 instalado do lockfile; lint na cópia isolada `/root/.cache/chat-lint-20261015`, pois no checkout o eslint varre `.next*`):

```
npx vitest run     → 213 files, 1126 passed
npx tsc --noEmit   → exit 0
npm run lint       → 0 errors, 1 warning pré-existente (CommandComposerContainerV2.test.tsx)
```

Build ainda não rodado nesta rodada (sai no deploy, em cópia isolada).

## 2026-10-21 — Mobile publicado em sonaris.us

### Complemento: intervalo do gesto após feedback de Anders

DECISÃO: feedback após 450 ms, menu aos 900 ms, contexto nativo de toque sem antecipação; dois timers cancelados em arrasto/fim/cancelamento/desmontagem. Arquivos: `hooks/useMessageLongPress.ts`, seu teste e `components/chat/MessageBubble.tsx`. Base da build anterior preservada, sem incorporar WIP DeepSeek.

Em `/root/.cache/gaucho-press-20261021/source`: `npm run lint` exit 0 (warning anterior mantido); `npm test -- --maxWorkers=2` exit 0, 215 arquivos e 1.141 testes aprovados, sem skips/falhas; `NEXT_PUBLIC_BASE_PATH=/chat NEXT_PUBLIC_APP_URL=https://sonaris.us/chat npm run build` exit 0; `node node_modules/typescript/bin/tsc --noEmit` exit 0. Logs em `../evidence`.

`node /root/.cache/gaucho-press-20261021/qa.mjs` exit 0: Chrome 390×844 e 1440×1000, página identificada e conteúdo presente, sem overlay/erros de página, captura do menu, toque inicial sem feedback, arrasto sem menu, toque sustentado com feedback, contextmenu aos 500 ms sem abertura, menu após 900 ms, editar/cancelar, touchcancel e clique direito desktop. Browser plugin indisponível; Playwright instalado. Eventos de toque sintéticos; Safari nativo não certificado. Capturas `menu-mobile.png` e `menu-desktop.png` no diretório de evidência. Suíte ampla do shell não repetida: alteração restrita ao gesto; cenários pertinentes executados após build final.

`python3 ../publish.py` exit 0 usando `scripts/deploy.sh --from`: build `VpqUQkfWDgyJNn4Tx8i-w`, restart, health local/público 200, agendadores restaurados. `python3 ../verify-public.py` exit 0: ambos healthy, assets JS/CSS idênticos, API anônima 401, login protegido. Backup `/root/.cache/gaucho-deploy/20261021T172749Z/next-before`; preservar fonte. Sem geração paga ou dados pessoais no QA; sem commit/push.

### Rodada inicial

Fonte validada: `/root/.cache/gaucho-mobile-20261021/source`. Evidências completas: `/root/.cache/gaucho-mobile-20261021/evidence`. Build publicada: `6dxYdQfcARJRrT0-1qEkK`.

| Gate | Resultado final |
| --- | --- |
| `NEXT_PUBLIC_BASE_PATH=/chat next typegen` | exit 0 |
| `node node_modules/typescript/bin/tsc --noEmit` | exit 0; TypeScript também aprovado no build final |
| `npm run lint` | exit 0, zero erros; um warning anterior em `CommandComposerContainerV2.test.tsx` |
| ESLint focado após refinamentos/recuperação dos seis arquivos DeepSeek publicados | exit 0 |
| `npm test -- --maxWorkers=2` sem prefixo no ambiente unitário | exit 0; 215 arquivos e 1.139 testes aprovados, zero falhas/skips |
| `NEXT_PUBLIC_BASE_PATH=/chat NEXT_PUBLIC_APP_URL=https://sonaris.us/chat npm run build` | exit 0; avisos anteriores de tracing/Edge preservados |
| `qa.mjs` temporário, Chrome/Playwright | exit 0; 320×740, 390×844, 844×390 e 1440×1000; editor, botões, zoom 200%, toque cancelado, movimento reduzido e geração concorrente |
| `qa-sidebar.mjs` temporário | exit 0; 6 cenários de abertura/rolagem/áudio/foco/rascunho/paleta |
| `scripts/qa-discover-controls.mjs` | exit 0; 7 verificações de controles/áudio/layout/preservação |
| `scripts/deploy.sh --from /root/.cache/gaucho-mobile-20261021/source` | exit 0; restart e health local/público 200 |
| `verify-public.py` temporário | exit 0; ambos healthy, JS/CSS públicos idênticos à build, API anônima 401 e redirecionamento para login |

DECISÕES: preservar zoom manual e desktop; editor mobile ocupa o lugar do composer principal; preservar rascunho enquanto a geração impede reenviar; acompanhar pan nativo em vez de disputar scroll. Durante QA foi reproduzido e corrigido o auto-scroll que escondia editor antigo em paisagem. A auditoria paralela revelou WIP DeepSeek `low`: a candidata recuperou seis arquivos da build viva (`max`), mantendo intactos os arquivos pendentes do checkout. `runtime-preserved.json` registra os caminhos. Nenhuma alteração de provider foi publicada com esta rodada.

Tentativas anteriores registradas: erro de tipo na assinatura do mock novo corrigido; 3 testes falharam inicialmente porque o runner exportou `/chat` para unitários que esperam `/api`, corrigido no ambiente sem alterar as asserções; primeiro smoke de sidebar mediu largura antes de terminar a redução, e a cópia temporária passou a aguardar a mesma condição; ajustes do harness mobile corrigiram chamada de `emulateMedia`, limpeza de menu entre cenários e encerramento de requests sintéticos no replay público. Logs dessas tentativas foram preservados. Suítes/builds foram repetidos após alterações relevantes e após reconciliar a base publicada.

Browser plugin ausente; usado Google Chrome instalado. Sem suíte Playwright central configurada: executados os harnesses pertinentes ao shell e ao fluxo alterado. Teclado é simulado, sem certificação de teclado nativo do Safari/PWA. Nenhum provider pago ou dado pessoal foi usado nos cenários; produção validada por health, acesso anônimo e assets. Backup da versão anterior: `/root/.cache/gaucho-deploy/20261021T163104Z/next-before`. Manter a origem da build.

Replay adicional após publicação (`QA_PUBLIC_REPLAY=true node qa.mjs`): exit 1, não contabilizado como aprovação. Documento/APIs sintéticos locais e assets públicos; a primeira tentativa encontrou request em encerramento de contexto, e a segunda atingiu timeout ao reabrir o item de edição depois dos gestos/movimento reduzido (elemento instável e depois removido). Não foi determinada a causa desse timeout adicional; o mesmo fluxo na candidata teve exit 0. Evidências: `public-browser.log` e `published/failure.png`. A validação pública confirmada permanece health, autenticação anônima e correspondência byte a byte de JS/CSS, sem afirmar sessão real autenticada ou teclado nativo Safari validado.

## 2026-10-23 — Ditado Realtime (preparação isolada)

Gates finais exit 0: `npm test` (221 arquivos/1.193 testes), `npx --no-install tsc --noEmit`, `npm run lint`, `npm run build` e Chrome/Playwright (oito cenários desktop/mobile). Um warning de lint anterior; três warnings de build nas categorias de instrumentação/tracing já observadas, com comparação detalhada no registro. Unit systemd, sintaxe Bash, launcher sintético/health e diff aprovados. Build `BDr0Qzt70HLiGVp34_yrF`. Matriz de comandos, resultados, tentativas e limitações em `docs/DITADO-REALTIME.md`; logs `/root/.cache/gaucho-ditado-realtime/`. Não publicado.


### Publicação do ditado — 23/10/2026

`apache2ctl configtest`, `scripts/deploy.sh --from /root/worktrees/gaucho-ditado-realtime`, `verify-deploy.mjs`, `public-browser.mjs` e `check-assets.mjs`: exit 0. Realtime real com texto antes de stop; fallback NDJSON done/200; WS anônimo 401/origem inválida 403; 23 assets + worklet iguais. Chrome desktop/mobile sem erros, dados interceptados/sintéticos. Evidências `/root/.cache/gaucho-ditado-realtime/`; relatório `docs/DITADO-REALTIME.md`.

## 2026-10-23 — Codex: exclusão de notícias preparada

npm test: 223 arquivos/1.213 testes, exit 0. npx --no-install tsc --noEmit, npm run lint e npm run build: exit 0. Build lC8e60dlN4-pot2IHPGo4. Chrome: qa-discover-delete.mjs (5 cenários), qa-discover-controls.mjs (7 checks), qa-discover-sidebar.mjs (6 cenários), todos exit 0. Lint final do harness: exit 0. Logs, tentativas anteriores e limites em docs/DESCOBRIR-EXCLUSAO.md e /root/.cache/gaucho-discover-delete/gates.json.

23/10/2026 — Codex: exclusão Descobrir publicada por autorização de Anders. Deploy exit 0; health 200 local/público; auth DELETE 401/400; Chrome público 1440/390 com fixtures interceptadas, exit 0; 24 assets e worklet idênticos. Backup e limites em docs/DESCOBRIR-EXCLUSAO.md.

## 2026-10-27 — Consolidação Git (Descobrir no painel, largura do painel, avatares, DeepSeek low)

| Comando | Resultado |
|---|---|
| `npm test` | exit 0; 223 arquivos, 1.213 testes |
| `npx tsc --noEmit` | exit 0 |
| `npx eslint --ignore-pattern '.next-before-*/**'` | exit 0; 1 warning preexistente (`_content` em `CommandComposerContainerV2.test.tsx`) |
| `npm ci` + `NEXT_PUBLIC_BASE_PATH=/chat npm run build` (cópia isolada) | exit 0; 43/43 páginas; build `HhhX-d4wUktJ5p6Si2U9G`; 2 avisos conhecidos de Edge em `instrumentation.ts` |
| `git push --dry-run` com `GITHUB_TOKEN` | exit 0; com `GH_TOKEN`, 403 |

Primeira execução de `npm run lint` interrompida após ~9 min: lintava o backup `.next-before-sc2-20260906T170822Z` dentro do repo. Sem suíte Playwright central configurada.

## 2026-10-27 — Logos SVG Claude/DeepSeek nos avatares

| Comando | Resultado |
|---|---|
| `npx vitest --run components/chat/MessageBubble.avatar.test.tsx` (RED) | 3 failed, 2 passed: Sonnet/Opus/DeepSeek sem `svg[aria-label]` |
| idem (GREEN) | 5 passed |
| `npm test` | exit 0; 224 arquivos, 1.218 testes |
| `npx tsc --noEmit` | exit 0 |
| `npx eslint --ignore-pattern '.next-before-*/**'` | exit 0; 1 warning preexistente |
| `NEXT_PUBLIC_BASE_PATH=/chat npm run build` (cópia isolada) | exit 0; build `v33VHEZLnntZ8uAp4lyOi`; 3 avisos conhecidos |
| Prévia estática Chrome 28/34 px, escuro/claro | logos legíveis |

## 2026-10-28 — Régua tipográfica fluida do shell e painel operacional

| Comando | Resultado |
|---|---|
| `npx vitest --run app/globals.visual.test.ts` (RED) | 11 failed, 17 passed: tokens sem `clamp()`, `text-xs`/`text-sm` soltos, `text-body`/`h2`/`h1` fora do `@theme`, mobile sem `--text-xs`, título do painel em `text-xs`, `text-[10px]` no Pulse |
| idem após a régua no CSS | 2 failed (título e `text-[10px]`), 26 passed |
| `npx vitest --run lib/utils.test.ts` (RED) | 2 failed: `cn("text-nano text-muted-foreground")` → `text-muted-foreground`; `cn("text-xs","text-caption")` mantinha os dois |
| idem (GREEN, `extendTailwindMerge`) | 2 passed |
| `npx vitest --run app/globals.visual.test.ts lib/utils.test.ts` após passe no painel | 30 passed |
| `npm test` (1ª) | 1 failed, 1.230 passed: `PulsePanelV2.test.tsx` fixava `text-micro` no botão Áudio (relacionado; contrato novo é `text-xs` do Button) |
| `npm test` (final) | exit 0; 225 arquivos, 1.231 testes |
| `npx tsc --noEmit` | exit 0 |
| `npx eslint --ignore-pattern '.next-before-*/**'` | exit 0; 1 warning preexistente (`_content` em `CommandComposerContainerV2.test.tsx`) |
| `npm ci` + `NEXT_PUBLIC_BASE_PATH=/chat npm run build` (cópia `/root/.cache/gaucho-typography/source`) | exit 0; build `w44WjVMOOcMcO0_rZRwgd`; CSS compilado com `md\:text-body` |
| QA Playwright (cópia isolada, porta 3148, dados sintéticos; script `/root/.cache/gaucho-typography/qa/qa-typography.mjs`) | 1024/1280/1440/1920/390: régua conforme; 0 erro de console, 0 rede externa, sem transbordo; 3 quebras de hierarquia (`###` < corpo a partir de ~1344 px, corpo Pulse expandido > título do cartão, seções > título do painel no mobile) |
| `npx vitest --run components/chat/chatMarkdownRenderer.test.tsx` (RED títulos em `em`) | 1 failed, 2 passed |
| idem (GREEN) | 3 passed |
| `globals.visual.test.ts` hierarquia do painel (RED → GREEN) | 1 failed, 28 passed → 70 passed (com workspace-v2 e discover) |
| `npm test` (final) | exit 0; 225 arquivos, 1.233 testes |
| `npx tsc --noEmit` / `npx eslint --ignore-pattern '.next-before-*/**'` | exit 0 / exit 0, 1 warning preexistente |
| Build isolado final | exit 0; build `jisCdWPw4ebvobz44r3xU` |
| QA Playwright repetida na build final | exit 0; `###` 17,7/18,5/19,4 px contra corpo 15,4/16,2/17 (1024/1440/1920); corpo expandido = título do cartão; mobile 390 igual ao anterior (corpo 14, `###` 16, seções e título do painel 12); 0 erro, cleanup ok |
| `bash scripts/deploy.sh --from /root/.cache/gaucho-typography/source` | exit 0; `jisCdWPw4ebvobz44r3xU` publicada; health local/público 200; CSS público sha256 = local; `/chat` anônimo 307 |
| `npm test` antes do commit (1ª) | 1 failed, 1.232 passed: timeout de 5 s em `lib/server/soundcase/jobs.test.ts` ("resumes only invalid completed chunks"), arquivo não tocado, load average 5,6 — instabilidade, não regressão |
| `npx vitest --run lib/server/soundcase/jobs.test.ts` / `npm test` (repetição) | 20 passed / exit 0, 225 arquivos, 1.233 testes; tsc, eslint e `git diff --check` exit 0 |

## 2026-10-28 — Painel operacional flutuante no desktop

| Comando | Resultado |
|---|---|
| `npx vitest --run lib/layout/breakpoints.test.ts app/globals.visual.test.ts components/workspace-v2/WorkspaceLayoutV2.test.tsx` (RED) | 3 failed, 35 passed: constantes ausentes, tokens 500/640 fixos, sem `data-context-mode="floating"` |
| idem + `components/workspace-v2` (GREEN) | 56 passed |
| `npx tsc --noEmit` (1ª) | exit 2: `KeyboardEvent` do React no listener do `window`; corrigido para `globalThis.KeyboardEvent` |
| Build isolado (1ª) | falhou pelo mesmo erro de tipo; após a correção, exit 0 |
| QA Playwright dedicada (`/root/.cache/gaucho-typography/qa/qa-floating.mjs`) | 1024–1772 flutuante sem overlay/dialog, chat digitável e rolável, Esc fecha; 1773/1920 encaixado; balões 672/736 iguais aberto/fechado; varredura 1773–1900 sempre no máximo; mobile Sheet inalterado; 0 erro/0 rede externa. Bug: botão "Painel contextual" visível no encaixe (`md:inline-flex` vencia `min-[1773px]:hidden`) |
| Correção com faixa empilhada (1ª tentativa `max-[1772px]`) | CSS compilado `not all and (min-width:1772px)`: escondia em 1772; trocado para `max-[1773px]`/`max-[1281px]` |
| `npx vitest --run app/globals.visual.test.ts components/workspace-v2 lib/layout` | 62 passed |
| `scripts/qa-discover-panel.mjs` adaptado (cópia isolada, build `MiO36uNvfauRgmXSemoNZ`) | exit 0; 13 cenários: flutuante 820–1772, encaixado 1773–6880, mobile 320/390/1100×440, transição 1773↔1772 com aba e rascunho |
| `npm test` final | exit 0; 226 arquivos, 1.236 testes |
| `npx tsc --noEmit` / `npx eslint --ignore-pattern '.next-before-*/**'` / `git diff --check` | exit 0 / exit 0, 1 warning preexistente / exit 0 |
| `bash scripts/deploy.sh --from /root/.cache/gaucho-typography/source` | exit 0; `MiO36uNvfauRgmXSemoNZ` publicada; health local/público 200; CSS público sha256 = local; `/chat` anônimo 307 |

## 2026-11-09 — Container queries no painel operacional, Bloco 1 (Claude)

Worktree `/root/worktrees/gaucho-container-queries`, branch `claude/container-queries-painel`, base `a572615`. Plano em `docs/plans/2026-11-09-container-queries-painel.md`.

| Comando | Resultado |
|---|---|
| Prova de sintaxe: `compile()` do Tailwind 4.1.18 com `@custom-variant panel-cozy (@container gc-panel (width >= 30rem))` | gera `@container gc-panel (width >= 30rem)`; empilha com `md:` |
| `npx vitest --run app/globals.visual.test.ts components/workspace-v2/ContextPanelV2.test.tsx components/discover/DiscoverPage.test.tsx` (RED) | 6 failed, 46 passed: container `gc-panel` ausente, variants `panel-cozy`/`panel-wide` ausentes, capas do Pulse e do Descobrir ainda em `md:h-*`, raiz do painel sem `gc-panel-container` |
| idem (GREEN) | 3 arquivos, 52 passed |
| `npm test` | exit 0; 228 arquivos, 1.248 testes |
| `npx tsc --noEmit` / `npm run lint` / `git diff --check` | exit 0 / exit 0, 1 warning preexistente (`CommandComposerContainerV2.test.tsx:120`) / exit 0 |
| Build isolado (`NEXT_PUBLIC_BASE_PATH=/chat`) | exit 0; build `Rux55GdXQXh24d1ZYOKaY`; CSS compilado com `.gc-panel-container{container:gc-panel/inline-size}` e `.panel-cozy\:h-24/32/40/52` sob `@container gc-panel (min-width:30rem)` |
| `scripts/qa-discover-panel.mjs` (com asserção da capa e cenário 956×440) | exit 0; 14 cenários; capa 96 px em painel ≥ 480 px (desktop 500–600, igual a antes) e 80 px no celular em pé (320/390, igual a antes); celular deitado 1100×440 e 956×440 passa de 80 para 96 px |
| `scripts/qa-discover-controls.mjs` | exit 0 |
| `scripts/qa-discover-delete.mjs` (1ª) | exit 1, PRE_EXISTING_FAILURE: esperava "Abrir painel" em 1440 px, corte antigo de 1280; desde `ffb90c0` o painel flutua até 1772 px. Harness corrigido para o corte de 1773 |
| `scripts/qa-discover-delete.mjs` (2ª) | exit 0; 5 cenários (página 1440/390/320, painel 1440/390) |

Não rodados neste bloco: `qa-grok-soundcase`, `qa-grok-catalog`, `qa-runtime-ownership`, `qa-security-runtime` (superfícies não tocadas; ficam para o gate final da entrega). Evidências em `/root/.cache/gaucho-container-queries/qa/`.

## 2026-11-09 — Container queries no painel operacional, Bloco 2 (Claude)

Duas colunas de cartões no painel ampliado (`panel-wide`), Pulse e Descobrir embutido; cartão aberto ocupa as duas.

| Comando | Resultado |
|---|---|
| `npx vitest --run app/globals.visual.test.ts components/discover/DiscoverPage.test.tsx` (RED) | 3 failed, 50 passed: grade do Pulse sem `panel-wide:grid-cols-2`, grade do Descobrir embutido idem, cartão aberto sem `panel-wide:col-span-2` |
| idem + `PulsePanelV2.test.tsx` (GREEN) | 3 arquivos, 56 passed |
| Build isolado (1ª) + `scripts/qa-discover-panel.mjs` (1ª) | build `owLM3TdEM-EYOZkNFO_mo` exit 0; harness exit 1 em 1199 px: "Descobrir ampliado em duas colunas". Erro meu de 1 px: painel ampliado de 640 px tem miolo de 639 px (borda do aside) e o corte de 40rem não disparava |
| Correção: `panel-wide` em 38.75rem (620 px); teste de contrato passa a derivar a folga da borda | com o corte antigo o teste novo falha (`expected 640 to be less than or equal to 638`); com o novo, 80 passed em `globals.visual` + `discover` + `workspace-v2` |
| Build isolado (2ª) + harness (2ª) | build `k2hhFH2cO5IwW4sct-9nc` exit 0; harness exit 1 em 1100×440: "Pulse em 2 coluna(s)". Captura mostrava as duas colunas corretas; cenário isolado passou com medidas estáveis desde o instante zero. Corrida do harness (duas medições seguidas com o layout assentando), não defeito do app |
| Harness com espera de estabilização (`until`) nas checagens de coluna (3ª) | exit 0; 14 cenários: 1 coluna em painel 320–600 px, 2 colunas em 956 e 1100 px (sheet deitado) e em todo ampliado desktop; aberto ocupa as duas; volta a 1 coluna ao reduzir |
| `npm test` | exit 0; 228 arquivos, 1.251 testes |
| `npx tsc --noEmit` / `npm run lint` / `git diff --check` | exit 0 / exit 0, 1 warning preexistente / exit 0 |
| `scripts/qa-discover-controls.mjs` / `scripts/qa-discover-delete.mjs` | exit 0 / exit 0 |

Não rodados neste bloco: `qa-grok-soundcase`, `qa-grok-catalog`, `qa-runtime-ownership`, `qa-security-runtime` (ficam para o gate final). Evidências em `/root/.cache/gaucho-container-queries/qa/bloco2/`.

## 2026-11-09 — Coluna do chat pelo próprio espaço, Bloco 3 (Claude)

Limpeza das classes de largura mortas, `chat-wide` nas boas-vindas e remoção do override cru por container.

| Comando | Resultado |
|---|---|
| `scripts/qa-chat-column.mjs` novo, linha de base no build `k2hhFH2cO5IwW4sct-9nc` (1ª) | exit 1 no 3º cenário: a conversa nova criada para medir as boas-vindas ficava persistida e o cenário seguinte abria nela. Vazamento de estado do harness; passa a regravar os dados sintéticos a cada cenário |
| idem (2ª), linha de base | exit 0; 11 cenários (390 a 1920 px). Thread 928 px, balões 672/736 px e composer 896 px iguais em 1489 e 1490 px: as classes `min-[1490px]` eram código morto. Boas-vindas: 1 coluna com vão de 13,6 px em 900 e 1023 px, apesar de coluna de 839 e 962 px |
| `npx vitest --run app/globals.visual.test.ts` (RED) | 2 failed, 35 passed: variant `chat-wide` ausente; classes de largura mortas presentes |
| `npx vitest --run app/globals.visual.test.ts components/chat components/workspace-v2` (GREEN) | 19 arquivos, 106 passed |
| Tokens órfãos `--gc-mobile-welcome-panel-{x,y,radius}` e `--gc-mobile-welcome-grid-gap` removidos (8 linhas) com contrato | sem outro consumidor em código, testes, scripts ou docs |
| `npm test` | exit 0; 228 arquivos, 1.254 testes |
| `npx tsc --noEmit` / `npm run lint` / `git diff --check` | exit 0 / exit 0, 1 warning preexistente / exit 0 |
| Build isolado | exit 0; build `FRDGd_PNqrykr4LUFLvJ0` |
| `scripts/qa-chat-column.mjs` no build novo, comparado à linha de base | exit 0; thread, balões e composer idênticos em 11 de 11 cenários; boas-vindas idênticas em 8 de 10 e mudam só em 900 e 1023 px (1 coluna/13,6 px → 2 colunas/36 px) |
| `scripts/qa-discover-panel.mjs` no build novo | exit 0; 14 cenários |

Não rodados neste bloco: `qa-discover-controls`, `qa-discover-delete` (Descobrir não tocado), `qa-grok-soundcase`, `qa-grok-catalog`, `qa-runtime-ownership`, `qa-security-runtime` (ficam para o gate final). Evidências em `/root/.cache/gaucho-container-queries/qa/bloco3-antes/`, `bloco3-depois/` e `bloco3-painel/`.

## 2026-11-09 — Polimentos de leitura, Bloco 4 (Claude)

`text-wrap: balance` em títulos sem corte de linhas, `text-wrap: pretty` em texto parado (painel e Descobrir) e marca `data-streaming` no markdown em streaming.

| Comando | Resultado |
|---|---|
| Prova no Chrome 156 (página avulsa): `balance` em título com `line-clamp-2` | sem efeito algum, com 2 ou 3+ linhas; títulos de cartão ficam fora da regra |
| Prova no Chrome 156: `balance` em título sem corte, 340 px | linhas 306/338/277/75 px viram 306/249/237/203 px; `pretty` só age quando a última linha fica com palavra sozinha |
| `npx vitest --run app/globals.visual.test.ts components/chat/StreamingMarkdown.test.tsx` (RED) | 3 failed, 39 passed: regra de `balance` ausente, regra de `pretty` ausente, `data-streaming` ausente. O contrato dos pares `100vh`/`100dvh` nasce verde: os pares já existiam (o plano contou a linha de fallback como pendência) |
| `npx vitest --run app/globals.visual.test.ts components/chat` (GREEN) | 12 arquivos, 84 passed |
| `npm test` | exit 0; 229 arquivos, 1.258 testes |
| `npx tsc --noEmit` / `npm run lint` / `git diff --check` | exit 0 / exit 0, 1 warning preexistente / exit 0 |
| Build isolado | exit 0; build `AI1H1D_FOemEZxZr6ZbWA` |
| `scripts/qa-chat-column.mjs` (com checagem de `textWrapStyle`) | exit 0; 11 cenários; título do balão e das boas-vindas `balance`, parágrafo do balão `auto`; larguras e boas-vindas idênticas ao Bloco 3 |
| `scripts/qa-discover-panel.mjs` (idem) | exit 0; 14 cenários; parágrafos da matéria `pretty`, título da geração Pulse `balance` |
| `scripts/qa-discover-controls.mjs` / `scripts/qa-discover-delete.mjs` | exit 0 / exit 0 |
| `scripts/qa-security-runtime.mjs` | exit 0; 9 verificações, incluindo login e shell em 1440 e 390 px |

Não executados: `qa-grok-catalog` e `qa-grok-soundcase` (de 21/09). Pela leitura, estão obsoletos: não autenticam, e desde 22/09 o runtime de produção recusa boot sem auth; o de catálogo ainda espera "Grok 4.7" no seletor de texto, removido em 13/10. `qa-runtime-ownership` não é harness de navegador (smoke de processos e units) e cobre código não tocado. Evidências em `/root/.cache/gaucho-container-queries/qa/bloco4-*/` e `final-security/`.

## 2026-11-09 — Thread longa com `content-visibility`, Bloco 5 (Claude)

Medição, não implementação: nenhum arquivo do app mudou e nenhum teste foi criado. Script `medir-thread-longa.mjs` (fora do repositório, guardado com as evidências) sobe o build isolado `AI1H1D_FOemEZxZr6ZbWA` na porta 3148 com dados sintéticos e compara o app atual contra o mesmo app com `.gc-message-row{content-visibility:auto;contain-intrinsic-size:auto 220px}` injetado no navegador.

| Execução | Resultado |
|---|---|
| Fumaça, 60 mensagens, 1 repetição, desktop e celular 4x | exit 0; fim da thread visível nas duas variantes; rolar ao topo 39 → 359 quadros (desktop) e 47 → 543 (celular); capturas em repouso equivalentes |
| Rodada 60 e 300 mensagens, 3 repetições | interrompida aos 17 de 24 casos por decisão conjunta com Anders; só os tempos de carga ficaram registrados (`progresso.txt`), faixas sobrepostas entre as variantes |

Decisão: não entra. Suítes do projeto não foram reexecutadas neste bloco porque o código é o mesmo do gate final do Bloco 4. Limpeza conferida: processo e servidor encerrados, porta 3148 livre, `data/` sintética removida. Evidências em `/root/.cache/gaucho-container-queries/qa/bloco5-medicao/`.

## 2026-11-09 — Publicação dos blocos 1 a 4 (Claude)

Autorizada por Anders. A build publicada é a mesma do gate final do Bloco 4; nenhum arquivo de código era mais novo que `.next/BUILD_ID` no momento do deploy.

| Verificação | Resultado |
|---|---|
| `bash scripts/deploy.sh --from /root/worktrees/gaucho-container-queries` | exit 0; `gz-rfWQLxKyrhbFFQ7nHU` → `AI1H1D_FOemEZxZr6ZbWA`; health local 200 e público 200 |
| `/chat/api/health` local e público | `healthy` nos dois |
| `/chat/login` público; `POST /chat/api/chat` e `GET /chat/api/conversations` anônimos | 200; 401; 401 |
| CSS público × candidata (SHA-256) | idêntico; contém `gc-panel`, `panel-cozy` e `text-wrap:balance` |
| Units: serviço, ponte de ditado, timers Pulse/SoundCase/Discover, path SoundCase | todas `active`; ponte de ditado sem restart |
| Processos antigos após o restart | encerrados; só o servidor novo escuta em 3040 (aviso `left-over process` preexistente) |

Evidências em `/root/.cache/gaucho-container-queries/evidence` (`deploy.log`). Não validado nesta rodada: Safari/iPhone físico, que depende de Anders.

## 2026-11-09 — Bloco 5, complemento: rodada completa e diagnóstico de rolagem (Claude, sessão paralela)

Feito por uma segunda sessão que seguiu medindo sem saber que o bloco já tinha sido encerrado na outra. Não altera a decisão registrada acima ("não entra"); acrescenta dados e uma causa. Nenhum arquivo do app mudou. A rodada interrompida gravava só no fim; o script passou a gravar a cada execução (`raw.jsonl`) e a campanha foi refeita em três pedaços, todos exit 0, 24 de 24 execuções.

Mediana de três repetições, trabalho da thread principal (`TaskDuration`), atual → com a regra:

| Thread e aparelho | Abrir a conversa | Resposta chegando (60 acréscimos) | Largura muda 3x | Rolar ao topo, 700 px por quadro |
|---|---|---|---|---|
| 60 msgs, desktop | 2.147 → 2.203 ms (+3%) | 495 → 398 ms (−20%) | 1.067 → 732 ms (−31%) | 39 → 359 quadros |
| 60 msgs, celular 4x | 7.946 → 7.887 ms (−1%) | 2.076 → 1.465 ms (−29%) | 3.302 → 1.295 ms (−61%) | 47 → 543 quadros |
| 300 msgs, desktop | 4.860 → 4.350 ms (−10%) | 952 → 492 ms (−48%) | 2.892 → 625 ms (−78%) | 190 quadros → teto de 60 s sem chegar |
| 300 msgs, celular 4x | 21.335 → 17.782 ms (−17%) | 5.263 → 2.106 ms (−60%) | 12.652 → 1.406 ms (−89%) | 227 quadros → teto de 600 quadros sem chegar |

Script na carga de 300 mensagens no desktop: 3.658 contra 3.668 ms, ou seja, a regra não alivia o React. Fim da thread visível e distância zero do fundo após a carga em todas as execuções.

| Diagnóstico | Resultado |
|---|---|
| `diagnosticar-rolagem.mjs`: roda do mouse real, 700 px por passo, 1280×900, teto de 90 s | 60 msgs atual: topo em 37 passos, 0 recuos. 60 msgs com a regra: 170 passos sem passar da mensagem 51 de 60, 13 recuos. Com a regra e `overflow-anchor: none`: 156 passos, 12 recuos, mesma forma. 300 msgs: atual 0 recuos; com a regra 12 recuos, parou na mensagem 279 |
| Traço passo a passo (`diagnostico-60-cv.json`) | a cada mudança de altura da thread a posição volta para o mesmo ponto colado no fim; a ancoragem do navegador não é a causa |
| `provar-puxao.mjs`: build atual, sem regra nenhuma; leitura a 2.100 px do fim, depois o último balão cresce | posição puxada para o fim (distância 0): `puxouParaOFim: true` |

Causa lida no código: `deriveScrollState` (`lib/chat/scrollState.ts:34`) devolve "tracking" sempre que `isTrackingBottom` é verdadeiro, e `syncScrollState` (`components/chat/ChatContainer.tsx:379`) só zera a ref quando o modo é "reading-history"; a ref nasce verdadeira e nunca sai. `scrollState.test.ts` só cobre `isTrackingBottom: false`. Com a regra, cada linha revelada muda a altura e dispara o puxão; sem a regra, o mesmo puxão deve ocorrer quando uma resposta chega enquanto se lê o histórico.

Não validado: streaming real (o crescimento foi simulado por DOM), Safari/iPhone, estado de hover com a contenção de pintura. "Celular" é Chrome de servidor com CPU freada 4x. Limpeza conferida: porta 3148 livre, `data/` sintética removida. Evidências e os três scripts em `/root/.cache/gaucho-container-queries/qa/bloco5-medicao/` (`saida-60.txt`, `saida-300-desktop.txt`, `saida-300-celular.txt`, `raw.jsonl`, `diagnostico*.json`, `prova-puxao-atual.json`).

## 2026-11-19 — Editor do catálogo portado para a `main` (sem a Anil)

Worktree `/root/worktrees/gaucho-catalog-editor-main`, branch `feat/catalog-editor` sobre `f5fe8fe`. Onze arquivos do editor copiados de `/root/worktrees/gaucho-catalog-editor`, sem os registros e sem `INFRASTRUCTURE.md`. O `globals.css` da origem é idêntico ao da `main`.

Primeira execução: typegen 0, tsc 0, lint 0 (1 aviso preexistente `_content`), vitest 234 arquivos/1.292 testes, build 0. O primeiro aceite falhou porque a build tinha saído sem `NEXT_PUBLIC_BASE_PATH=/chat` e os chunks deram 404. Com a build refeita no env do deploy (`QC5Ih-TAX9mHi3BHDGHPN`), o aceite Chrome com provedores sintéticos (`accept-main.mjs`, cópia do `accept.mjs` com a worktree nova na lista permitida) passou 15/15. Logs em `/root/.cache/gaucho-editor-main-20261119/`; evidências em `/root/.cache/gaucho-editor-qa/run-HoGppM`.

## 2026-11-19 — Gemini como provedor do catálogo (Neon e Hydrogen)

Worktree `/root/worktrees/gaucho-gemini4`, branch `feat/gemini-4-models` sobre `6e4f10e`. RED: 13 testes novos falharam (reconhecimento `gemini-*`, adapter com o modelo do pedido, cadastro via `models.get`), 33 antigos verdes. Dois testes de "modelo embutido" foram retirados ao decidir não inventar preço para Neon/Hydrogen. GREEN focado: 8 arquivos, 68 testes.

Gates completos: typegen 0, tsc 0, lint 0 (1 aviso preexistente), vitest 236 arquivos/1.314 testes, build 0 com `NEXT_PUBLIC_BASE_PATH=/chat`. Logs em `/root/.cache/gaucho-gemini4-20261119/`.

Smoke real com o Google (rodado por Anders em 2026-11-20, via `gemini-smoke.sh` no scratchpad da sessão): `gemini-4-neon` e `gemini-4-hydrogen` com thinking low pelo adapter da worktree, os dois com `DONE` e texto de resposta. A primeira tentativa do script falhou no tsx (top-level await em saída CJS); corrigido com `main()` assíncrona. Aceite Chrome do cadastro pelo editor fica para depois do deploy.

## 2026-11-19 — Fonte dos balões desktop 14,5–15,5px

Pedido de Anders: reduzir de leve a fonte dos balões. Token `--gc-text-body` em `.gc-message-card` (desktop) passou de 15–16px para 14,5–15,5px com a mesma inclinação; mobile e paisagem com toque intactos (14px). RED: teste de contrato em `app/globals.visual.test.ts` falhou antes do CSS (1 failed/41 passed); GREEN 42/42. `qa-chat-column.mjs` passou a exigir 14,5–15,5px.

Gates na mesma worktree do Gemini: tsc 0, lint 0 (1 aviso preexistente), vitest 1.315 testes, build `Mj7zxrfqGjoUiG5GImL_o` com basePath `/chat`, `qa-chat-column` exit 0 (de 390 a 3440px; 15,5px a partir de 1920px, 14px no mobile, larguras inalteradas). Logs em `/root/.cache/gaucho-gemini4-20261119/`.


## 2026-11-23 — Repaginação Visual (Abyssal Ocean & Polar Fjord) e Layout Reativo (1280px+)

- **Worktree isolada:** `/root/worktrees/gaucho-ocean-layout` (branch `feat/ocean-layout-redesign`, base `77cb98f`)
- **Testes focados (primeira bateria após ajuste de seletor):**
  - `npx vitest run app/globals.visual.test.ts lib/layout/breakpoints.test.ts components/workspace-v2/WorkspaceLayoutV2.test.tsx components/workspace-v2/ConversationRailV2.test.tsx components/chat/MessageBubble.avatar.test.tsx components/chat/MessageBubble.edit.test.tsx lib/server/soundcase/jobs.test.ts` → `7 passed (7)`, `85 passed (85)` em `13.63s`.
- **Suíte unitária completa:**
  - `npx vitest run --maxWorkers=2` → `Test Files 237 passed (237)`, `Tests 1321 passed (1321)` em `104.03s`.
- **Typegen, TypeScript e Lint:**
  - `npx next typegen` → `✓ Types generated successfully`
  - `npx tsc --noEmit` → `exit 0` (0 erros)
  - `npm run lint` → `exit 0` (0 erros, 1 warning preexistente em `CommandComposerContainerV2.test.tsx`)
- **Build de produção isolada:**
  - `NEXT_PUBLIC_BASE_PATH=/chat NEXT_PUBLIC_APP_URL=https://sonaris.us/chat npm run build` → `exit 0`, `44/44` rotas compiladas.
- **Suítes Playwright Chrome (6/6 aprovadas):**
  - `node scripts/qa-chat-column.mjs` → `17/17` cenários aprovados (`390×844` a `3440×1440`, encaixe `1280px` normal e `1440px` expandido).
  - `node scripts/qa-discover-panel.mjs` → `14/14` cenários aprovados (Dark/Light, `320px` a `6880px`, `breakpointResize: true` em `1280px`).
  - `node scripts/qa-message-longpress.mjs` → `12/12` cenários aprovados (`390×844`, `956×440`, `1440×1000`; `short`, `top`, `middle`, `bottom`).
  - `node scripts/qa-discover-controls.mjs` → `7/7` cenários aprovados (`1440px`, `390px`, `320px` Dark/Light).
  - `node scripts/qa-discover-delete.mjs` → `5/5` cenários aprovados (página e painel embutido).
  - `node scripts/qa-security-runtime.mjs` → `9/9` verificações aprovadas.

## 2026-11-24 15h30 BRT — Roboto, respiro desktop e linha de leitura (Claude)

Cópia de trabalho `/root/worktrees/gaucho-desktop-type`, partindo da fonte viva `qYzjpuWm0K0-Ja_nbb6ne` (`/root/.cache/gaucho-mobile-flush/release/source`, intocada).

Unitários (TDD, primeira execução):
- `app/globals.visual.test.ts` › "carrega a Roboto local no escopo do chat, sem Lexend no corpo nem no chat": RED (1ª execução, sem @font-face Roboto) → GREEN.
- `app/globals.visual.test.ts` › "dá respiro de placas flutuantes no desktop e limita a linha de leitura": RED (tokens antigos 68rem/56rem, vão 8/12 px) → GREEN; asserção da barra de ações `min(88%, …)` adicionada depois, RED → GREEN.
- Removido o contrato antigo "balões desktop entre 13,5 e 14,5px" (substituído pela régua 14–15 px acima). `DiscoverPage.test.tsx` só renomeou o título do caso.

Gates: typegen 0 · tsc 0 · lint 0 (1 aviso pré-existente em `CommandComposerContainerV2.test.tsx:120`) · Vitest 1.321/1.321 em 237 arquivos (`--maxWorkers=2`) · build 0 (base `/chat`, URL de QA local).

Chrome (headless, dados sintéticos): qa-chat-column 0 (contrato atualizado: resposta 697 px, mensagem 602 px, fonte 14–15 px; 1ª execução falhou no teto antigo de 896 px, esperado) · qa-discover-panel 0 · qa-discover-controls 0 · qa-discover-delete 0 · qa-runtime-ownership 0 · qa-message-longpress 0 (12 cenários; 1ª execução sem servidor na 3158, repetida com servidor isolado).

Sonda nova `scripts/qa-desktop-type.mjs`: balão 14,0 px em 1024–1436, 14,7 em 1920, 15 em 2560; celular 390 px idêntico ao antes (13,5 px, bordas 0). Capturas antes/depois em `/root/.cache/gaucho-desktop-type/evidence`, logs em `/root/.cache/gaucho-desktop-type/gates`.


## 2026-11-24 16h10 BRT — OpenAI Live 1.1 nas caixinhas de voz e seção de ajustes (Claude)

Cópia de trabalho `/root/worktrees/gaucho-live-voice` (branch `feat/openai-live-voice` a partir de `6e5672b`), com os arquivos do Live trazidos de `/root/worktrees/gaucho-live-11` (Codex, sem commit).

Unitários (TDD, primeira execução):
- `lib/tts/openaiLiveSpeech.test.ts` (3 casos: vozes/padrão, normalização, ritmo → instrução): RED (exports inexistentes) → GREEN.
- `lib/server/openaiLiveSpeech.test.ts` › "abre a sessão com a voz e o ritmo escolhidos": RED (voz fixa Marin) → GREEN; "mantém Marin quando nenhum ajuste chega": verde desde a 1ª execução (contrato preservado).
- `components/settings/OpenAILiveSettingsFields.test.tsx` (2 casos: campos com vozes brasileiras; aparece no SoundCase só com o motor Live): RED (componente inexistente) → GREEN.
- Testes herdados do Codex (`MiniAudioPlayer`, `SoundCaseRealtimeBar`, servidor Live): verdes.

Gates: typegen 0 · tsc 0 · lint 0 (1 aviso pré-existente em `CommandComposerContainerV2.test.tsx:120`) · Vitest 1.334/1.334 em 240 arquivos · build 0 (base `/chat`, URL de QA local, rota nova no manifesto).

Prova real paga (servidor Live direto): Bossa/calmo 3,83 s de áudio pronto em 8,8 s; Tempo/ágil 3,41 s em 7,8 s; transcrição conferida nos dois. PCM em `/root/.cache/gaucho-live-voice/`.

Chrome (sonda nova `scripts/qa-openai-live-settings.mjs`, dados sintéticos, rota Live interceptada): 1440 dark e 390 light aprovados — seção nas Configurações salva Bossa/calmo, três motores no player, escolher o motor não inicia leitura, Tocar envia `voice`/`pace`, sem rolagem horizontal nem pageerror. Capturas em `/root/.cache/gaucho-live-voice/evidence`.

Rodada final após o ajuste do texto ocioso do player (Live: "Pronto · cada trecho é conferido antes de tocar"): tsc 0 · lint 0 erros · Vitest 1.334/1.334 em 240 arquivos · build 0 · Chrome do projeto 6/6 (chat-column, discover-panel, discover-controls, discover-delete, runtime-ownership, message-longpress 12 cenários com servidor temporário na 3158 e `data/` sintética removida) · sonda Live 2/2. Logs em `/root/.cache/gaucho-live-voice/`.
