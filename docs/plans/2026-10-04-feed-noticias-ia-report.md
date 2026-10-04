# Relatório técnico — Descobrir IA

**Estado:** pronta para revisão em 2026-10-04. **Branch:** `codex/ia-discover-20261004`; worktree isolada `/root/.cache/gaucho-ia-discover-20261004`; base `6919551`. Plano aprovado no commit `c2a27ac`. A produção em `/root/CHATGPT` e sua `.next` não foram alteradas.

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

**Limite da validação:** o fluxo pago de busca e geração de imagem foi exercitado com respostas simuladas, sem chamada real de provedor. A qualidade e a forma exata do conteúdo produzido em ambiente real ainda precisam de conferência após uma publicação autorizada. Nenhum serviço produtivo, timer, proxy, segredo, dado privado, push ou deploy foi alterado.
