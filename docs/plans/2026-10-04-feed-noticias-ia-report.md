# Relatório técnico — Descobrir IA

**Estado:** publicada para análise em 2026-10-04; pronta para revisão. **Branch:** `codex/ia-discover-20261004`; worktree isolada `/root/.cache/gaucho-ia-discover-20261004`; base `6919551`. Plano aprovado no commit `c2a27ac`.

## Resultado observável

- A navegação visível leva a `/chat/discover` no lugar do atalho Studio. `/chat/studio`, APIs e projetos Python permanecem preservados por URL direta.
- A página mostra cards com capa privada, manchete, data e resumo; abre narrativa com links inline e lista de fontes. Os assuntos aceitam sugestões e texto livre e ficam separados do Pulse.
- Atualização manual retorna 202 e apresenta estado de espera. Um timer diário independente foi preparado para 08h `America/Sao_Paulo`, sem instalação no host. Até cinco matérias novas por rodada; o índice retém até 60 cards e remove capas descartadas. Jobs concorrentes são bloqueados, erros preservam artigos anteriores e jobs interrompidos se tornam tentáveis após timeout.

## DECISÃO: contratos e limites

1. **Studio preservado:** a escolha aprovada foi ocultar, não desinstalar. O navegador continua podendo acessar a URL direta, e a infraestrutura do workspace não foi modificada.
2. **Curadoria separada do Pulse:** novos arquivos `data/discover.json` e `data/discover-images/` evitam acoplamento com as rotinas. O timer tem token exclusivo, enviado por stdin ao curl; o middleware permite chegar à verificação Bearer da rota.
3. **Fontes e imagens:** notícias só entram se a URL aparecer nas citações ou fontes consultadas retornadas pela busca; a data deve estar nos últimos 14 dias. O texto recebe links inline. A falta de capa preserva a matéria com arte substituta. Sem matéria nova após uma curadoria válida, o acervo anterior permanece e a rodada conclui sem erro.
4. **Persistência privada:** capas ficam fora de `public/` e são servidas por rota autenticada; arquivos novos de runtime foram incluídos no `.gitignore`. Nenhum dado real do Anders foi usado como fixture.

## Evidências e gates

| Verificação | Resultado |
|---|---|
| `npm test` | exit 0; 203 arquivos, 1.033 testes aprovados, zero falhas |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | exit 0; zero erros, um warning anterior em `CommandComposerContainerV2.test.tsx` |
| `NEXT_PUBLIC_BASE_PATH=/chat npm run build` | exit 0; 43/43 páginas estáticas geradas; `/discover` e cinco rotas `/api/discover/*` presentes. Warnings anteriores de `instrumentation.ts`/tracing do Studio |
| `bash -n scripts/run-discover-due.sh` e `systemd-analyze verify` | exit 0; calendário resolvido para 08h BRT |
| `git diff --check` | exit 0 |
| Browser Chrome/Playwright com QA isolado | 1440, 390 e 320 px: login sintético, card e texto expandidos, capa 200, assuntos salvos, zero overflow e zero `pageerror`; capturas em `/root/.cache/gaucho-ia-discover-{1440,390,320}.png` |
| HTTP isolado | readiness 200 com armazenamento e credenciais sintéticos; feed/imagem anônimos 401; runner sem token 503 após correção do middleware |

O projeto não possui `playwright.config` nem suíte `*.spec.*` versionada para executar; o smoke acima usou o Chrome do host. O primeiro ensaio falhou por um seletor de QA que procurava `Remover IA médica` como nome acessível; a preferência foi persistida, o seletor foi corrigido e a rodada completa passou. A primeira tentativa de tsc na worktree não tinha `next-env.d.ts` ignorado pelo Git; a declaração gerada localmente foi copiada e o gate passou. A primeira suíte completa encontrou data fixa antiga em um teste novo; o teste passou a usar o relógio corrente, e as suítes completas seguintes passaram. O primeiro start de QA omitiu `NEXT_PUBLIC_BASE_PATH=/chat`; foi reiniciado com o valor correto.

**Limite do ensaio anterior à publicação:** o fluxo pago de busca e geração de imagem havia sido exercitado com respostas simuladas. A qualidade editorial do conteúdo real ainda depende da avaliação de Anders na interface autenticada.

## Publicação autorizada em 2026-10-04

DECISÃO: a build para produção combinou a branch do feed com as mudanças locais preexistentes em `app/globals.css`, `hooks/useVisualViewport.ts` e testes relacionados, sem alterar ou descartar esse WIP no checkout vivo. Cópia isolada: `/root/.cache/gaucho-discover-deploy-20261004`. No primeiro passe, três testes de URLs falharam porque a suíte recebeu `NEXT_PUBLIC_BASE_PATH=/chat`; repetidos sem esse valor, todos passaram. O prefixo foi usado no build.

