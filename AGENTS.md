# AGENTS.md — Gaúcho Chat

Regras locais, estado atual e invariantes deste repositório. A doutrina de trabalho (persona, núcleo operacional, gates, planejar e entregar) é o `AGENTS.md` global do Codex; este arquivo só acrescenta o que é específico do projeto e não a repete. Leitura inicial: este arquivo, `BACKLOG.md` (frentes e entregas) e, quando existir, `.codex_remember/remember.md`. Contratos vivem em `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/INFRASTRUCTURE.md` e `docs/MODELS.md`; o diário append-only vive em `docs/DIARIO-AGENTS.md` (novas entradas vão lá, no fim). Atualizar o documento canônico correspondente quando alterar API, arquitetura, modelos ou infraestrutura.

> ⚠️ **INFRA — cookies e Apache (2026-07-11):** a diretiva `ProxyPassReverseCookiePath / /chat` deste app vive DENTRO do bloco `<Location /chat>` em `/etc/apache2/sites-available/ultrassom.ai-optimized.conf`. Ela já esteve solta no nível do vhost e reescrevia o `Path` dos cookies de TODOS os serviços do ultrassom.ai (quebrou a autenticação de imagens do Sonaris — 401). **Nunca mover essa diretiva pra fora do `<Location /chat>`**, e qualquer ajuste de cookie no Apache deve ficar escopado ao `<Location>` do serviço. Detalhes: `/etc/apache2/APACHE.md`, seção Proxy Settings.

## Visão geral

Projeto de chat multimodal em `Next.js 16` com `React 19`, `TypeScript`, `Zustand` e `TanStack Query`, usando a `Responses API` da OpenAI.

Principais areas:

- `components/chat/*`: experiencia principal do chat, baloes, input, reasoning e export
- `components/workspace-v2/*`: shell atual do Gaucho Chat, rail de conversas, canvas central, composer e painel operacional
- `components/studio/*`: pagina Gaucho Studio Python com explorer, Monaco, run sandboxed, terminal PTY, notebook e chat contextual somente leitura
- `hooks/useChat.ts`: streaming, reasoning, citacoes, persistencia e fluxo de envio
- `lib/chat/useStreamingTextBuffer.ts`: buffer STT-style do texto do assistente
- `lib/models/modelConfig.ts`: catalogo de modelos e metadados usados no seletor
- `lib/openai/contextBuilder.ts`: montagem do prompt final com prompt base, persona fixa, ajustes, memórias e RAG
- `lib/server/chatRequest.ts`: montagem do request OpenAI, tools e defaults server-side
- `app/api/chat/route.ts`: proxy server-side para OpenAI
- `app/api/memory/*` e `lib/server/memory/*`: índice semântico, sugestões e memory tools
- `data/*.json`: persistencia local simples para conversas, memórias, persona, rascunhos e notas

## Estado atual do projeto

