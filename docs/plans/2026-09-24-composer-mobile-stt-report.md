# Registro técnico — composer mobile e STT

Data: 2026-09-24. Branch `codex/composer-mobile-stt-20260924`; base `2e0e37b`; worktree `/root/.cache/gaucho-composer-mobile-stt-20260924`.

## Resultado

- O composer mobile coloca modelo, raciocínio e eventual Pro na primeira faixa; anexo, voz, pesquisa e envio na segunda. O desktop conserva a ordem no DOM e a disposição anterior via `md:contents`.
- A ondinha `AudioLines` aparece somente durante `isRecording`. Usa o nível de áudio para uma variação pequena, mantém “Rec” e `aria-pressed`, some na transcrição e fica estática sob `prefers-reduced-motion`.
- Nenhuma API, rota, persistência ou dado privado foi alterado. Nenhuma publicação, restart, merge ou push.

## DECISÃO:

Agrupamento responsivo por wrappers com `md:contents`, pois mantém a ordem original do desktop e dispensa menus extras no celular. O feedback de voz depende do estado confirmado pelo hook, não do clique, para evitar indicar gravação durante permissão negada. Validado com estados renderizados e microfone simulado no navegador.

## Gates

| Comando | Resultado |
|---|---|
| `vitest run components/workspace-v2/WorkspaceLayoutV2.test.tsx app/globals.visual.test.ts` | exit 0; 2 arquivos, 18 testes passaram. |
| `npx tsc --noEmit` | Primeira tentativa exit 2 por `next-env.d.ts` ausente na worktree nova; `npx next typegen` exit 0 e repetição do TypeScript exit 0. |
| `npm test` | exit 0; 194 arquivos, 990 testes passaram; sem falhas ou skips reportados. |
| `npm run lint` | exit 0; 0 erros e 1 warning anterior em `CommandComposerContainerV2.test.tsx:51`. |
| `npm run build` | Primeira tentativa exit 1: Turbopack recusou symlink de `node_modules` fora da raiz. Após cópia local, repetição exit 0; 42 páginas estáticas geradas, warnings existentes de Edge `process.exit`/tracing Studio. |
| `git diff --check` | exit 0. |

O projeto tem Playwright instalado e scripts de QA, sem suíte/configuração `playwright test` geral. Por isso, foi executado Chrome/Playwright dirigido aos estados e fluxos afetados em vez de inventar uma suíte inteira.

## Browser e integração

- Markup real do composer com CSS da build isolada: 320, 390, 430 e 956×440 px nos estados parado, gravando e transcrevendo. Nenhum overflow de documento ou composer; ondinha somente em gravação. Em movimento reduzido, `animationName=none` e `transform=none`.
- Em 1024×768 px, o CSS compilado manteve numa linha a ordem desktop anexo → modelo → raciocínio → documento → quiz → voz → envio, sem overflow.
- App Next da worktree em `127.0.0.1:3041`, `GAUCHO_ISOLATED_RUNTIME=true` e credenciais sintéticas: 320, 390, 430 e 956×440 px sem overflow ou `pageerror`; menu Pesquisa abre e textarea recebe foco. Microfone simulado entrou em gravação com ondinha e voltou sem ondinha ao parar; `/api/transcribe` foi interceptada com resposta sintética, sem custo de provider.
- Capturas inspecionadas: `/tmp/gaucho-composer-390.png` (CSS da build em dark), `/tmp/gaucho-composer-app-390.png` (app em light), `/tmp/gaucho-composer-app-recording.png` (gravação simulada). O primeiro carregamento da instância vazia provocou corrida de criação de `data/conversations.json` sintético; a repetição estabilizada concluiu sem erro de página. Isso não afeta dados da produção, que não foram acessados.

## Preservação e pendência

O checkout produtivo `/root/CHATGPT`, sua `.next`, dados runtime, serviço, Apache e rota pública não foram modificados. Revisão e fechamento de Anders pendentes; publicação depende de ordem separada.