| Gate/checagem | Resultado |
|---|---|
| TypeScript e lint na cópia combinada | exit 0; lint sem erros |
| `npm test` na cópia combinada | exit 0; 203 arquivos, 1.038 testes; zero falhas |
| `NEXT_PUBLIC_BASE_PATH=/chat npm run build` na cópia combinada | exit 0; build `Bt7v1m-4wP_S_XiOKL04D`; `/discover` presente |
| `systemd-analyze verify` para serviço e timer | exit 0 |
| `scripts/deploy.sh --from /root/.cache/gaucho-discover-deploy-20261004` | exit 0; restart de `chatgpt.service`; health local e público 200 |
| Primeira curadoria real via `chatgpt-discover.service` | exit 0; estado persistido e três arquivos de capa gerados; conteúdo privado não inspecionado |
| HTTP público anônimo | `/chat/discover` 307 para login; `/chat/api/discover` 401; runner sem token 401 |

Backup anterior em `/root/.cache/gaucho-deploy/20261004T182556Z/next-before`. Token exclusivo em `/etc/chatgpt/discover.env`, root 0600; drop-in do app `30-discover.conf`; script instalado em `/usr/local/libexec/chatgpt-discover-run-due.sh`; timer ativo para 08h BRT. Proxy, porta e cookies não mudaram. A fonte da branch ainda não foi integrada ao `main`, e a build de origem deve permanecer no disco. Não houve merge nem push.

## Refinamento editorial e visual publicado em 2026-10-04

Anders aprovou matérias de 6–9 parágrafos e aproximadamente 700–1.000 palavras, `gpt-6-sol` com reasoning `medium` e verbosity `high`, promoção do card aberto ao primeiro destaque no desktop, expansão local no mobile e correção da rolagem. `DECISÃO:` respostas com menos de seis parágrafos ou 600 palavras são descartadas; a reescrita existente é tudo-ou-nada e preserva título, resumo, assunto, datas, ID, capa e fontes originais.

| Gate/checagem | Resultado |
|---|---|
| Testes focados | exit 0; 4 arquivos, 12 testes |
| Branch isolada: `npm test` | exit 0; 205 arquivos, 1.041 testes |
| Branch isolada: TypeScript e lint | exit 0; lint com zero erros e o warning anterior do composer |
| Cópia combinada com WIP vivo: pre-deploy | exit 0; 206 arquivos, 1.053 testes; tipos e lint aprovados |
| `NEXT_PUBLIC_BASE_PATH=/chat npm run build` | exit 0; build `NJoCo5uxmVkV2ZNtMhzPJ`; `/discover` presente |
| Smoke Chrome sintético | 1440, 390 e 320 px; segundo/terceiro card, ordem desktop, expansão mobile, sticky, fim da rolagem, zero overflow/pageerror; capturas `/root/.cache/gaucho-discover-refine-{1440,390,320}-open.png` |
| Deploy | `scripts/deploy.sh --from /root/.cache/gaucho-discover-refine-deploy-20261004`, exit 0; restart só de `chatgpt.service`; health local/público 200 |
| Reescrita real | exit 0 em 1min25s; três artigos; backup `/root/CHATGPT/data/discover-backups/discover-before-rewrite-2026-10-04T19-13-42-977Z.json`, modo 0600 |
| Validação privada por métricas | 8 parágrafos cada; 792, 899 e 827 palavras; 5, 3 e 3 fontes; identidade, fontes originais e três capas preservadas |
| Smoke público autenticado | 1440, 390 e 320 px; três cards/capas, narrativa aberta com 8 parágrafos, rolagem vertical, ordem responsiva e zero pageerror |

A primeira rodada de QA público falhou apenas porque esperava rolagem com os três cards ainda recolhidos em 1000 px de altura; o critério foi corrigido para exigir rolagem após expansão, que é o comportamento pedido. Uma tentativa de login sintético aguardou `/chat/` enquanto o app normalizou para `/chat`; o smoke passou a autenticar diretamente pela API. A instância isolada foi encerrada, a porta 3997 ficou livre e os dados sintéticos foram removidos.

Build anterior: `Bt7v1m-4wP_S_XiOKL04D`; backup em `/root/.cache/gaucho-deploy/20261004T191153Z/next-before`. O timer `chatgpt-discover.timer` permanece ativo para 08h BRT. Proxy, porta, cookies, Studio, Pulse e geração de capas não mudaram. O checkout vivo manteve 13 caminhos de WIP preexistente; a branch está limpa após o commit documental. Sem merge ou push.
