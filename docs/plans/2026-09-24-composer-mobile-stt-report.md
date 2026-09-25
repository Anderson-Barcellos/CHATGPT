# Registro técnico — composer mobile e STT

Data: 2026-09-24, revisado em 2026-09-25 conforme correções de Anders. Branch `codex/composer-mobile-stt-20260924`; base `2e0e37b`; worktree `/root/.cache/gaucho-composer-mobile-stt-20260924`.

## Resultado

- O composer mobile ocupa uma faixa: lupa da Pesquisa, modelo, raciocínio/Pro, voz e envio. O botão “+” de anexos foi retirado a pedido de Anders, também no desktop. Imagens coladas, arquivos arrastados e anexos já presentes continuam no fluxo.
- A ondinha `AudioLines` aparece somente durante `isRecording`. Usa o nível de áudio para uma variação pequena, mantém “Rec” e `aria-pressed`, some na transcrição e fica estática sob `prefers-reduced-motion`.
- O frame usa `overflow: clip`: a seleção de modelo já não consegue deslocar o composer horizontalmente por rolagem programática.
- Nenhuma API, rota, persistência ou dado privado foi alterado. Nenhuma publicação, restart, merge ou push.

## DECISÃO:

Anders substituiu a escolha inicial de duas faixas pela faixa única e depois pediu a remoção do botão de anexos. A lupa conserva o menu e ganha nome acessível; o seletor manual e seu input foram removidos, enquanto colar/arrastar continuam. `overflow: clip` impede que o foco do menu desloque o frame: o problema foi observado com `composerX=-64` após selecionar Sol e corrigido para `composerX=1` no mesmo fluxo. O feedback de voz depende do estado confirmado pelo hook, não do clique.

## Gates de 2026-09-24 (versão inicial de duas faixas)

| Comando | Resultado |
|---|---|
| `vitest run components/workspace-v2/WorkspaceLayoutV2.test.tsx app/globals.visual.test.ts` | exit 0; 2 arquivos, 18 testes passaram. |
| `npx tsc --noEmit` | Primeira tentativa exit 2 por `next-env.d.ts` ausente na worktree nova; `npx next typegen` exit 0 e repetição do TypeScript exit 0. |
| `npm test` | exit 0; 194 arquivos, 990 testes passaram; sem falhas ou skips reportados. |
| `npm run lint` | exit 0; 0 erros e 1 warning anterior em `CommandComposerContainerV2.test.tsx:51`. |
| `npm run build` | Primeira tentativa exit 1: Turbopack recusou symlink de `node_modules` fora da raiz. Após cópia local, repetição exit 0; 42 páginas estáticas geradas, warnings existentes de Edge `process.exit`/tracing Studio. |
| `git diff --check` | exit 0. |

O projeto tem Playwright instalado e scripts de QA, sem suíte/configuração `playwright test` geral. Por isso, foi executado Chrome/Playwright dirigido aos estados e fluxos afetados em vez de inventar uma suíte inteira.

## Browser e integração de 2026-09-24 (evidência histórica)

- Markup real do composer com CSS da build isolada: 320, 390, 430 e 956×440 px nos estados parado, gravando e transcrevendo. Nenhum overflow de documento ou composer; ondinha somente em gravação. Em movimento reduzido, `animationName=none` e `transform=none`.
- Em 1024×768 px, o CSS compilado manteve numa linha a ordem desktop anexo → modelo → raciocínio → documento → quiz → voz → envio, sem overflow.
- App Next da worktree em `127.0.0.1:3041`, `GAUCHO_ISOLATED_RUNTIME=true` e credenciais sintéticas: 320, 390, 430 e 956×440 px sem overflow ou `pageerror`; menu Pesquisa abre e textarea recebe foco. Microfone simulado entrou em gravação com ondinha e voltou sem ondinha ao parar; `/api/transcribe` foi interceptada com resposta sintética, sem custo de provider.
- Capturas inspecionadas: `/tmp/gaucho-composer-390.png` (CSS da build em dark), `/tmp/gaucho-composer-app-390.png` (app em light, menu Pesquisa aberto), `/tmp/gaucho-composer-app-recording-valid.png` (gravação simulada após estabilizar o shell). Uma captura anterior com o frame deslocado durante o reuso da sessão de QA foi descartada; a nova sessão confirmou composer em `x=1`, sem overflow. O primeiro carregamento da instância vazia provocou corrida de criação de `data/conversations.json` sintético; a repetição estabilizada concluiu sem erro de página. Isso não afeta dados da produção, que não foram acessados.

