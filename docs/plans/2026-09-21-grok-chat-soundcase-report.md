# Registro técnico — Grok e SoundCase

## Estado

Entrega pronta para revisão local em worktree `/root/CHATGPT/.worktrees/grok-chat-soundcase`, branch `codex/grok-chat-soundcase`, base `102f672`. Plano em `f2d0658`; implementação em `d452d83`. Gates locais e browser aprovados; smoke real de voz aprovado, smoke real de obediência textual falhou e permanece uma ressalva explícita de aceitação. Produção preservada; sem merge, push, deploy, restart ou alteração de proxy.

## Decisões de integração

- DECISÃO: duas frentes independentes, texto e voz, com propriedade exclusiva por arquivo conforme plano; principal cuida de instrumentação, documentação, smoke, Git e gates completos.
- DECISÃO: `GAUCHO_ISOLATED_RUNTIME=true` impede o cleanup global de units Studio no boot de QA. Sem a flag, comportamento principal preservado. Isso atende ao risco já conhecido no BACKLOG, sem redesenhar a gestão de units nesta entrega.
- DECISÃO: aceitar `XAI_API_KEY` e o alias `GROK_API_KEY`, com precedência do primeiro. O nome do alias foi descoberto pelas variáveis exportadas; nenhum valor foi mostrado. Não foram criados/copied arquivos `.env`.
- DECISÃO: dependências em cópia por hardlinks, diretórios próprios, sem instalações ou alterações nos arquivos compartilhados. Build/testes somente na worktree.
- DECISÃO: principal assumiu explicitamente `xaiBackground`, `chatBackgroundJob`, store e rotas background para fechar corridas de cancelamento/persistência. Executor por processo em `globalThis`, transições serializadas por job, fence dentro do lock da conversa, limite de 15 min por chamada e zero retries automáticos. Resposta terminal já persistida é autoridade para recuperar índice sem sobrescrever conteúdo após falha parcial.
- DECISÃO: após duas revisões com lacunas demonstráveis (nonstream removido, default omitido sem imagem, ausência de testes de execução de tools), a frente de texto foi transferida do implementador Terra concluído para Sol xhigh. A frente de voz continuou com Terra, corrigindo os defeitos encontrados; nunca houve mais de dois implementadores ativos.
- DECISÃO: após a frente de voz encerrar, o principal assumiu os controles visuais liberados (`SoundCaseGrokRealtimeSettings.tsx` e classes novas no CSS) para ajustar padding e alvos mínimos de 44 px. Revisão independente solicitada à frente de integração. Scripts de browser são do principal e usam fixtures/mocks exclusivos.

## Evidências iniciais

- `npm test -- instrumentation.test.ts`: exit 0, 1 arquivo, 3 testes. Valida isolamento de QA, boot principal e runtime não-Node.
- Artefatos de QA: `/root/.cache/grok-chat-soundcase-qa/`.
- `npx next typegen`: exit 0. Gera os tipos ignorados de uma worktree nova; o erro de import PNG visto no tsc intermediário era ausência do `next-env.d.ts`, não problema no avatar.
- `npm test -- lib/server/xaiBackground.test.ts lib/server/chatBackgroundJob.test.ts app/api/chat/background/xai-routes.test.ts app/api/chat/background/reconcile/route.test.ts`: exit 0; 4 arquivos/24 testes. Inclui binding, job vivo, cancelamento durante lock, terminal preservado, restart sem recobrança e falha parcial da gravação do índice. Rodada anterior teve 1 falha de expectativa no teste legado (`provider: openai` novo), corrigida para refletir o contrato compatível.
- Revisão independente do principal por implementador VOZ: isolamento instrumentation aprovado; formato binário do mock browser corrigido; falha parcial de background detectada, corrigida e reavaliada sem impedimento. Status da rota cancel também reflete a mensagem terminal quando conclusão vence a corrida, com teste dedicado.
- Scripts legados `test-local.sh` e `pre-deploy.sh` foram inspecionados; não executados porque apontam para checkout/porta de produção ou leem env. Gates canônicos serão executados diretamente na worktree.
- QA preliminar em Next dev: `node scripts/qa-grok-soundcase.mjs`, exit 0, 20 verificações em 1440×1000 e 390×844, incluindo controles com 44 px, voz, velocidade, snapshot, início/parada, erro, preferências e ausência de overflow/pageerror. Capturas inspecionadas. Primeira tentativa do catálogo excedeu os 30 s enquanto Next compilava a página inicial (27 s); repetir na build estabilizada. Servidor dev isolado encerrado com exit 0 antes dos gates finais.

## Smoke real xAI