- Modelo padrão do chat: `gpt-6-luna` com reasoning `low` e modo `standard`; Astra mantém reasoning/verbosity `medium` fixos. Sol e Luna usam IDs GPT-6; Terra e IDs GPT-5.6 antigos são compatibilidade de leitura, com chamadas novas em GPT-6. `grok-4.7` substitui os usos ativos do `gpt-5.4-mini`, com reasoning `medium` fixo e provider xAI (`XAI_API_KEY` ou `GROK_API_KEY`). Mini permanece apenas como identificador legado; históricos não são reescritos.
- Shell ativo: `GauchoChatShellV2` / `WorkspaceFrameV2` — redesign completo (S0-S12)
- Página separada `/studio`: `GauchoStudioShell` Python-only sobre o workspace do servidor (sandbox systemd + step-up auth); console interativo com stdin (`run/stdin`, eco `command` no SSE, flush parcial de prompt em 150 ms); painéis redimensionáveis (`useStudioLayout`, `gaucho-studio:layout:v1`); preview de markdown em arquivos `.md` (`Código/Dividido/Preview`, `StudioMarkdownPreview` reusando o pipeline do chat, desde 2026-08-13); terminal PTY na jail (bash via `node-pty` + `systemd-run --pty`, xterm.js em view alternável do workbench com Ctrl+`, 1 sessão com idle-kill 30 min e reanexo com replay, desde 2026-08-13); notebook `.ipynb` (view de células no lugar do editor, ipykernel real na jail + helper `jupyter_client` fora dela, nbformat v4 com outputs texto+PNG persistidos, FIM ciente das células anteriores, 1 kernel com idle-kill 30 min, desde 2026-08-13); localStorage guarda só prefs/assistente (snapshot v2); modo Local TS/JS removido em 2026-08-12
- O assistente contextual do Studio segue somente-leitura: o painel lateral pode usar busca web e preserva status/citações; a assistência por célula permanece sem tools. OpenAI mantém defaults de reasoning/verbosity; Grok força `medium`, omite verbosity e usa `web_search`.
- Sistema visual padrão: Atmosphere Glass — Midnight Glass no dark e Daybreak no light
- Tokens de cor Shadcn/`--gc-*` globais em `app/globals.css` para alcançar portals Radix; geometria e ambientação escopadas a `.gc-atmosphere-shell`
- Preview de artefatos via `ArtifactPreviewSheet`; painel lateral focado em atividade e notas
- Command palette cmd+k (`CommandPalette` + `cmdk`)
- Quick actions nos balões do assistente (`QuickActionsBar`)
- Toolbar de seleção de texto estilo Notion (`SelectionToolbar` + `useTextSelection`)
- Export dropdown com Markdown/JSON/PDF/Clipboard (`ExportDropdown` + `useExport`)
- NotesContext para bridge texto→notas (`NotesProvider`)
- Primitivos de animação framer-motion em `components/motion/`
- `MessageBubble` usa `motion.div` com `layout` (streaming suave); `AnimatePresence` no loop
- Chips do header conectados ao estado real (model, reasoning, responseMode)
- Aba Persona mostra prévia somente-leitura do prompt principal (`BASE_SYSTEM_PROMPT` + `FIXED_PERSONA_PROMPT`) e edita `contextAboutUser`, `customSystemInstructions` e `responsePreferences`
- Memory tools (`remember_memory`, `search_memory`) ativas apenas em `responseMode="default"`; document/deepsearch/quiz seguem sem essas tools
- Gemini 3.8 Flash usa Interactions API stateless com thinking `low|medium|high`, Google Search e URL Context. Documento/Deepsearch médio usam Grok; Deepsearch alto e Quiz permanecem OpenAI. Jobs Grok são executados no servidor e persistidos localmente, pois xAI não implementa `background=true`.
- Deepsearch/Documento devem seguir o protocolo de pesquisa profunda com neuro-storytelling estruturado: plano validado quando o pedido for aberto, fontes autoritativas, citacoes inline e prosa narrativa clara, sem tom gauchesco em conteudo de pesquisa
- `image_generation` ativa apenas no modo default; `web_search_preview` entra em modos não-quiz; `code_interpreter` é opt-in
- Breakpoints: `md=768`, `lg=1024 (sidebar)`, `xl=1280 (painel contextual)`. "Mobile" é `MOBILE_MEDIA_QUERY` em `lib/layout/breakpoints.ts`: largura ≤ 767 px **ou** paisagem curta com toque (altura ≤ 500 px e `pointer: coarse`, o iPhone deitado); o variant `md` do Tailwind é redefinido em `app/globals.css` com a mesma condição negada, e os blocos `@media` crus do mobile usam a lista equivalente. `useVisualViewport` (montado em `WorkspaceFrameV2`) grava `--gc-visual-viewport-height` e `data-keyboard-open` no `<html>` para o teclado do iOS encolher o shell em vez de empurrá-lo.
- Balões de assistente devem manter key estável por `message.id`; não incluir `artifact.id`
- `MessageStreamStatus`: `"streaming" | "completed" | "aborted" | "failed" | "interrupted"` — `aborted` = usuário cancelou, `interrupted` = conexão caiu/reload mid-stream, `failed` = erro de API

Se houver conflito entre o diário (`docs/DIARIO-AGENTS.md`) e este bloco, este bloco é a fonte mais recente.

## Invariantes

- Não trocar Responses API por Chat Completions no fluxo OpenAI.
- `hooks/useChat.ts` é o orquestrador do envio, streaming, background e persistência.
- Balões usam key estável `message.id`; não incluir `artifact.id`.
- `NEXT_PUBLIC_BASE_PATH=/chat` precisa permanecer alinhado entre Next, Apache, systemd e `apiUrl()`. O cookie usa `Path=/chat`; `ProxyPassReverseCookiePath / /chat` fica dentro de `<Location /chat>` (aviso acima).
- Somente `/api/calendar/events/confirm` escreve no Google; drafts são locais.
- Nunca resolver layout mobile com `transform: scale` (mobile-compact); usar tokens, breakpoints e classes do shell.
- **Este checkout é a produção.** `chatgpt.service` roda `npm start` sobre `.next` deste diretório: `npm run build` aqui equivale a deploy. Gates de build e medições rodam em cópia isolada (`git worktree` ou clone); build no checkout só como parte de deploy autorizado, seguido de `systemctl restart chatgpt.service` e health em `http://127.0.0.1:3040/chat/api/health` e `https://ultrassom.ai/chat/api/health`.

### Dados runtime privados

Arquivos como `data/conversations.json`, `data/persona.json`, `data/google-calendar-token.json`, `data/calendar-event-drafts.json` e `data/workspace-notes.json` sao dados runtime do Anders.

Nao modificar, limpar, resetar, formatar ou usar como fixture de teste salvo pedido explicito ou necessidade inevitavel. Para smoke tests, preferir mocks, rotas sem cookie, fixtures temporarias com cleanup garantido ou ambiente isolado.

## Processo local

### Escada de validação

Escolher validacao proporcional ao tipo de mudanca:

- Documentacao/processo: `git diff --check`.
- TypeScript, libs ou rotas sem UI: teste focado e `npx tsc --noEmit`.
- Fluxo principal, API ou storage: teste focado, `npm test`, `npx tsc --noEmit` e `npm run build`.
- Visual/frontend: validacao anterior e smoke/screenshot em browser quando viavel.
- Servico ou rota publica: consultar `/etc/apache2/APACHE.md`, reiniciar o servico aplicavel e checar health local/publico.

Se uma validacao ampla for pulada por motivo razoavel, registrar explicitamente no fechamento.

Antes de `pronta para revisão` valem as suítes completas do global (`npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`; Playwright inteiro quando tocou frontend), com o build fora do checkout de produção (Invariantes).

### Smoke tests e efeitos externos

Quando um smoke real puder criar dados persistidos, evento externo, nota, conversa, rascunho ou arquivo:

- Preferir teste sem efeito persistente quando suficiente.
- Se o smoke persistente for necessario, criar dado claramente temporario e remove-lo na mesma rodada.
- Se nao houver endpoint seguro de cleanup, nao criar dado real sem avisar; validar por teste automatizado/mocked e registrar a limitacao.

Implementar sempre nao significa criar efeito externo irreversivel. Quando a acao puder persistir dado real, chamar API externa, apagar dados ou mudar servico publico, implementar o caminho seguro: rascunho, mock, teste sem efeito, backup ou confirmacao explicita.

### Tooling

- Usar `rg` ou `rg --files` antes de buscas lentas.
- Usar leitura paralela apenas para comandos independentes de inspecao (`sed`, `rg`, `git status`, `git diff`, `ls`).
- Nao rodar comandos mutantes em paralelo.
- Para edicoes manuais, usar `apply_patch`.
- Antes de editar arquivo existente, ler o trecho relevante na sessao.
- Nao usar comandos destrutivos (`git reset`, `checkout --`, remocao ampla) sem pedido explicito.

### Documentos vivos

- `BACKLOG.md`: frentes, entregas, decisões acumuladas e dívida operacional; documento vivo de uma frente é atualizado durante o processo, com status atual.
- `docs/DIARIO-AGENTS.md`: memória operacional append-only, uma entrada ao fim de rodada significativa.
- Kickoff antigo é marcado como histórico quando não representa mais o estado atual.

### Pesquisa profunda e Deepsearch

Usar o protocolo de pesquisa profunda quando Anders pedir `deep research`, `deep dive`, `pesquisa profunda`, `investigacao a fundo`, relatorio amplo, explicacao tecnico-cientifica extensa ou cobertura completa de um tema. Nao usar para fato unico, definicao curta ou conversa casual.

Quando o pedido for curto ou aberto, primeiro construir um delineamento de especialista e validar com Anders antes de pesquisar: eixos tematicos, subperguntas, historico, estado da arte, debates, implicacoes praticas e pontos que um especialista nao deixaria passar. Se Anders ja trouxer um briefing detalhado, seguir direto para a pesquisa.

Preferir fontes primarias e autoritativas: artigos revisados por pares, revisoes sistematicas, orgaos oficiais, standards, documentacao primaria e consensos tecnicos. Para medicina, ciencia e tecnologia, cruzar alegacoes importantes em mais de uma fonte independente e explicitar incertezas ou divergencias reais. Blogs, opinioes e sites comerciais so entram quando o proprio tema exigir percepcao de usuarios/mercado ou quando nao houver fonte melhor.

Escrever como tutor narrativo: abrir com uma introducao antes dos subtitulos, usar `###` com subtitulos tematicos criativos, paragrafos curtos, voz ativa, analogias concretas logo apos conceitos dificeis e perguntas reflexivas pequenas para ajudar retencao. Usar **negrito** apenas na primeira aparicao de termos-chave. Evitar listas verticais no corpo do relatorio; usar tabelas apenas quando linhas e colunas realmente carregarem comparacao util.

Citacoes devem aparecer inline, em Markdown natural, logo apos a frase sustentada pela fonte. Nao criar secao final de referencias quando a resposta ja tem citacoes inline. Em pesquisas e relatorios, nao aplicar o tom gauchesco: a persona calorosa pode permanecer na conversa com Anders, mas o texto investigativo deve ser tecnico, claro e universal.

Se o relatorio passar de cerca de seis secoes tematicas ou Anders pedir formato exportavel, preferir gerar arquivo Markdown; oferecer PDF profissional quando houver caminho seguro no projeto para produzir o documento.

## Observações operacionais

- O repo remoto atual e `origin -> https://github.com/Anderson-Barcellos/CHATGPT.git`
- O branch principal rastreado e `main`
- Evitar sobrescrever mudancas locais nao relacionadas sem confirmar antes
- O painel operacional usa a aba principal `Pulse` para o feed de geracoes e a aba `Rotinas` para criar/pausar/executar/excluir recorrencias. Google Calendar pode permanecer no codigo como legado, mas novos fluxos recorrentes devem usar `/api/pulse/*`, `data/pulse-tasks.json`, `data/pulse-runs.json` e `chatgpt-pulse.timer`.
- Chat e Pulse usam o mesmo `MiniAudioPlayer`, aberto por um unico alto-falante e iniciado em `/api/tts/xai` via `useAssistantTts` (voz Orion, MP3, chunks remuxados em `/api/tts/xai/merge` para download). Grok Realtime (`grok-voice-latest`) com voz Orion e uma selecao manual dentro do player; abrir o player nao inicia nem cobra nenhuma engine. As rotas OpenAI `/api/tts` e `/api/realtime/tts-call` permanecem legadas; SoundCase conserva sua geracao OpenAI.
- Execuções do Pulse usam contexto pessoal enxuto. Cada rotina escolhe `grok-4.7` (default), Sol ou Terra; Grok força reasoning `medium`, OpenAI mantém verbosity `high`. Modelo/effort efetivos ficam gravados no run. Identificador mini legado resolve para Grok; imagens continuam OpenAI por chamada separada quando necessário. Overrides operacionais permanecem respeitando os contratos do provider.
- SoundCase oferece Grok Realtime experimental (`grok-voice-latest`) somente para leitura de texto; TTS/arquivos e Realtime OpenAI permanecem. Token efêmero no browser, chave permanente server-side, preferências de engine/voz/velocidade separadas das configurações de geração. Abrir o painel não inicia sessão.
- QA em outra instância Next deve usar `GAUCHO_ISOLATED_RUNTIME=true`, dados sintéticos exclusivos e credenciais sintéticas explícitas. A flag desabilita o Studio real, sem dispensar auth ou locks. O boot recusa recursos compartilhados; novas sessões Studio são vinculadas ao serviço proprietário validado, sem cleanup por wildcard. Build e dados de teste continuam isolados; a flag não deve entrar no serviço principal.