## Preservação e pendência

O checkout produtivo `/root/CHATGPT`, sua `.next`, dados runtime, serviço, Apache e rota pública não foram modificados. Publicação depende de ordem separada.

## Revisão final de 2026-09-25

Anders confirmou a faixa única, pediu retirar o botão “+” e aprovou visualmente o resultado (“Bah ficou trrrrri”). A documentação e os testes anteriores de duas faixas ficam como histórico substituído por esta revisão.

| Gate da versão final | Resultado |
|---|---|
| `vitest run components/workspace-v2/WorkspaceLayoutV2.test.tsx components/workspace-v2/CommandComposerContainerV2.test.tsx app/globals.visual.test.ts` | exit 0; 3 arquivos, 19 testes passaram. |
| `npx tsc --noEmit` | exit 0. |
| `npm test` | exit 0; 194 arquivos, 990 testes passaram; sem falhas ou skips reportados. |
| `npm run lint` | exit 0; 0 erros, mesmo warning anterior em `CommandComposerContainerV2.test.tsx:51`. |
| `npm run build` | exit 0; build isolado, 42 páginas estáticas; mesmos warnings de Edge/instrumentation e tracing Studio. |
| `git diff --check` | exit 0. |

Chrome/Playwright autenticado numa instância Next isolada, com usuário sintético e sem provider: 320×844 dark, 390×844 light, 430×844 dark, 956×440 dark e 1024×768 dark. Sol e Pro visíveis; lupa em primeiro lugar, menu Pesquisa funcional, modelo selecionável, envio inteiro; sem botão de anexos, overflow, recorte, quebra de faixa ou `pageerror`. Após escolher Sol, `composerX=1` em todos os cenários mobile; a ordem desktop restante foi preservada. Capturas aprovadas: `/tmp/gaucho-composer-one-row-320.png` e `/tmp/gaucho-composer-one-row-390.png`. A instância local foi encerrada; porta 3041 liberada. Limite: seleção manual de arquivos saiu por pedido de Anders; colar/arrastar preservados por código e testes existentes, sem escrita em dados reais.

## Publicação de 2026-09-25

Anders autorizou publicar, commitar e dar push. O checkout produtivo e `origin/main` estavam limpos em `2e0e37b`; os seis commits da entrega foram integrados por fast-forward até `f5888ba`. A build foi refeita na worktree isolada com `NEXT_PUBLIC_BASE_PATH=/chat`: `npm run build` exit 0, 42 páginas, mesmos warnings anteriores; ID `g3jqXnah4B4NI5lBaGERb`. Instância Next isolada nessa build: login sintético 200, chat anônimo 307, lupa e composer sem overflow ou `pageerror`; health isolado 503 pela ausência deliberada de chave de provider.

Build produtiva anterior `KhPboi2KcAMFtcuOOMWiJ` copiada para `/root/.cache/gaucho-composer-deploy-20260925/next-before`; a build nova foi preparada em diretório separado com assets estáticos anteriores retidos e instalada após o fast-forward. `systemctl restart chatgpt.service` exit 0, serviço `active/running`. Health local e público `/chat/api/health` 200 `healthy`, `basePath=/chat`; `/chat/login` público 200, `/chat` anônimo 307 para login, manifests estáticos novo e anterior 200. Porta de QA 3041 liberada; nenhuma sessão Studio ativa na troca. Sem alteração de proxy, serviço alheio ou dados privados. O browser autenticado na URL pública depende da sessão de Anders; o fluxo visual foi validado na build idêntica em instância isolada.