- `scripts/smoke-grok-real.mjs --voice-only`, executado por shell interativo que já exporta `GROK_API_KEY`, sem ler/exibir arquivo de credenciais: exit 0. Catálogo: 28 vozes. Token efêmero e subprotocolo browser aceitos. Voz eve, PCM 24 kHz, velocidade 1.15x, sem microfone. Primeiro áudio 2029 ms; áudio 6.852458 s; transcrição normalizada corresponde integralmente ao texto sintético. Custo estimado US$ 0.0131366 (0.08/min + 0.004 por mensagem), não é confirmação de fatura. WAV em `/root/.cache/grok-chat-soundcase-qa/grok-voice-synthetic.wav`; log `real-voice-smoke.log`.
- Smoke texto: duas chamadas HTTP 200 ao `grok-4.7` com reasoning medium, mas a assertion de obediência literal a “Responda apenas com a palavra PRONTO.” falhou (exit 1). Primeira rodada: 4865 ms, input1253/output271/reasoning256. Repetição única com cap1024: status completed, 6724 ms, input1253/output406/reasoning391, resposta sintética “Não vou responder só com essa palavra. Diga o que você precisa.”. Não ocultar essa falha nem tratar acessibilidade da API como avaliação de qualidade aprovada. Logs `real-smoke.log` e `real-text-smoke-retry.log`. Nenhuma repetição adicional planejada sem achado concreto.

## Gates integrados

- `npm test`: exit 0; 183 arquivos, 928 testes, 0 falhas, 0 skips, duração 35.55 s. Log `full-test.log`.
- Primeiro `npx tsc --noEmit`: exit 2, cinco diagnósticos nos novos tipos/fixtures xAI. Corrigidos casts, narrowing, enum e uso ausente (`undefined`); foco independente da frente passou 2 arquivos/20 testes. Tsc repetido após correções e após limpeza de imports: exit 0 (`tsc-final.log`). Sem mudança comportamental que justificasse repetir a suíte completa.
- Primeiro `npm run lint`: exit 0, zero erros e cinco warnings; quatro imports introduzidos pela entrega foram limpos, restando revalidar o warning anterior de `_content`.
- A primeira build foi interrompida deliberadamente (exit 130) para limpar os imports antes da compilação definitiva; não conta como aprovação. Repetição segura na mesma worktree isolada.
- Revisão independente da frente de integração aprovou controles visuais e ambos os scripts QA do principal. Revisão principal confirmou contratos e testes da frente de texto; a limpeza final retirou apenas imports sem uso.
- `npm run lint` definitivo: exit 0, zero erros, somente o warning preexistente `_content` em `CommandComposerContainerV2.test.tsx` (`lint-final.log`).
- `NEXT_PUBLIC_BASE_PATH=/chat npm run build` definitivo: exit 0, 41/41 páginas; único warning preexistente de NFT tracing do Studio (`build-final.log`).
- Browser na build final: `node scripts/qa-grok-soundcase.mjs` e `node scripts/qa-grok-catalog.mjs`, ambos exit 0; 20 + 14 verificações em desktop 1440×1000/mobile 390×844. Catálogo confirma Luna default, mini ausente, Grok selecionável, medium único/desabilitado e persistência. SoundCase cobre vozes/velocidade, snapshot, início/parada, falha e retry, retorno à OpenAI e controles de toque. Zero overflow/pageerror; capturas finais inspecionadas.
- A primeira execução final do catálogo falhou porque o mock retornava lista vazia e uma resposta inválida à criação automática da conversa; fixture corrigida para uma conversa sintética completa e splash marcado como visto. Nenhuma alteração no produto foi necessária. Após o ajuste do script, `npx eslint scripts/qa-grok-catalog.mjs`: exit 0. Logs `catalog-final.log`, `browser-final.log` e `catalog-lint.log`.
- Não existe suíte Playwright global versionada; os dois scripts cobrem as superfícies alteradas. Studio/Pulse/background foram validados por testes de integração mockados, não por execução real sobre arquivos/rotinas do Anders.
- Instância Next temporária na porta 3147 encerrada por SIGINT após QA (exit 130 esperado de encerramento, não um gate). Checkout principal continuou limpo em `102f672`; nenhum dado privado ou serviço de produção foi alterado. `git diff --check`: exit 0.

## Pendências

Avaliação subjetiva da voz pertence a Anders; o WAV sintético está disponível. A falha real de obediência textual está registrada acima: transporte/modelo acessíveis não significam qualidade de resposta aprovada. A entrega pode ser revisada localmente, mas essa limitação deve ser considerada antes de publicar/substituir os fluxos vivos. `.bashrc` não garante credencial no systemd; configuração do ambiente e publicação permanecem fora da autorização desta entrega. Não houve nova chamada paga após os smokes registrados.
