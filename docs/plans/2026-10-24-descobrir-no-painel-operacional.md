# Descobrir IA no painel operacional

## 1. Entendimento e aprovação

Objetivo: transferir o Descobrir para o painel operacional, com cartões no estilo do Pulse e tela cheia no celular.

### 1.1 Entrevista e aprovação

Anders escolheu **somente a nova aba**: retirar o atalho da lateral e manter a faixa principal do celular. Ordem: Pulse, Descobrir, Notas, Rotinas. Paleta continua abrindo Descobrir na nova aba; página independente preservada. Nenhuma pergunta material aberta. Plano apresentado na conversa e aprovado em 2026-10-24 com “Implement the proposed plan.” Execução solo, em worktree isolada. Publicação, commit e push fora do escopo.

## 2. Agrupamentos da implementação

### Navegação integrada

- Objetivo: abrir Descobrir no painel da direita; nas telas menores usar o painel existente, em tela cheia no celular.
- Escopo: ContextPanelV2, WorkspaceLayoutV2, ConversationRailV2, CommandPalette, uiStore e tipo ActivePanelTab.
- Contrato: adicionar `discover` à seleção transitória; remover estado/painel exclusivos da sobreposição antiga.
- Dependências: abas Radix e painel operacional existentes; sem novas dependências.
- Testes: estado, paleta, rails normal/compacto e fluxo integrado responsivo.
- Pronto: selecionar Descobrir exibe o feed sem cobrir as conversas; paleta abre a mesma superfície.
- Preservar: conversa, composer, Pulse, notas, rotinas e página `/discover`.

### Cartões e leitura

- Objetivo: usar densidade e acabamento dos cartões Pulse na versão incorporada.
- Escopo: DiscoverFeed e seus testes.
- Contrato: capa compacta, assunto, título, data e resumo de três linhas; expansão no lugar com uma matéria aberta; áudio/fontes na leitura expandida.
- Dependências: integração anterior e feed existente.
- Testes: expansão, seleção/exclusão independentes, player, preferências, estados de erro/vazio/carregamento e apresentação em navegador.
- Pronto: desktop normal/ampliado, tablet e mobile sem cortes ou rolagem horizontal; ampliar mantém leitura/player; trocar aba encerra áudio.
- Preservar: APIs, conteúdo, curadoria, TTS, confirmações e persistência.

### Validação e documentação

- Escopo: testes e smokes Discover, arquitetura, AGENTS, BACKLOG e diário append-only.
- Gates: testes focados; `npm test`; `NEXT_PUBLIC_BASE_PATH=/chat npx --no-install next typegen`; `npx tsc --noEmit`; `npm run lint`; `npm run build`; Playwright aplicável; `git diff --check`.
- Runtime QA: `GAUCHO_ISOLATED_RUNTIME=true`, dados e credenciais sintéticos, sem chamadas pagas. Browser plugin indisponível; usar Playwright conforme Build Web Apps.
- Evidência: logs/capturas em `/root/.cache/gaucho-discover-context/evidence`; resultados e decisões em `docs/DIARIO-AGENTS.md`.
- Parada: gate obrigatório falho bloqueia pronta para revisão; produção permanece intocada.

## 3. Fica fora

Publicação/restart, commit/push, redesign da página independente, alterações de providers, dados privados, APIs ou agendadores.

DECISÃO: basear a worktree no código versionado `992b68d`, com DeepSeek low preservado. Isso não altera a build viva, que usa max; eventual publicação deve reconciliar essa diferença explicitamente.
