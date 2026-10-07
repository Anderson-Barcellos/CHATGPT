# Registro técnico — Descobrir IA e Studio

Estado: pronta para revisão. Plano aprovado em `af77df6`; implementação em `8f154de`. Worktree: `/root/.cache/gaucho-discover-controls-20261007`. Integração local na main autorizada; publicação e push não executados.

Integração concluída por fast-forward da main até `bc54361` (registro de validação), sem conflitos adicionais. Main e candidata ficaram limpas e com árvores idênticas. Conferência pós-integração somente leitura: `chatgpt.service` active, health local/público HTTP 200; a build viva continua `lXC2ejL4ftyZ9pT0n_3mG`, diferente da candidata nova. Nenhum restart/deploy. A anotação final deste resultado é apenas documental.

## Decisões e integração

- DECISÃO: duas frentes exclusivas: agendamento/backend e interface/TTS/navegação. Principal responde por Git, docs, script QA, revisão e gates completos.
- DECISÃO: integrar o snapshot do WIP web existente de viewport/deploy ao conjunto antes dos gates. Cópia exata dos fontes via patch; conflitos apenas em BACKLOG/diário resolvidos preservando ambas as entradas. Snapshot original `/tmp/gaucho-main-wip-20261007.patch`; commit de preservação na main `c3318b7` sem alterar bytes dos fontes. Candidata conciliada em `e668409` e merge `f2b3a9f`, cujo diff contra primeiro pai é vazio. Build/serviço de produção intocados.
- DECISÃO: preservar a correção Lexend já publicada, adicionando gc-chat-ui ao feed. Não descartar a worktree de referência.
- DECISÃO: não integrar silenciosamente a branch `codex/migracao-chat-20261006`: contém troca de padrões para sonaris.us, distinta do objetivo atual. Ajustes web preexistentes são incluídos diretamente do checkout principal. Nenhuma mudança de domínio, serviço, timer ou proxy nesta rodada.
- Desktop Windows: branch própria com WIP e aceitação real pendente. Consulta enviada a Anders sem resposta nesta rodada; adotada a sugestão de preservar essa frente separada. Nenhuma alteração nessa worktree. A integração atual reúne todo o WIP web do checkout principal e o Descobrir, não todas as branches do repositório.
- Browser plugin não disponível; Playwright instalado com Chrome do host. Script `scripts/qa-discover-controls.mjs` usa ambiente limpo explícito, dados/auth sintéticos, flag isolada e captura em `/root/.cache/gaucho-discover-controls-evidence`. Sem credenciais de providers nem chamadas pagas.

## Verificações

| Comando | Resultado |
|---|---|
| `NEXT_PUBLIC_BASE_PATH=/chat npx next typegen` | exit 0 |
| `npx vitest run hooks/useVisualViewport.test.ts app/globals.visual.test.ts scripts/deploy.test.ts` | exit 0; 3 arquivos, 32 testes aprovados |
| `npx vitest run lib/discover app/api/discover` (revisão independente do principal) | exit 0; 9 arquivos, 26 testes aprovados |
| `npm test` (conjunto estabilizado, principal) | exit 0; 211 arquivos, 1.075 testes aprovados, zero falhas/skips; 54,39 s |
| `npx tsc --noEmit` (conjunto estabilizado, principal) | exit 0 |
| `npm run lint` | exit 0; zero erros, 2 warnings: um novo parâmetro unused no teste do feed e um anterior no teste CommandComposerContainerV2 |
| `npx eslint scripts/qa-discover-controls.mjs components/discover/DiscoverPage.test.tsx` | exit 0; zero warnings após remover o parâmetro unused. Remoção sem efeito de execução; não exige repetir a suíte inteira |
| `NEXT_PUBLIC_BASE_PATH=/chat npm run build` | exit 0; 43/43 páginas; BUILD_ID `6_32NVLtusWBg1p8kSENn`; três avisos em código inalterado: process.exit/Edge em instrumentation e dois de NFT tracing do Studio |
| `node scripts/qa-discover-controls.mjs` | primeira rodada exit 1 por mock do Studio desabilitado/assert de navegação oculta no mobile; corrigido somente o driver para enabled=true/unlocked=false e prova visual de workspace bloqueado. Rodada final exit 0; 7 cenários aprovados |
| `git diff --check HEAD` e `git diff --cached --check` | exit 0 |

## Revisão e correções

- Backend: revisão exigiu JSON seguro em falha I/O e cobertura de viradas de calendário, pausa de job iniciado, manual sem alterar marco e runner sem provider; implementador corrigiu e validou 24 testes, conferência independente ampliada para 26 passou.
- Interface: corrigidas races entre PUT de assuntos/agendamento e GET iniciado durante gravação. Versão de leitura muda no início/fim, mutações pendentes invalidam reads, cada PUT aplica apenas seu campo e libera seu controle. POST manual marca execução running antes do GET para manter polling quando leitura é descartada. Testes reproduzem esses cenários e clique duplicado; 7 arquivos/18 testes focados aprovados.
- Header compacto permite segunda linha até 430px sem reduzir alvos de 44px; browser confere bounds dos controles além de scrollWidth para não mascarar recorte por overflow-x-hidden.
- Script QA do principal revisado pelos dois colegas. Corrigidos cleanup anterior ao probe, validação do PUT preparatório e tolerância ao browser já desconectado no cleanup. Gates node --check e eslint aprovados durante revisão.

Logs integrais em `/root/.cache/gaucho-discover-controls-evidence/`: tests.log, types.log, lint.log, lint-final-focused.log, build.log, browser.log, results.json e server.log. Não existe suíte Playwright configurada neste projeto; o script versionado executa integralmente os fluxos desta entrega.

## Evidência externa

Runtime isolado em `http://127.0.0.1:3147/chat`, encerrado ao final. Seis combinações: 1440, 390 e 320 px, light/dark; sétimo cenário confere matérias preservadas. Autenticação real com credenciais sintéticas, GET/PUT/runner reais sobre fixture exclusiva; TTS/refresh/Studio interceptados para impedir efeitos externos. Zero pageerror, console error ou origem externa. Switch persiste, runner retorna paused, manual permanece disponível, retomada funciona, abrir player não gera, Tocar solicita título+conteúdo, pausa/retomada funcionam, só um player e nenhuma opção Realtime, expansão preservada e Studio acessível por teclado. Conteúdo significativo/identidade de página conferidos; sem overlay de framework.

Capturas `discover-{1440,390,320}-{light,dark}.png`; conferidas visualmente as de 1440 dark e 320 light. `tts-320-light.png` e `tts-1440-dark.png` documentam o player; a de 320 light foi inspecionada. Bounds dos links/switch e scrollWidth passam, sem recorte. Diretório `data/` sintético removido pelo finally e browser/servidor encerrados. Sem chamadas pagas nem acesso ao workspace real.

## Limites

Sem publicação, push, chamadas de API paga ou uso de dados pessoais. QA não comprova execução real do workspace Studio nem comportamento físico do iPhone; testa navegação/UI do Studio simulada e preserva o ajuste iOS anterior.
