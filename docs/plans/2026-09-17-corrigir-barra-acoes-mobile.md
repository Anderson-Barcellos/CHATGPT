# Corrigir a barra de ações cortada no mobile

## 1. Entrevista e entendimento

Anders mostrou uma captura real do Chat mobile em que a barra de opções abaixo da resposta do assistente começa fora da borda esquerda e tem o primeiro botão cortado. A inspeção confirmou que a barra ainda usa a compensação `margin-left: -2.31rem`, criada quando o avatar ocupava uma coluna externa. O ajuste mais recente incorporou o avatar ao balão e ampliou a resposta do assistente para 100% da largura mobile, tornando essa compensação obsoleta.

Não há perguntas abertas. Quando uma resposta do assistente terminar, Anders deve ver todos os botões dentro da região visível: uma linha quando houver espaço e quebra natural em telas estreitas, sem rolagem horizontal, redução dos alvos táteis ou alteração do conteúdo do balão.

### 1.1 Aprovação vinculante

Em 2026-09-17, Anders respondeu `Implement the proposed plan.` ao plano apresentado. A aprovação autoriza todos os grupamentos abaixo na ordem, inclusive os commits locais da entrega, mas não autoriza build no checkout de produção, restart, deploy, push, mudanças no Apache nem efeitos em dados runtime.

## 2. Objetivo

Manter a barra de ações do assistente totalmente contida na largura real do balão em todo o intervalo mobile, preservando as ações, os alvos táteis e o comportamento responsivo existente.

## 3. Fica fora

- Apache, rotas, APIs, tipos públicos, persistência e dados runtime privados.
- Studio, SoundCase, Pulse, composer e geometria desktop.
- Build no checkout vivo, restart de `chatgpt.service`, deploy, push ou publicação.
- Redução dos oito botões, dos ícones ou dos alvos táteis de 40 px.

## 4. Decisões confirmadas

| Tema | Decisão |
|---|---|
| Causa | Remover a compensação antiga da coluna externa do avatar. |
| Geometria | A barra segue `width: fit-content` com `max-width: 100%` e quebra natural. |
| Compatibilidade | Incorporar como unidade coerente as mudanças ainda não commitadas do último ajuste de avatar/largura nos mesmos arquivos. |
| WIP | Preservar integralmente o trabalho separado do Studio e qualquer alteração alheia. |
| Produção | Validar build em cópia isolada; nenhuma publicação nesta entrega. |

## 5. Grupamento — Barra de ações contida no balão

### Objetivo

Eliminar o deslocamento negativo obsoleto e fazer a barra acompanhar a largura real da mensagem.

### Escopo por arquivo

- `components/chat/MessageBubble.tsx`: retirar o modificador condicional `gc-message-quick-actions-wide`, preservando o avatar interno e a largura cheia do balão mobile.
- `app/globals.css`: remover a regra mobile que amplia a barra e aplica `margin-left: -2.31rem`; manter `width: fit-content`, `max-width: 100%`, `flex-wrap` e os alvos táteis.
- `app/globals.visual.test.ts`: fixar que a barra não excede o balão nem recebe margem lateral negativa.

### Contratos

- Nenhuma API, tipo, rota ou persistência muda.
- Permanecem oito botões quando existe `Regenerar` e sete nos demais casos.
- Em largura suficiente a barra fica em uma linha; quando não couber, quebra sem overflow horizontal.
- Conteúdo com pesquisa web, referências e player de áudio mantém o comportamento atual.

### Dependências

- O ajuste depende do avatar já estar dentro do balão e da largura mobile do assistente já estar em 100%.
- As mudanças preexistentes desses contratos nos três arquivos do escopo compõem a mesma unidade funcional; nenhum arquivo do Studio entra no commit.

### Testes — camada interna

- `npx vitest run app/globals.visual.test.ts components/chat/QuickActionsBar.test.tsx components/chat/MessageBubble.test.ts`
- `git diff --check`
- Revisão do DOM/CSS para sete e oito ações.

### Testes — camada externa

- Chrome/Playwright isolado em 320, 390, 430 e 767 px, mais paisagem curta 956 × 440, nos temas claro e escuro.
- Conferir `scrollWidth <= clientWidth` no documento, thread, balão e barra.
- Conferir primeiro e último botões inteiros, quebra controlada em 320 px e linha única em 390/430 px quando houver espaço.

### Evidência de pronto

- Captura mobile compacta demonstrando a barra completa.
- Zero overflow horizontal, `pageerror` ou erro de console nos cenários executados.
- Testes focados aprovados.

### Preservar

- Largura cheia do balão do assistente, retratos internos, referências, metadados, player de áudio, ações existentes e densidade de 92%.
- Composer, desktop, Studio, SoundCase, Pulse, APIs, dados privados e todo WIP alheio.

## 6. Grupamento — Aceitação integrada e registro

### Objetivo

Provar que a correção não regride o Chat e deixar o estado da entrega rastreável.

### Escopo por arquivo

- `BACKLOG.md`: registrar a entrega como `pronta para revisão`, sem alterar entradas alheias.
- `docs/DIARIO-AGENTS.md`: acrescentar entrada append-only com causa, correção, decisões e evidências.
- `docs/plans/2026-09-17-corrigir-barra-acoes-mobile-report.md`: relatório por grupamento com arquivos, `DECISÃO:`, gates e bloqueios.

### Contratos

- O build usa `NEXT_PUBLIC_BASE_PATH=/chat` e roda somente em cópia isolada.
- Nenhum smoke cria conversas, notas, rascunhos ou outros dados persistidos.
- O fechamento técnico não autoriza restart, publicação ou push.

### Dependências

- Grupamento anterior aceito e commitado.

### Testes — camada interna

- `npm test`
- `npx tsc --noEmit`
- `npm run lint`, excluindo apenas o snapshot compilado conhecido se ele voltar a contaminar o lint, com o desvio registrado.
- `git diff --check`

### Testes — camada externa

- `NEXT_PUBLIC_BASE_PATH=/chat npm run build` em cópia isolada.
- Repetir somente o smoke visual que uma mudança posterior possa afetar.

### Evidência de pronto

- Totais completos, skips, falhas e exit real dos gates no relatório.
- Build isolada concluída e captura final registrada.
- Commits locais separados para comportamento e documentação.

### Preservar

- `.next` viva, `chatgpt.service`, Apache, rotas públicas, dados privados e WIP fora da entrega.

## 7. Pontos de parada

- Se a barra ainda exigir reduzir alvos táteis ou remover ação para caber, registrar `BLOCKED` e consultar Anders.
- Se o build isolado ameaçar units do Studio ou tocar runtime real, interromper antes do efeito.
- Se a correção exigir mudar resultado, escopo ou uma superfície marcada em **Preservar**, pausar a parte dependente.

## 8. Relatório final

O fechamento usa quatro blocos: **O que foi feito; Decisões e contratempos; Substituições e remoções; Próximos passos**, com comandos, totais, hashes dos commits e a pergunta `Entrega barra de ações mobile está pronta para ser fechada?`.
