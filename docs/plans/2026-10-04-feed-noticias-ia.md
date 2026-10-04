# Feed de notícias de IA

## 1. Entrevista e aprovação

Pedido de Anders: substituir o atalho visível do Studio por um feed próprio de notícias recentes de IA, com cards semelhantes aos do Pulse, capa gerada, narrativa expandida e preferências de assunto. O Studio e os projetos Python ficam preservados. Sem perguntas abertas. Plano apresentado em 2026-10-04 e aprovado por “Implement the proposed plan”.

### 1.1 Decisões de Anders

| Decisão | Escolha |
|---|---|
| Studio | Ocultar da navegação e preservar código, rota e projetos |
| Feed | Página própria |
| Atualização | Diária e manual |
| Assuntos | Sugestões e texto livre; IA geral com prioridade às preferências |
| Imagens | Uma capa gerada por matéria |
| Volume | Até cinco matérias por atualização |

### 1.2 Refinamento aprovado por Anders

Em 2026-10-04, após analisar a publicação, Anders aprovou o refinamento abaixo com “PLEASE IMPLEMENT THIS PLAN”:

| Decisão | Escolha |
|---|---|
| Profundidade editorial | 6–9 parágrafos, aproximadamente 700–1.000 palavras |
| Modelo editorial | `gpt-6-sol`, reasoning `medium`, verbosity `high` |
| Lote existente | Reescrever os três artigos, preservando identidade, títulos, resumos, capas e datas |
| Expansão desktop | Card aberto ocupa o destaque superior; demais cards ficam abaixo |
| Movimento | Rolagem suave até o destaque; movimento imediato quando redução de movimento estiver ativa |
| Mobile | Uma coluna, expansão no lugar e rolagem vertical própria da página |

`DECISÃO:` a reescrita do lote será atômica e precedida de backup; falha parcial conserva os três textos atuais. Fontes atuais permanecem e somente fontes adicionais verificadas pela busca podem ser anexadas. O refinamento inclui build isolado, publicação com backup, primeira reescrita real e health local/público. Merge e push ficam fora.

## 2. Objetivo e exemplos

Anders abre uma página editorial em `/chat/discover`, vê até cinco notícias novas por dia, expande cada card para ler uma narrativa em português com fontes e define assuntos que orientam as próximas curadorias.

- Quando abre o atalho antes destinado ao Studio, vê notícias recentes, datas, resumos e imagens.
- Quando adiciona “IA médica”, essa preferência influencia a próxima atualização sem excluir fatos gerais relevantes.
- Quando a geração falha, o feed anterior continua legível; falha de imagem mostra capa substituta.
- Quando a atualização está em curso, a interface mostra espera e evita outra execução simultânea.

Fica fora: remoção definitiva do Studio/workspace, publicação, instalação do timer no host, restart, push e mudança do Pulse.

## 3. Grupamentos

### Navegação e leitura editorial

**Objetivo:** criar a página com cards compactos e narrativa expandida acessível. **Escopo por arquivo:** `app/discover/*`, `components/discover/*`, links em `components/workspace-v2/ConversationRailV2.tsx`, `components/navigation/ProductNav.tsx` e entradas correspondentes da paleta de comandos. **Contratos:** auth do app, datas e fontes visíveis, expansão por clique/teclado, desktop/mobile. **Dependências:** API do feed. **Testes:** componentes/rotas focados, smoke browser no conjunto. **Evidência de pronto:** navegação e leitura sem overflow ou erro. **Preservar:** Chat, Pulse, SoundCase, `/chat/studio` e seus dados.

### Curadoria e preferências

**Objetivo:** gerar e guardar matérias recentes sem duplicação. **Escopo por arquivo:** `lib/discover/*`, `app/api/discover/*`, armazenamento próprio em `data/` criado apenas em runtime. **Contratos:** até cinco histórias por rodada com fontes HTTP(S) verificáveis, datas, resumo, narrativa e capa; assuntos validados; lock/claim para diário e manual; resultados anteriores sobrevivem a erro. **Dependências:** padrões existentes de auth, web search e image generation. **Testes:** normalização, deduplicação, concorrência e falhas simuladas; integração API. **Evidência de pronto:** API distingue idle/running/failed e serve artigos anteriores. **Preservar:** dados privados existentes e agendador Pulse.

### Agendamento e documentação

**Objetivo:** preparar atualização diária às 08h de São Paulo, sem ativar serviço. **Escopo por arquivo:** `systemd/chatgpt-discover.{service,timer}`, `scripts/run-discover-due.sh`, `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/INFRASTRUCTURE.md`, `BACKLOG.md`, `docs/DIARIO-AGENTS.md`, registro em `docs/plans/2026-10-04-feed-noticias-ia-report.md`. **Contratos:** endpoint interno autenticado, sem segredo no argv; alteração de preferências não dispara geração. **Dependências:** curadoria/armazenamento. **Testes:** script com token sintético, gates completos, build isolado. **Evidência de pronto:** validação registrada com exit codes e fluxo no browser. **Preservar:** units em execução, Apache, credenciais e checkout de produção.

## 4. Gates e pontos de parada

Executar focados, `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, Playwright para a UI e `git diff --check`, em worktree isolada. Usar dados e credenciais sintéticos no smoke. Parar a parte dependente caso a fonte não permita fatos verificáveis, a geração não tenha um contrato estável, ou a execução exija tocar serviço/dados reais. Registros técnicos no report acima. Publicação exige autorização separada.
