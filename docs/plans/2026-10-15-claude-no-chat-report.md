# Claude no chat — registro de integração

## Resultado e escopo

Sonnet 5.5 e Opus 5.5 implementados no chat padrão, com esforço inicial medium e opções low/medium/high. Gemini/Astra ocultos somente das novas escolhas do chat, preferências antigas resolvidas para Luna medium sem reescrever históricos. Studio/Pulse preservados. Documento indica Luna medium efetivo, mantendo a preferência Claude para o retorno ao chat padrão.

O adaptador Messages API preserva o protocolo SSE do Gaúcho, imagens, contexto pessoal, web search/fetch com fontes, memória compartilhada e cancelamento. Continuações preservam blocos assinados e citações, agregam uso e mantêm atividade web até o resultado real. Erros upstream são sanitizados. Limite de duas continuações impede efeitos de uma terceira rodada de memória.

## Isolamento e decisões

- DECISÃO: produção `/root/CHATGPT` tinha WIP amplo. Snapshot Git independente em `/root/.cache/gaucho-claude-20261015/source`, baseline `e473f31`, preserva esse estado como base sem copiá-lo de volta. A entrega é o diff contra esse baseline; não fazer merge direto do histórico sintético. Verificação byte a byte dos arquivos de fonte confirmou zero alterações no checkout original.
- DECISÃO: preço de cache read Sonnet atualizado para US$0,10/MTok conforme documentação atual; Opus US$0,20. Estimativas de tokens não incluem custo de ferramentas ou cache writes.
- DECISÃO: a fonte STT retornou 401. Anders forneceu nova origem `CLAUDE_KEY` no shell do antigo `145.223.26.62`. Transferida somente essa variável via SSH para `/etc/chatgpt/anthropic.env`, root:root 0600. `.bashrc` local carrega a fonte; antigo/STT intactos. Backups privados em `/root/.cache/gaucho-claude-20261015/private-backups`.
- O drop-in `50-anthropic.conf` está preparado e não instalado. Nenhum deploy, restart, alteração de proxy, push ou integração no checkout original.

## Revisão

Principal revisou catálogo/store/UI, integração da rota, conversão, limites de ferramentas, usage, cancelamento, citações e status web. Implementador catálogo revisou dependência/lock, configuração versionada e documentação do principal. Ajustes encontrados foram corrigidos: teto high, cache usage, limite antes de efeitos, fechamento em abort, preservação/mapeamento de citações, sanitização, status web e tipagem do guard. Relatórios das frentes ficam ao lado deste arquivo.

## Evidências externas

- Models API: HTTP 200 e IDs esperados em ambos os modelos após substituir a chave.
- Texto/imagem reais: Sonnet e Opus, uma chamada por modelo, streaming concluído.
- Sonnet web search + remember_memory: duas chamadas, citação recebida, memória sintética gravada e removida com toda a fixture.
- Sonnet web_fetch: uma chamada, fonte real convertida em citação do Gaúcho.
- A primeira fixture PNG mínima foi recusada pela API (400). Substituída por PNG 32×32 gerado por Sharp; repetição aprovada. Nenhum ajuste no produto para esconder a falha da fixture.

Evidências completas sanitizadas: `/root/.cache/gaucho-claude-20261015/evidence` (`anthropic-models.json`, `provider-results-initial-success.json`, `provider-results.json`, logs correspondentes). Todos os prompts e imagens foram sintéticos. Não houve uso de dados pessoais como fixture.

## Gates integrados

Conjunto estabilizado: `npm test -- --maxWorkers=2` — 213 arquivos, 1.126 testes aprovados, nenhum skip, exit 0; `npx --no-install tsc --noEmit` — exit 0; `npm run lint` — exit 0, um warning preexistente de parâmetro não usado; `NEXT_PUBLIC_BASE_PATH=/chat npm run build` — exit 0, 43/43 páginas. Typegen com `/chat` executado antes do TypeScript. Dois avisos de build em código inalterado (instrumentation/Edge e tracing de Studio) preservados.

Ocorrências intermediárias preservadas: o harness inicial aplicou `/chat` também aos testes unitários, causando três diferenças de URL; corrigido para aplicar prefixo apenas em typegen/build/runtime. TypeScript detectou estreitamento excessivo no guard de web tools, corrigido. Uma rodada apresentou timeout de 5s em teste de filesystem do SoundCase que passou anteriormente; repetição com dois workers, sem editar testes nem ampliar timeout.

Browser plugin não disponível. QA usa Playwright com Google Chrome instalado, em runtime Next isolado, autenticação/credenciais sintéticas, prefixo `/chat`, fixtures próprias e upstream do browser simulado. O adaptador real foi validado separadamente conforme acima.

O harness de browser precisou corrigir um mock amplo de memória com formato incompatível e um seletor que encontrava o resumo oculto da sidebar no mobile. A indexação automática retornou 500 com a credencial OpenAI sintética; endpoint identificado como `/api/memory/index` e isolado por mock específico. Nenhuma alteração de produto para corrigir esses problemas do harness. Não há suíte Playwright versionada no projeto; o roteiro integrado desta entrega cobre seleção dos dois modelos, três esforços, persistência, envio com imagem, citações e fallback Documento em desktop/mobile.

## Fechamento

Rodada final de navegador: oito checks aprovados, exit 0, sem pageerrors/console errors e sem overflow horizontal. Capturas desktop/mobile inspecionadas. Além da indexação, sugestões automáticas foram simuladas em /api/memory/suggestions para não usar a credencial OpenAI sintética. Cleanup por DELETE permanente somente na instância sintética removeu uma conversa; servidor QA encerrado por SIGTERM após verificar seu cwd. Produção permanece active com o mesmo PID 2678221, sem restart.

Pronta para revisão, ainda não publicada. Commits somente no snapshot; patch em /root/.cache/gaucho-claude-20261015/evidence/claude-chat.patch relativo ao baseline e473f31. Não mergear o histórico sintético. Nenhuma chave integra o patch. Publicação e ativação do drop-in permanecem pendentes.

As duas frentes concluíram antes da nova instrução de Anders restringindo delegação. A validação final e este fechamento foram conduzidos exclusivamente pelo principal.

## Publicação autorizada — 2026-10-15

Anders autorizou publicar e comitar. Fonte original conferida contra baseline, sem divergências. DECISÃO: preservar o WIP anterior na main; aplicar somente o patch desta entrega e importar os commits na branch codex/claude-chat-20261015, sem merge do histórico sintético. Commits de implementação 7e444d2 e documentação 40d44c6.

Drop-in 50-anthropic instalado, daemon-reload e publicação via scripts/deploy.sh --from /root/.cache/gaucho-claude-20261015/source, exit 0. Build s8Q5n0uSF_K2_bQfWeKMa; backup /root/.cache/gaucho-deploy/20261015T110653Z/next-before. Preservar a origem da build. Serviço reiniciado e active; health local/público 200 healthy. Chamadas sintéticas autenticadas na rota pública com Sonnet e Opus: 200, texto e conclusão SSE em ambos, sem tools e sem persistir conversa. Chunk público dos modelos idêntico à build validada. Evidências: deploy.log, published-results.json e public-assets.json no diretório evidence da entrega.

Nenhuma mudança em proxy/porta, nenhum reload Apache ou push. Chave carregada no processo e nunca emitida. APACHE.md atualizado. Gates de código anteriores permanecem válidos: publicação não alterou código; somente registros operacionais foram atualizados.
