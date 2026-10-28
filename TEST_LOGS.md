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
