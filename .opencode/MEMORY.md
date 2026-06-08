# Gaucho Chat — Project Memory

### 2026-06-04 20:29 - Densidade mobile compacta por tokens

Context:
Anders observou que reduzir as dimensões do layout mobile em ~15% acomodava melhor o Gaucho Chat, mas pediu uma solução robusta sem gambiarras de viewport, `zoom` ou `transform: scale()` global.

Details:
`app/globals.css` passou a centralizar um contrato de densidade mobile abaixo de `md`, com tokens `--gc-mobile-*` para shell, header, subheader, composer, área do chat, welcome state, painel/contexto e settings. `WorkspaceLayoutV2`, `ChatContainer`, `ContextPanelV2`, `ConversationRailV2`, `AgendaPanelV2` e `SettingsDrawer` passaram a consumir esses tokens nos pontos principais de padding, gap, altura e radius. A solução preserva a tipografia deliberada das mensagens e evita escalar o app inteiro como bitmap.

Notes:
Validação desta rodada: `npx tsc --noEmit`, `git diff --check` focado, `npm test` e `npm run build` passaram. O `chatgpt.service` foi reiniciado e o health local `/chat/api/health` respondeu `healthy`. Se for ajustar mais a densidade, preferir alterar os tokens em `app/globals.css` antes de voltar a espalhar `px-*`, `py-*`, `h-*` locais no mobile.

### 2026-06-04 20:39 - Docs da densidade mobile paralela ao Codex

Context:
Anders pediu atualizar a documentação para registrar que a compactação mobile por tokens foi uma implementação paralela ao fluxo Codex de refinamentos visuais.

Details:
Atualizados `docs/REDESIGN_ROADPACK.md`, `docs/CODEX_KICKOFF.md`, `docs/README.md`, `README.md`, `docs/ARCHITECTURE.md`, `CLAUDE.md` e `AGENTS.md`. O M1 antigo do kickoff Codex agora está marcado como histórico/concluído; o roadpack registra a side quest de densidade mobile como implementada; as docs canônicas mencionam o contrato `--gc-mobile-*` e a regra de não usar `zoom`, viewport artificial ou `transform: scale()` global.

Notes:
Validação documental: `git diff --check` focado passou. O serviço foi reiniciado via `systemctl restart chatgpt.service`; health local retornou `healthy` e health público retornou HTTP 200.

### [2026-05-03 18:30] — Correção do fluxo de anexos de arquivos no chat

Context:
- Anders reportou erro consistente ao anexar imagens, PDFs ou qualquer arquivo junto da janela de chat
- Mapeamento completo do fluxo: UI (drag-drop/paste/picker) → useFileAttachments → useChat.sendMessage → buildInputFromMessages → API /api/chat → OpenAI Responses API

Detalhes técnicos:
1. **Body size limit ausente na API route** — Apenas serverActions.bodySizeLimit (2mb) no next.config, mas API routes usam limite próprio. Aumentado para 10mb em ambos (`next.config.ts:36` e `app/api/chat/route.ts:140` com `export const config`).
2. **Filtro frágil dataUrl !== thumbnailUrl** — Substituído por `isValidImageDataUrl()` com regex exigindo base64 de 100+ chars (`lib/openai/buildInput.ts:14-24`). Evita falsos negativos em imagens pequenas e falsos positivos em dados persistidos.
3. **Placeholder [N chars] poluindo histórico** — `sanitizeMessagesForStorage` substitui extractedText por placeholder. Novo `isSanitizedPlaceholder()` detecta e ignora esses placeholders no `buildInputFromMessages` (`lib/openai/buildInput.ts:31-33`).
4. **Tratamento de erro 413** — Body parsing com try/catch explícito na route.ts, retorna mensagem clara quando corpo excede limite (`app/api/chat/route.ts:153-168`).

Arquivos alterados:
- `next.config.ts` — bodySizeLimit 2mb → 10mb
- `app/api/chat/route.ts` — export config + bodyParser + try/catch no parse + erro 413
- `lib/openai/buildInput.ts` — isValidImageDataUrl() + isSanitizedPlaceholder() + filtros robustos
- `lib/openai/buildInput.test.ts` — 5 testes (2 novos: dataUrl undefined, dataUrl curto demais, placeholder ignorado)

Validação:
- 81/81 testes passando
- tsc --noEmit limpo
- Build de produção OK

### [2026-05-03 19:00] — Corrigido toggle do painel lateral direito (abria mas não fechava)

Context:
- Anders reportou que o botão do painel contextual abria mas não fechava ao clicar de novo

Detalhes técnicos:
- **Causa:** `GauchoChatShellV2.tsx:114-118` computava `shouldShowMobileContext = mobileContextOpen || (artifactOpen && ...)`. O `Sheet` recebia `open={shouldShowMobileContext}` como controlled component. Quando o usuário clicava pra fechar, `handleMobileContextOpenChange(false)` setava `mobileContextOpen=false` e fechava o artefato via `closeArtifact()`, mas o `open` prop do Sheet ainda via `true` (porque o React não tinha rerenderizado ainda) → conflito controlled/uncontrolled → Sheet ignorava o comando de fechar.
- **Solução:** Separar toggle do usuário da lógica de auto-abertura. `mobileContextOpen` passado diretamente como prop (só o toggle). `useEffect` cuida de abrir automaticamente quando surge um artefato em tela <1280px.
- **Arquivo alterado:** `components/workspace-v2/GauchoChatShellV2.tsx` — substituído `shouldShowMobileContext` computado por `mobileContextOpen` + `useEffect` de auto-abertura

### [2026-05-04 02:09] — Novo mapeamento de erro ao anexar (desktop + mobile)

Context:
- Anders pediu para revisar o projeto e mapear erro de implementação ao selecionar anexos no input do chat, tanto no desktop quanto no mobile.

Details:
- Fluxo confirmado: `CommandComposerContainerV2` (picker/paste/drop) → `useFileAttachments.addFiles` → `useChat.sendMessage` → `buildInputFromMessages` → `/api/chat`.
- Hipótese técnica principal encontrada: `getAttachmentType(file)` depende de MIME estrito para imagens/PDF (`image/jpeg|png|webp|gif` e `application/pdf`) sem fallback por extensão para imagem/PDF.
- Impacto esperado: quando navegador/OS retorna `file.type` vazio ou variante fora da lista (cenário comum em iOS/Safari e alguns picks de desktop), anexos válidos são rejeitados como “Tipo de arquivo nao suportado”.

Notes:
- Próxima ação recomendada: robustecer detecção por extensão para imagem/PDF e incluir variantes comuns (`.jpg/.jpeg/.png/.webp/.gif/.pdf`, opcional `.heic/.heif` com estratégia de conversão/rejeição amigável).

### [2026-05-04 02:10] — Convenção de memória confirmada

Context:
- Anders confirmou que a pasta de memória foi renomeada para `.opencode`.

Details:
- A partir desta rodada, memória operacional deve ser lida/escrita em `.opencode/MEMORY.md`.

Notes:
- Não usar mais `.deepseek/*` neste projeto.

### [2026-05-04 02:12] — Sintoma refinado do bug de anexos

Context:
- Anders reportou que o erro observado ao anexar é específico para imagens.

Details:
- Mensagem recorrente no composer: `Sem Título-3.png: Image load failed`.
- Isso aponta diretamente para `resizeImage()` em `hooks/useFileAttachments.ts`, no handler `img.onerror`.
- Indica falha na etapa de decodificação/renderização da imagem antes mesmo do envio para API.

Notes:
- Próxima correção deve endurecer a pipeline de leitura de imagem (fallback com `FileReader`) e melhorar heurística de tipo/extensão para mobile/desktop.

### [2026-05-04 02:15] — Correção aplicada para falha de anexos de imagem

Context:
- Implementação do fix após confirmação do sintoma `Image load failed` em imagens.

Details:
- Arquivo alterado: `hooks/useFileAttachments.ts`.
- `getAttachmentType(file)` agora aceita fallback por extensão para imagem/PDF (`.jpg/.jpeg/.png/.webp/.gif/.pdf`) e também considera `mimeType.startsWith("image/")`.
- `resizeImage()` foi reescrito com fallback de decode:
  1) tenta `URL.createObjectURL(file)` + `Image()`
  2) em falha, tenta `FileReader.readAsDataURL(file)` + `Image()`
  3) em nova falha, retorna erro enriquecido com type/ext/size.
- Nova validação para arquivo vazio (`size <= 0`) antes do processamento.

Notes:
- Validação executada:
  - `npm run build` ✅ (com warning já existente de `config` em `app/api/chat/route.ts`)
  - `npx tsc --noEmit` ✅
  - `npm run lint` ❌ com erros pré-existentes fora do escopo desta correção.

### [2026-05-04 02:18] — Operação do serviço confirmada via systemd

Context:
- Anders informou que o app roda como serviço em `/etc/systemd` (não via `npm run dev`).

Details:
- Unit validada: `/etc/systemd/system/chatgpt.service`.
- Serviço reiniciado com `systemctl restart chatgpt.service`.
- Status após restart: `active (running)` com `Main PID` novo.

Notes:
- Para aplicar alterações no ambiente de execução do Anders, usar fluxo padrão `systemctl restart chatgpt.service`.

### [2026-05-04 02:21] — AGENTS global atualizado com regras de systemd/journal

Context:
- Anders pediu para formalizar no arquivo global `/root/.config/opencode/AGENTS.md` as regras de operação de serviços.

Details:
- Seção adicionada: `## Service Operations (systemd)`.
- Regras incluídas:
  - usar systemd como padrão quando houver serviço implantado;
  - localização padrão de units em `/etc/systemd/system/`;
  - criar unit nesse diretório quando não existir + `daemon-reload` + `enable --now`;
  - restart + verificação com `systemctl is-active/status`;
  - checagem de `journalctl` como regra geral após restart e em investigação de falhas.

Notes:
- Próximas sessões devem seguir esse playbook por padrão para evitar confusão com `npm run dev` em produção.

### [2026-05-05 12:37] — Auditoria de docs OpenCode e config global

Context:
- Anders pediu revisão da documentação mais recente do OpenCode para monitorar tokens/janela no TUI e checagem do config global para economizar tokens na OpenAI.

Details:
- Docs confirmadas (última atualização em 2026-05-05):
  - `opencode stats` mostra custo/tokens por período, modelo e ferramentas.
  - `opencode models --verbose` expõe metadados de modelo (custos, `limit.context`, `limit.output`, capacidades).
  - Em providers custom, `models.<id>.limit.context/output` habilita OpenCode a estimar contexto restante no TUI.
- Config global auditado em `~/.config/opencode/opencode.json`:
  - Estrutura está incorreta: `deepseek`, `agent`, `compaction` e `watcher` foram colocados dentro de `provider`.
  - `provider.openai.models` foi aninhado dentro de `provider.openai.options`, então opções por modelo podem não ser aplicadas como esperado.
  - `opencode debug config` mostrou `agent`, `compaction` e `watcher` efetivamente vazios na resolução final (sintoma da estrutura inválida).
- Observação de segurança: ao rodar `opencode debug config`, a chave OpenAI foi exibida em texto claro no output.

Notes:
- Próxima rodada: reestruturar `~/.config/opencode/opencode.json` para schema correto e ajustar defaults econômicos (`small_model`, variantes menos custosas, compaction no topo).
- Após qualquer investigação com `opencode debug config`, evitar colar output bruto por conter segredos.

### [2026-05-05 12:47] — Config OpenCode corrigido e otimizado para gpt-5.4-mini

Context:
- Anders pediu ajuste prático para reduzir custo mantendo observabilidade de reasoning, com preferência por `gpt-5.4-mini` em `high` e `textVerbosity` em `low`.

Details:
- Arquivo atualizado: `~/.config/opencode/opencode.json`.
- Correções estruturais aplicadas no schema:
  - `agent`, `compaction` e `watcher` movidos para o nível raiz.
  - `provider.openai.models` movido para fora de `provider.openai.options`.
  - `provider.deepseek` movido para ser irmão de `provider.openai`.
- Defaults configurados:
  - `model`: `openai/gpt-5.4-mini`
  - `small_model`: `openai/gpt-5.4-nano`
  - `gpt-5.4-mini`: `reasoningEffort=high`, `textVerbosity=low`, `reasoningSummary=detailed`, `store=false`
  - Agentes principais OpenAI (`ChatGPTMaestro`, `OpenAIApiMaestro`) alinhados ao `gpt-5.4-mini` com `textVerbosity=low`.
- Validação feita sem expor segredo: `opencode debug config` parseado com `python3` para conferir apenas campos não sensíveis.

Notes:
- `textVerbosity` baixo reduz tamanho da resposta final; `reasoningSummary=detailed` mantém rastreabilidade do thinking (custo adicional menor que aumentar verbosity geral).
- Para alternar esforço de reasoning dinamicamente durante uso, usar ciclo de variantes (`ctrl+t`) no TUI.

### [2026-05-05 13:04] — Preferência de check-ins entre etapas formalizada

Context:
- Anders pediu explicitamente que, em tarefas com múltiplas etapas, o agente envie comentários curtos entre etapas para indicar andamento.

Details:
- Regra adicionada no AGENTS global: `/root/.config/opencode/AGENTS.md` em `# Communication During Work`.
- Regra também registrada no projeto em `AGENTS.md` sob `## Preferencia De Comunicacao`.
- Formato preferido dos check-ins: etapa atual, achado rápido, próximo passo.

Notes:
- Aplicar esse padrão por default neste projeto para melhorar previsibilidade durante execuções longas.

### [2026-05-05 13:37] — Plugin de cache v2 endurecido

Context:
- Anders pediu evolução do plugin custom de cache do OpenCode para reduzir fragmentação, evitar vazamento de chave bruta em logs e tornar headers mais conservadores.

Details:
- Arquivo alterado: `~/.config/opencode/plugins/opencode-context-cache.mjs`.
- Mudanças principais:
  - Chave automática agora usa `user@host:project_root` (detecta raiz pelo diretório com `.git`, com fallback para `cwd`).
  - Logs de debug não exibem mais a chave raw; apenas hash truncado (`xxxx...`).
  - Injeção de headers de sessão ficou conservadora:
    - aplica todos só com `OPENCODE_CONTEXT_CACHE_ALL_HEADERS=true`;
    - senão, reaproveita apenas headers já existentes;
    - para providers OpenAI-compatíveis conhecidos, aplica só `x-session-id`.
  - Novo env var documentado no código: `OPENCODE_CONTEXT_CACHE_ALL_HEADERS`.
- Validação: `node --check ~/.config/opencode/plugins/opencode-context-cache.mjs` OK.

Notes:
- Manter `OPENCODE_CONTEXT_CACHE_DEBUG` desligado em uso normal.
- Se algum provider específico precisar dos 3 headers antigos (`x-session-id`, `conversation_id`, `session_id`), ativar temporariamente `OPENCODE_CONTEXT_CACHE_ALL_HEADERS=true`.

### 2026-05-06 08:35 — Citações encolhidas + reasoning ao vivo corrigido

Context:
- Anders pediu ajuste visual: citações verdes estavam muito grandes. Também reportou que o reasoning só aparecia no final, não paralelo à resposta.

Details:
- **Citações** (`MessageBubble.tsx:229-256`): padding reduzido (`px-2 py-0.5` → `px-1.5 py-px`), ícones menores, max-width reduzido, espaçamento e opacidade do header "Fontes" reduzidos.
- **Reasoning ao vivo**: `streamMachine.ts` não processava `response.reasoning_text.delta` (só `reasoning_summary_text.delta`). Adicionado campo `reasoningText` no `AssistantStreamState`, handler pro evento, e inclusão no `assistantStreamStateToMessagePatch`. A OpenAI envia reasoning_text DURANTE o thinking e summary_text DEPOIS — agora ambos são capturados e o `ReasoningPanel` renderiza ao vivo via `ReasoningRollingWindow`.
- Testes atualizados: `streamMachine.test.ts` cobre o novo evento.
- Serviço reiniciado com `systemctl restart chatgpt.service`, ativo e limpo.

Notes:
- 84/84 testes passando, tsc limpo.
- Se reasoning ainda não aparecer ao vivo, verificar se o modelo usado envia `response.reasoning_text.delta` (modelos sem reasoning visível podem enviar só o summary).

### [2026-05-06 08:55] — UX do reasoning no balão durante streaming

Context:
- Anders pediu ajuste do fluxo visual de reasoning no balão durante elaboração da resposta, após revisão do fluxo real no repo.

Details:
- `components/chat/MessageBubble.tsx`: `ReasoningPanel` foi reposicionado para renderizar antes de `MessageContent` no caminho de exibição normal do assistente.
- `components/chat/ReasoningPanel.tsx`: painel passou a ser controlado (`open`/`onOpenChange`) com regra explícita de transição:
  - autoabre quando `reasoningStatus === "thinking"`;
  - autorecolhe quando sai de `thinking` para estado terminal;
  - após terminal, mantém comportamento manual do usuário.
- Logs de debug de reasoning removidos do stream em `hooks/useChat.ts` para reduzir ruído de console.
- Novo teste: `components/chat/ReasoningPanel.test.ts` cobrindo autoabertura, autorecolhimento e preservação da escolha manual em estado terminal.

Notes:
- Validação executada nesta rodada: `npm test` (87 testes passando) e `npx tsc --noEmit` sem erros.

### [2026-05-06 09:10] — Fallback de summary no reasoning ao vivo

Context:
- Anders reportou que o balaozinho de raciocinio durante elaboracao da resposta podia parecer "oculto" quando ainda nao havia `reasoningText` disponivel.

Details:
- `components/chat/ReasoningPanel.tsx`:
  - adicionado helper `getReasoningThinkingContent` com prioridade `reasoningText` e fallback para `reasoningSummary` durante `thinking`.
  - fluxo de render em estado `thinking` passou a usar esse helper em vez de depender apenas de `hasFull`.
- `components/chat/ReasoningPanel.test.ts`:
  - novos testes para garantir prioridade do full text e fallback para summary.

Notes:
- Validacao executada: `npm test -- components/chat/ReasoningPanel.test.ts` (5 testes passando) e `npx tsc --noEmit` (sem erros).

### [2026-05-06 09:18] — Catalogo de modelos ajustado no seletor

Context:
- Anders pediu para ajustar os modelos exibidos na selecao: remover `gpt-5.3-codex`, `gpt-4o` e `o4-mini`, mantendo `gpt-5.1` e adicionando `gpt-5.4-mini`.

Details:
- `lib/models/modelConfig.ts`:
  - adicionado modelo `gpt-5.4-mini` na familia `gpt-5` com capacidades de chat/reasoning/vision/tool/json.
  - removido modelo `o4-mini` do catalogo.
- `gpt-5.1` ja estava presente no catalogo e permaneceu ativo.
- `gpt-5.3-codex` e `gpt-4o` nao estavam mais no catalogo de runtime (apareciam apenas em docs/strings legadas).

Notes:
- Validacao executada: `npx tsc --noEmit` (sem erros).

### [2026-05-06 09:24] — Default de reasoning do gpt-5.4-mini

Context:
- Anders pediu para o `gpt-5.4-mini` iniciar com reasoning desligado por padrao, diferente dos demais modelos de reasoning.

Details:
- `stores/settingsStore.ts`:
  - `buildDefaultModelSettings` passou a tratar `gpt-5.4-mini` com `reasoningEffort: "none"`.
  - `reasoningSummary` agora deriva do effort default (`off` quando effort = `none`, `auto` caso contrario).

Notes:
- Validacao executada: `npx tsc --noEmit` + `npm run build`.
- Servico reiniciado: `systemctl restart chatgpt.service` (ativo).

### [2026-05-06 09:28] — Reasoning summary default em detailed

Context:
- Anders pediu para trocar o default de `reasoningSummary` porque `auto` nao estava retornando resumo de forma consistente.

Details:
- `stores/settingsStore.ts`:
  - `buildDefaultModelSettings` agora usa `reasoningSummary: "detailed"` quando o modelo inicia com reasoning ativo.
  - quando `reasoningEffort` default e `none` (caso `gpt-5.4-mini`), o summary segue `off`.

Notes:
- Validacao executada: `npx tsc --noEmit` + `npm run build`.
- Servico reiniciado: `systemctl restart chatgpt.service` (ativo).

### [2026-05-06 10:50] — Bolhas do chat sem encolher em telas grandes

Context:
- Anders reportou percepcao de "zoom" nos componentes em desktop; analise refinada indicou que o problema real era encolhimento das bolhas acima de ~640px.

Details:
- Arquivo alterado: `components/chat/MessageBubble.tsx`.
- Classe de largura da bolha simplificada de `max-w-[93%] min-w-0 sm:max-w-[80%] xl:max-w-[75%]` para `max-w-[93%] min-w-0`.
- Resultado: ocupacao horizontal das mensagens fica consistente entre mobile e desktop, removendo o recuo extra em resolucoes maiores.

Notes:
- Validacao executada: `npx tsc --noEmit` (sem erros).

### [2026-05-06 10:57] — Bolhas liberadas para largura total da coluna

Context:
- Após validar no inspector, Anders pediu bolhas ainda mais largas no desktop.

Details:
- Arquivo alterado: `components/chat/MessageBubble.tsx`.
- Classe de largura da bolha alterada de `max-w-[93%] min-w-0` para `max-w-full min-w-0`.
- Efeito: mensagens longas agora ocupam toda a largura disponível da coluna (descontando avatar/gap do flex), sem limite artificial.

Notes:
- Validacao executada: `npx tsc --noEmit` (sem erros).

### [2026-05-06 10:59] — Bolhas desacopladas da largura do texto

Context:
- Anders percebeu que a bolha ainda parecia reativa ao comprimento da linha de texto.

Details:
- Arquivo alterado: `components/chat/MessageBubble.tsx`.
- Wrapper da bolha recebeu `w-full`.
- `Card` da bolha recebeu `w-full`.
- Efeito: a bolha passa a preencher toda a largura disponível da coluna (menos avatar/gap), sem encolher conforme texto curto.

Notes:
- Validacao executada: `npx tsc --noEmit` (sem erros).

### [2026-05-06 11:01] — Avatares do chat levemente maiores

Context:
- Anders pediu para aumentar um pouco o tamanho do avatar no chat.

Details:
- Arquivo alterado: `components/chat/MessageBubble.tsx`.
- Avatar do assistente: `h-6 w-6 md:h-8 md:w-8` -> `h-7 w-7 md:h-9 md:w-9`.
- Avatar do usuário: `h-6 w-6 md:h-8 md:w-8` -> `h-7 w-7 md:h-9 md:w-9`.

Notes:
- Validacao executada: `npx tsc --noEmit` (sem erros).
- Servico reiniciado: `systemctl restart chatgpt.service` (ativo).

### [2026-05-06 11:45] — Catalogo de modelos: removidos 5.3 e 5.4, adicionado chat-latest

Context:
- Anders pediu para testar `gpt-5.5-chat-latest` na API — descobriu-se que o nome nao existe (404).
- O nome correto e `chat-latest` (alias ChatGPT da serie GPT-5), que funciona em Chat Completions e Responses API.
- `gpt-5.5` (frontier) tambem funciona em ambas as APIs, mas usa `max_completion_tokens` na Chat Completions.

Details:
- `lib/models/modelConfig.ts`: removidos `gpt-5.3-chat-latest` e `gpt-5.4`; adicionado `chat-latest` (GPT-5.5 Instant) como modelo padrao — familia `gpt-5`, 128k context, 16k output, badge "Padrao".
- `stores/settingsStore.ts`: `DEFAULT_MODEL` trocado para `chat-latest`.
- `app/api/chat/route.ts`: defaults de modelo trocados para `chat-latest` (2 ocorrencias).
- `AGENTS.md` atualizado com nova Rodada 8 e estado atual.

Notes:
- Validacao: `npx tsc --noEmit` limpo.
- Modelos mantidos: `gpt-5.5`, `gpt-5.4-mini`, `gpt-5.1`, `gpt-4.1`, `o3`, `gpt-image-2.0`, `dall-e-3`.

### [2026-05-08 20:39] — Auditoria inicial do workspace-v2 para redesign

Context:
- Anders pediu um plano de redesenho focado em modernizar layout/cores/animações e remover/reaproveitar componentes com baixo valor.

Details:
- Mapeamento confirmou `app/page.tsx` renderizando `GauchoChatShellV2` como shell principal.
- Núcleo ativo e saudável em `components/workspace-v2`: `GauchoChatShellV2`, `WorkspaceLayoutV2` (`WorkspaceFrameV2` + `CommandComposerV2`), `ConversationRailV2`, `CommandComposerContainerV2`, `ContextPanelV2`, `CanvasContent`, `NotesProvider`, `ExportDropdown`, `ChatCanvasV2`.
- Código morto identificado no canvas: `CanvasDragHandle.tsx`, `CanvasResizeHandle.tsx`, `useCanvasDrag.ts`, `useCanvasResize.ts` (sem consumidores no repo).
- Estado órfão no `uiStore`: `canvasPosition`, `canvasDimensions`, `canvasMaximized` e setters associados sem uso.
- Duplicação funcional para copiar/baixar artefato entre `ContextPanelV2` e `CanvasOverlayV2` (candidato a hook/util compartilhado).

Notes:
- Próxima rodada pode começar por Sprint 0: limpeza de código morto + consolidação de ações de artefato, antes de mexer pesado em visual/motion.

### [2026-05-08 20:41] — Sprint 0 concluída (higiene estrutural)

Context:
- Anders aprovou iniciar a Sprint 0 do redesign para remover peso desnecessário e preparar o terreno visual.

Details:
- Consolidada duplicação de export de artefatos em util compartilhado `lib/artifacts/exportArtifact.ts`.
- `ContextPanelV2` e `CanvasOverlayV2` passaram a usar o util para copiar/baixar artefatos, reduzindo lógica repetida.
- Removido estado órfão de canvas em `stores/uiStore.ts`: `canvasPosition`, `canvasDimensions`, `canvasMaximized` e setters.
- Removidos arquivos mortos sem consumidores em `components/workspace-v2/canvas/`:
  - `CanvasDragHandle.tsx`
  - `CanvasResizeHandle.tsx`
  - `useCanvasDrag.ts`
  - `useCanvasResize.ts`

Notes:
- Validacao executada: `npx tsc --noEmit` e `npm run build` (ambos OK).
- Base pronta para Sprint 1 (refresh visual/tokens) com menos acoplamento e menos superficie morta.

### [2026-05-08 20:44] — Sprint 1 aplicada (refresh visual por tokens)

Context:
- Anders aprovou iniciar a Sprint 1 apos a limpeza estrutural, com foco em visual mais moderno e coerente.

Details:
- Atualizada a paleta global em `app/globals.css` para direcao "clean clinica" (menos magenta/roxo e mais ciano/teal/azul) em light e dark.
- Revisados tokens shadcn base (`--background`, `--primary`, `--accent`, `--border`, charts e sidebar) para alinhar contraste e identidade.
- Revisados tokens de workspace `--gc-*` (page background, surfaces, overlays, bubbles, glass) com gradientes mais limpos e legiveis.
- Ajustados `gc-text-gradient`, `gc-canvas-surface`, `glass-hover` e `gpt-core-beat` para manter consistencia cromatica da nova paleta.

Notes:
- Validacao executada: `npm run build` (OK).
- Proxima rodada sugerida: Sprint 2 com padronizacao de classes Tailwind no `workspace-v2` e redução de repeticao de estilos utilitarios.

### [2026-05-08 20:48] — Ajuste adicional: layout perceptivel no workspace-v2

Context:
- Anders reportou que, apos Sprint 1, a mudanca parecia "igual" em termos de layout.

Details:
- `components/workspace-v2/WorkspaceLayoutV2.tsx` recebeu refresh estrutural visivel:
  - shell principal mais "windowed" (borda/raio/sombra/backdrop),
  - header e composer mais encorpados,
  - painéis lateral/contexto com gradientes de superficie,
  - largura do painel contextual ajustada (`23rem` default, `31rem` expandido),
  - reforco visual de botões/icon controls.
- `components/workspace-v2/ConversationRailV2.tsx` ganhou blocos de contexto no topo (contadores "Hoje" e "Fixadas").
- Build validado e servico reiniciado para aplicar no runtime.

Notes:
- Validacao executada: `npm run build` (OK).
- Runtime: `systemctl restart chatgpt.service` + `systemctl is-active` => `active`.

### [2026-05-08 20:58] — Auditoria ampla de resquicios (projeto inteiro)

Context:
- Anders pediu para mapear o projeto todo e localizar restos de iteracoes anteriores/artefatos de refactor.

Details:
- Arquitetura ativa confirmada: `app/page.tsx` renderiza `GauchoChatShellV2` como shell unico do chat.
- Auditoria de grafo de imports (entrypoints `app/*` + `proxy.ts`) encontrou arquivos nao alcançados em runtime:
  - `components/chat/ExportMenu.tsx`
  - `components/chat/MessageActions.tsx`
  - `components/settings/CustomInstructions.tsx`
  - `components/settings/MemoryManager.tsx`
  - `components/settings/PromptPreview.tsx`
  - `components/ui/alert.tsx`
  - `components/ui/label.tsx`
  - `components/ui/select.tsx`
  - `components/ui/separator.tsx`
  - `hooks/queries/index.ts`
  - `hooks/useCommandPalette.ts`
  - `lib/export/artifactPdf.ts`
  - `lib/export/index.ts`
  - `lib/performance/index.ts`
  - `lib/storage/db.ts`
  - `lib/storage/settings.ts`
  - `lib/utils/tokenEstimate.ts`
- Cadeia Dexie identificada como legado sem uso atual: `lib/storage/db.ts` + `lib/storage/settings.ts` (hooks atuais usam APIs server-side, nao IndexedDB).
- Dependencias sem import no codigo atual (candidatas a limpeza apos remoção dos arquivos mortos):
  - `@tanstack/react-query-devtools`, `dexie-react-hooks`, `diff`, `radix-ui`, `rehype-highlight`, `rehype-raw`, `rehype-sanitize`, `@types/diff`, `@types/react-syntax-highlighter`.
- Documentacao com drift relevante para arquitetura atual:
  - `README.md` (modelos antigos)
  - `docs/API.md` (default de modelo antigo)
  - `docs/MODELS.md` (catalogo desatualizado)
  - `docs/COMPONENTS.md` (referencias a `SidebarModern`, `--v2-*`, default antigo)
  - `docs/architecture/02-CORE-COMPONENTS.md` (ChatInterface/ArtifactPanel/layout legado)
  - `docs/architecture/03-DATA-ARCHITECTURE.md` + `docs/architecture/00-INDEX.md` (Dexie/InputArea como fluxo principal, hoje nao condizente)

Notes:
- Melhor ordem de limpeza: (1) remover codigo morto runtime, (2) podar deps nao usadas, (3) alinhar docs para evitar confusao de “dois mundos”.

### [2026-05-08 21:13] — Sprint limpeza fase 1 (codigo morto + deps)

Context:
- Anders autorizou iniciar a limpeza apos a auditoria ampla de resquicios.

Details:
- Removidos arquivos runtime mortos:
  - `components/chat/ExportMenu.tsx`
  - `components/chat/MessageActions.tsx`
  - `components/settings/CustomInstructions.tsx`
  - `components/settings/MemoryManager.tsx`
  - `components/settings/PromptPreview.tsx`
  - `components/ui/alert.tsx`
  - `components/ui/label.tsx`
  - `components/ui/select.tsx`
  - `components/ui/separator.tsx`
  - `hooks/queries/index.ts`
  - `hooks/useCommandPalette.ts`
  - `lib/export/artifactPdf.ts`
  - `lib/export/index.ts`
  - `lib/performance/index.ts`
  - `lib/storage/db.ts`
  - `lib/storage/settings.ts`
  - `lib/utils/tokenEstimate.ts`
- Dependencias removidas por nao uso:
  - `@tanstack/react-query-devtools`
  - `@types/diff`
  - `dexie-react-hooks`
  - `diff`
  - `radix-ui`
  - `rehype-highlight`
  - `rehype-raw`
  - `rehype-sanitize`
  - `@radix-ui/react-label`
  - `@radix-ui/react-select`
  - `@radix-ui/react-separator`
  - `dexie`
  - `html2pdf.js`
- `@types/react-syntax-highlighter` precisou ser restaurado (era necessario para tipagem de `components/chat/CodeBlock.tsx`).

Notes:
- Validacao final: `npx tsc --noEmit` e `npm run build` (OK).
- Proxima fase recomendada: alinhamento de docs (`README`, `docs/API.md`, `docs/MODELS.md`, `docs/COMPONENTS.md`, `docs/architecture/*`) ao runtime atual.

### [2026-05-08 21:28] — Fase 2: docs alinhadas ao runtime atual

Context:
- Anders pediu para seguir com a fase de alinhamento documental apos a limpeza tecnica.

Details:
- Documentacao atualizada para refletir o estado real do projeto (workspace-v2 ativo, catalogo de modelos atual, persistencia server-side JSON e contratos de API vigentes).
- Arquivos revisados/reescritos:
  - `README.md`
  - `docs/API.md`
  - `docs/MODELS.md`
  - `docs/COMPONENTS.md`
  - `docs/architecture/02-CORE-COMPONENTS.md`
  - `docs/architecture/03-DATA-ARCHITECTURE.md`
  - `docs/architecture/00-INDEX.md`
  - `docs/APACHE_INSTALL.md` (nota de backup de `data/*.json`)
- Removidas referencias legadas de shell/componentes antigos e de modelos obsoletos.

Notes:
- Validacao executada: `npx tsc --noEmit` e `npm run build` (OK).
- Restantes mencoes de termos antigos em docs sao intencionais/contextuais (ex.: comparacao com IndexedDB na arquitetura e modelo `gpt-4o-transcribe` do endpoint de transcricao).

### [2026-05-08 21:35] — Etapa 1 do plano: markdown hardening

Context:
- Anders pediu para iniciar a sequencia de implementacao pela etapa de markdown (quebras de linha, consistencia e endurecimento do render).

Details:
- `lib/formatting/chatMarkdown.ts` foi ajustado para:
  - preservar indentacao de markdown (listas/sublistas),
  - preservar linhas em branco dentro de code fences,
  - manter normalizacao de `\\n`/`/n` e headings colados sem afetar blocos de codigo.
- `components/chat/ChatMarkdown.tsx` e `components/chat/StreamingMarkdown.tsx` agora usam `skipHtml` no `react-markdown` (HTML bruto nao e processado no fluxo principal de markdown).
- `components/chat/ReasoningPanel.tsx` passou a usar `normalizeChatMarkdown` diretamente e envia conteudo ja normalizado para render.
- `components/chat/ReasoningRollingWindow.tsx` ganhou suporte a `isNormalized` para evitar normalizacao duplicada.
- `components/workspace-v2/canvas/CanvasContent.tsx` endurecido para HTML artifacts com `sandbox="allow-scripts"` (removido `allow-same-origin`) e `referrerPolicy="no-referrer"`.
- Removido wrapper legado sem uso: `lib/formatting/reasoning.ts`.
- Testes de normalizacao expandidos em `lib/formatting/chatMarkdown.test.ts` cobrindo indentacao sensivel e preservacao de linhas em branco em code fences.

Notes:
- Validacao executada: `npx vitest run lib/formatting/chatMarkdown.test.ts`, `npx tsc --noEmit`, `npm run build` (OK).
- Runtime atualizado com `systemctl restart chatgpt.service` (status `active`).

### [2026-05-08 21:51] — Etapas 2-6 executadas (scroll/UX, layout, motion, canvas contract)

Context:
- Anders pediu para "puxar todas as etapas" restantes do plano apos o hardening de markdown.

Details:
- Etapa 2 (streaming UX):
  - `components/chat/ChatContainer.tsx` recebeu indicador de atualizacao nao lida enquanto usuario esta em leitura de historico (sem puxar a rolagem).
  - Melhorias de reset de estado ao voltar para o fim da conversa.
  - `components/chat/MessageContent.tsx` agora mostra notices distintos para `interrupted`, `aborted` e `failed`.
  - `components/chat/QuickActionsBar.tsx` aplica fade-in em estados terminais (`completed`, `interrupted`, `aborted`, `failed`).
- Etapa 3 (tailwind/layout):
  - `components/workspace-v2/ConversationRailV2.tsx` consolidou classes repetidas em constantes visuais (`RAIL_*`) e adotou `data-active` nos filtros.
  - `components/workspace-v2/WorkspaceLayoutV2.tsx` consolidou classes de controles do composer (`COMPOSER_CONTROL_BUTTON_CLASS`) para consistencia visual.
- Etapa 4 (motion):
  - Primitivos `components/motion/FadeIn.tsx`, `SlideIn.tsx`, `Pop.tsx`, `Drawer.tsx` passaram a respeitar `prefers-reduced-motion`.
  - `WorkspaceLayoutV2` aplica motion intencional em sidebar, chat, composer e painel contextual.
- Etapa 5 (canvas contract):
  - Novo contrato formal em `lib/artifacts/canvasContract.ts` (`viewer-only`, versao `2026-05-viewer-only`).
  - `components/workspace-v2/canvas/CanvasContent.tsx` exibe aviso de contrato e hint de persistencia.
  - `components/workspace-v2/canvas/CanvasOverlayV2.tsx` e `components/workspace-v2/ContextPanelV2.tsx` exibem badge do modo `viewer-only`.
  - `docs/COMPONENTS.md` atualizado com a secao do contrato do Canvas.
- Testes adicionados/ajustados:
  - `lib/artifacts/canvasContract.test.ts` (novo)
  - `lib/chat/scrollState.test.ts` (novo caso para leitura de historico)

Notes:
- Validacao final: `npx vitest run lib/formatting/chatMarkdown.test.ts lib/chat/scrollState.test.ts lib/artifacts/canvasContract.test.ts`, `npx tsc --noEmit`, `npm run build`, `npm run lint` (OK).
- Runtime atualizado: `systemctl restart chatgpt.service` + `systemctl is-active` => `active`.

### [2026-05-08 23:30] — Modal A4 maior e responsivo

Context:
- Anders percebeu que o modal de “Visualizar A4” na sidebar estava com largura parecida com mobile mesmo no desktop.

Details:
- `components/artifacts/DocumentPreviewModal.tsx`: dialog ficou sem moldura (bg transparente, sem sombra/borda), header ganhou gradiente claro/escuro com bordas arredondadas; limites de largura maiores (`1500/1800px`) e clamps do contêiner/página A4 mais largos (~1500/1360px), mantendo proporção 210/297 sem estreitar em desktop.

Notes:
- Validação: `npx tsc --noEmit` (OK).

### [2026-05-08 22:02] — Preview A4 em modal + acoes PDF/impressao para documentos

Context:
- Anders pediu que, ao visualizar documento, abrisse um modal central com proporcao A4 e acoes diretas para exportar PDF/imprimir.

Details:
- Novo componente `components/artifacts/DocumentPreviewModal.tsx`:
  - modal central em proporcao A4,
  - visual de documento mantido com `DocumentCanvas`,
  - acoes por icone: exportar PDF (via dialogo de impressao), imprimir, baixar fonte, abrir no painel e fechar.
- Novo util `lib/export/documentPrint.ts`:
  - abre janela de impressao A4,
  - reaproveita estilos atuais (inject de `style/link` do app) para manter aparencia proxima,
  - suporta fluxo de “Salvar como PDF” no dialogo do navegador.
- `components/chat/MessageArtifactCard.tsx`:
  - CTA do documento mudou para `Visualizar A4`.
- `components/chat/MessageContent.tsx`:
  - integra abertura do novo modal para artefatos de documento,
  - mantém abertura de quiz no painel atual.
- `components/workspace-v2/canvas/CanvasContent.tsx`:
  - ganhou acao `Visualizar A4` (markdown e html) reutilizando o mesmo modal.
- Teste ajustado para novo CTA: `components/chat/MessageContent.test.tsx`.

Notes:
- Validacao executada: `npx vitest run components/chat/MessageContent.test.tsx lib/artifacts/canvasContract.test.ts lib/chat/scrollState.test.ts lib/formatting/chatMarkdown.test.ts`, `npx tsc --noEmit`, `npm run lint`, `npm run build` (OK).
- Runtime atualizado: `systemctl restart chatgpt.service` + `systemctl is-active` => `active`.

### [2026-05-08 23:55] — A4 modal: largura destravada no papel interno

Context:
- Anders reportou que o modal ainda parecia estreito mesmo após ampliar o `Dialog`.

Details:
- Causa real identificada em `DocumentCanvas`: o papel interno tinha `max-w-[760px]`, o que limitava a largura visual dentro do modal.
- `components/artifacts/DocumentPreviewModal.tsx` atualizado para sobrescrever no uso de preview:
  - `className="... max-w-none ..."` no container do `DocumentCanvas`
  - `pageClassName="h-full max-w-none ..."` no papel interno
- Efeito: a folha A4 passa a ocupar a largura disponível do preview (respeitando proporção), sem ficar presa ao limite de 760px.

Notes:
- Validação executada: `npx tsc --noEmit`, `npm run build` (OK).
- Runtime atualizado: `systemctl restart chatgpt.service` + `systemctl is-active` => `active`.

### [2026-05-08 22:28] — Paleta Clinico Premium aplicada

Context:
- Anders pediu uma passada estetica focada em paleta claro/escuro, background moderno/dinamico e contraste de fontes sem trocar a tipografia.

Details:
- Direcao escolhida: `Clinico Premium`, mantendo `Space Grotesk` e `JetBrains Mono`.
- `app/globals.css` recebeu nova paleta OKLCH para tokens shadcn e `--gc-*`, fundo dinamico sutil com `.gc-dynamic-bg`, `.gc-ambient-overlay`, `.gc-subtle-grid`, e respeito a `prefers-reduced-motion`.
- Componentes harmonizados para usar `primary`, `accent` e tokens `--gc-*`: workspace shell, rail, composer, contexto, canvas, cards de artefato, reasoning, markdown, login, splash, manifesto PWA, Monaco e quiz.
- Cores semanticas de erro/sucesso foram preservadas quando comunicam estado; branco real de documento/A4 foi mantido para leitura/exportacao.

Notes:
- Validacao executada: `npx tsc --noEmit`, `npm run build`, `npm run lint`, `npm test` (OK; 32 arquivos/94 testes).
- Runtime atualizado: `systemctl restart chatgpt.service`; health OK em `http://127.0.0.1:3040/chat/api/health`.
- QA visual via Playwright Chromium em `/chat`: desktop light, desktop dark e mobile dark, sem overlay Next.js e sem console warnings/errors relevantes. Screenshots temporarios: `/tmp/gaucho-clinical-final-desktop-light.png`, `/tmp/gaucho-clinical-final-desktop-dark.png`, `/tmp/gaucho-clinical-final-mobile-dark.png`.

### [2026-05-08 22:07] — PDF direto no modal A4 (sem depender do dialogo de impressao)

Context:
- Anders aprovou evoluir o botao de PDF do modal A4 para exportacao direta de arquivo, mantendo imprimir como acao separada.

Details:
- Novo util `lib/export/documentPdf.ts`:
  - captura visual do documento em A4 via `html2canvas`,
  - pagina o conteudo em multiplas paginas A4 no `jsPDF`,
  - salva o arquivo PDF diretamente com nome sanitizado.
- `components/artifacts/DocumentPreviewModal.tsx`:
  - botao `Exportar PDF` agora chama exportacao direta (`downloadDocumentArtifactPdf`),
  - botao `Imprimir` permanece usando `openA4PrintWindow`.
- Dependencia adicionada em runtime para suportar rasterizacao HTML:
  - `html2canvas@1.4.1`.

Notes:
- Validacao executada: `npx vitest run components/chat/MessageContent.test.tsx lib/artifacts/canvasContract.test.ts lib/chat/scrollState.test.ts lib/formatting/chatMarkdown.test.ts`, `npx tsc --noEmit`, `npm run lint`, `npm run build` (OK).
- Runtime atualizado: `systemctl restart chatgpt.service` + `systemctl is-active` => `active`.

### [2026-05-09 15:49] — Canvas removido da sidebar; preview unificado via Sheet animado

Context:
- Anders pediu para remover a aba Canvas da sidebar direita e unificar toda visualização de documentos/quizzes em um preview sheet que desliza de baixo pra cima (mesma animação do mobile) em todas as larguras, contido na coluna de chat.

Details:
- **Novo componente**: `components/workspace-v2/canvas/ArtifactPreviewSheet.tsx` — preview sheet com framer-motion (`y: "100%"` → `y: 0`), overlay escuro, conteúdo A4 com ações (PDF, imprimir, baixar fonte, fechar). Renderiza dentro de `ChatCanvasV2` com `AnimatePresence`, naturalmente contido na largura da coluna de chat (`max-w-3xl lg:max-w-5xl`).
- **ChatCanvasV2.tsx**: container ganhou `relative overflow-hidden`; renderiza `ArtifactPreviewSheet` quando `artifactOpen && activeArtifact`.
- **ContextPanelV2.tsx**: aba Canvas e conteúdo relacionado removidos (TabsTrigger, TabsContent, EmptyArtifactState, badge Canvas, botões copy/download). Mantém apenas Atividade e Notas.
- **uiStore.ts**: `openArtifact()` não troca mais `activePanelTab` (não existe mais aba "artifact").
- **types/index.ts**: `ActivePanelTab` reduzido a `"activity" | "notes"`.
- **MessageContent.tsx**: removida importação e uso de `DocumentPreviewModal`; todos os botões ("Visualizar A4", "Abrir Canvas", "Abrir no painel") agora chamam `openArtifact()` que aciona o preview sheet unificado.
- **GauchoChatShellV2.tsx**: removido `CanvasOverlayV2` (import, JSX e lógica de auto-abertura `shouldAutoShowContextPanel`); removido `closeArtifact()` do handler de fechamento do Sheet mobile.
- **Deletado**: `components/workspace-v2/canvas/CanvasOverlayV2.tsx`.
- **Código morto resultante** (sem consumidores ativos): `CanvasContent.tsx`, `DocumentPreviewModal.tsx` — mantidos por ora, não causam erro de build.

Notes:
- Validação: `npx tsc --noEmit` limpo, `npm run build` OK, 94/94 testes passando.
- Runtime: `systemctl restart chatgpt.service` + `systemctl is-active` => `active`.
- O preview sheet agora é o ponto único de visualização de artefatos (documentos e quizzes) — sem duplicação entre Dialog, Sheet mobile e aba Canvas.

### [2026-05-09 17:45] — Ajuste fino do preview sheet para iPhone e overflow horizontal

Context:
- Anders reportou que o novo preview sheet ainda estava com scroll horizontal e com o frame do documento sendo cortado em resolução de iPhone.

Details:
- `components/workspace-v2/canvas/ArtifactPreviewSheet.tsx` ajustado para:
  - usar o mesmo envelope horizontal da coluna de chat (`mx-auto w-full max-w-3xl px-3 md:px-4 lg:max-w-5xl`), em vez de encostar o sheet nas bordas do viewport;
  - header responsivo com `flex-col` em telas estreitas e badges com wrap, evitando overflow causado por título + chips + toolbar;
  - `overflow-y-auto overflow-x-hidden` no corpo;
  - frame A4 simplificado para `w-full max-w-[760px]`, removendo clamp agressivo que ainda podia estourar em mobile;
  - `pointer-events-none` no wrapper animado e `pointer-events-auto` no sheet visual;
  - `ChatCanvasV2` sem `overflow-hidden`, evitando corte do topo do sheet em viewport menor.

Notes:
- Validação: `npx tsc --noEmit`, `npm run build`, `npm test` (94/94) e restart do `chatgpt.service` OK.

### [2026-05-09 18:00] — Bordas inferiores arredondadas + wrap horizontal endurecido

Context:
- Anders pediu só um polimento visual final: deixar as bordas inferiores do preview sheet arredondadas como as superiores e impedir deslize horizontal do texto.

Details:
- `components/workspace-v2/canvas/ArtifactPreviewSheet.tsx`:
  - container principal do sheet mudou de `rounded-t-2xl border-b-0` para `rounded-2xl`;
  - áreas roláveis ganharam `touch-pan-y` e `overflow-x-hidden`;
  - `ChatMarkdown` no preview passou a usar `break-words` + `[overflow-wrap:anywhere]`.
- `components/chat/ChatMarkdown.tsx`:
  - wrapper base endurecido com `overflow-x-hidden break-words [overflow-wrap:anywhere]`.

Notes:
- Validação: `npx tsc --noEmit`, `npm run build`, restart do `chatgpt.service` OK.

### [2026-05-09 18:05] — Preview sheet mais alto, com respiro superior mínimo

Context:
- Anders pediu um último ajuste para o modal ocupar mais altura, deixando apenas uma margem superior parecida com a lateral.

Details:
- `components/workspace-v2/canvas/ArtifactPreviewSheet.tsx`:
  - `max-h-[85dvh]` trocado por `max-h-[calc(100dvh-0.75rem)] md:max-h-[calc(100dvh-1rem)]`, alinhando o respiro do topo com o padding lateral do envelope do chat.

Notes:
- Validação: `npx tsc --noEmit` e restart do `chatgpt.service` OK.

### [2026-05-09 18:10] — Respiro inferior do preview sheet alinhado ao superior

Context:
- Anders corrigiu que o ajuste de margem desejado era na parte inferior do preview, não na superior.

Details:
- `components/workspace-v2/canvas/ArtifactPreviewSheet.tsx`:
  - wrapper animado mudou de `bottom-0` para `bottom-3 md:bottom-4`;
  - altura máxima recalculada para manter respiro equivalente em cima e embaixo: `calc(100dvh-1.5rem)` e `md:calc(100dvh-2rem)`.

Notes:
- Validação: `npx tsc --noEmit` e restart do `chatgpt.service` OK.

### 2026-05-09 19:30 - Atualizacao do catalogo de modelos + sistema de tracking de custos

Context:
Anders pediu para atualizar o catalogo de modelos e implementar um contador de gastos (tokens/custo) visivel abaixo do input do chat.

Details:
**Catalogo de modelos** (`lib/models/modelConfig.ts`):
- Removido `gpt-5.5` ($5.0 input) — substituido por `gpt-5.4` ($3.75 input)
- `chat-latest` → `gpt-5.1-chat-latest` ($1.75 input) como novo modelo padrao
- Adicionado `gpt-5.4-nano` ($0.04 input) para tarefas ultra-economicas
- `gpt-image-2.0` → `gpt-image-2` (renomeado)
- `DEFAULT_MODEL` atualizado em `stores/settingsStore.ts` e `app/api/chat/route.ts`
- `QUIZ_FORCED_MODEL` trocado para `gpt-5.4`
- Testes atualizados (`WorkspaceLayoutV2.test.tsx`)

**Sistema de tracking de custos**:
- `lib/chat/streamMachine.ts`: adicionado evento `response.completed` com captura de `usage` (input_tokens, output_tokens, cached_tokens, reasoning_tokens)
- `types/index.ts`: campos `inputTokens`, `outputTokens`, `cachedTokens`, `reasoningTokens` no `Message`
- `stores/costStore.ts`: store Zustand que acumula tokens de mensagens assistant e calcula custo via `calculateCost()`
- `hooks/useCostSync.ts`: hook que recalcula custos automaticamente quando mensagens ou modelo mudam
- `components/chat/CostCounter.tsx`: chip discreto verde com icone Coins mostrando custo formatado
- `WorkspaceLayoutV2.tsx`: prop `costControl` injetada na toolbar do composer (lado direito, antes do botao enviar)
- `CommandComposerContainerV2.tsx`: injeta `<CostCounter />` como `costControl`
- `GauchoChatShellV2.tsx`: ativa `useCostSync()` para sincronizacao automatica

Notes:
- Validacao: `npx tsc --noEmit` ✅, `npx vitest run` 94/94 ✅
- O contador so aparece quando ha tokens acumulados (totalTokens > 0)
- O chip usa cores emerald e mostra tooltip com total de tokens

### [2026-05-10 13:27] — Preview sheet com menos respiro inferior

Context:
- Anders pediu um ajuste fino no modal de preview aberto por "Abrir no painel", porque a área inferior estava com margem/padding excessivo e roubando espaço útil.

Details:
- `components/workspace-v2/canvas/ArtifactPreviewSheet.tsx`:
  - wrapper animado ancorado no fundo sem gap (`bottom-0`, mantendo `md:bottom-2` no desktop);
  - `max-h` aumentado para ocupar mais viewport (`calc(100dvh-0.5rem)` e `md:calc(100dvh-1rem)`);
  - padding inferior interno reduzido para `pb-[calc(0.5rem+env(safe-area-inset-bottom))]`.

Notes:
- Validação: `npx tsc --noEmit` ✅.

### [2026-05-10 13:28] — Rebuild e restart do serviço em produção

Context:
- Anders pediu para executar rebuild do projeto e reiniciar o serviço systemd após o ajuste de layout.

Details:
- Build executado com sucesso: `npm run build` (Next.js 16.1.6, compilação e geração de páginas concluídas sem erro).
- Serviço reiniciado: `systemctl restart chatgpt.service`.
- Saúde pós-restart validada com:
  - `systemctl is-active chatgpt.service` → `active`
  - `systemctl status chatgpt.service --no-pager`
  - `journalctl -u chatgpt.service -n 30 --no-pager`

Notes:
- Serviço subiu normalmente com novo `Main PID` e sem erro nos logs recentes.

### [2026-05-10 13:32] — Redução de margem superior no card A4 do preview

Context:
- Anders apontou especificamente a `div` do card A4 dentro do `ArtifactPreviewSheet` ainda com respiro vertical excessivo.

Details:
- `components/workspace-v2/canvas/ArtifactPreviewSheet.tsx`:
  - classes do card A4 (HTML e markdown) ajustadas de `mt-3` para `mt-1`, reduzindo o espaço morto acima do documento.

Notes:
- Validação: `npx tsc --noEmit` ✅.

### [2026-05-10 13:36] — Padronização visual do ArtifactPreviewSheet

Context:
- Anders pediu revisão mais ampla das formas de formatação do modal aberto por "Abrir no painel", buscando a melhor representação visual para documento e quiz.

Details:
- `components/workspace-v2/canvas/ArtifactPreviewSheet.tsx`:
  - criado `A4_PAGE_FRAME_CLASS` para unificar o frame A4 usado por HTML e markdown;
  - criado `ACTION_BUTTON_CLASS` para padronizar botões do header;
  - header compactado levemente (`py-2.5` mobile, `md:py-3`);
  - corpo do modal passou a ter padding único (`px-2/px-4`, `pt-2/pt-3`, safe-area bottom);
  - removidas margens locais do card A4 (`mt-*`) e espaçamento extra do quiz (`py-3`);
  - quiz agora usa envelope `max-w-5xl` e `DocumentCanvas` mais justo (`p-2 md:p-3`);
  - markdown A4 recebeu padding interno mais equilibrado (`px-4 py-5 md:px-7 md:py-7`).

Notes:
- Validação: `npx tsc --noEmit` ✅.

### [2026-05-10 13:40] — Rebuild e restart após padronização do preview

Context:
- Anders pediu para publicar a revisão visual do `ArtifactPreviewSheet` no serviço.

Details:
- `npm run build` executado com sucesso (Next.js 16.1.6, build e TypeScript OK).
- `chatgpt.service` reiniciado via systemd.
- Pós-restart validado com `systemctl is-active`, `systemctl status` e `journalctl -u chatgpt.service -n 30 --no-pager`.

Notes:
- Serviço ativo com novo `Main PID`; logs recentes sem erro.

### [2026-05-11 01:12] — PDF do modo visualização sem corte por áreas roláveis

Context:
- Anders pediu revisão da lógica de geração de PDF ao clicar no botão de exportação dentro do modo de visualização do documento.

Details:
- `lib/export/documentPdf.ts` recebeu normalização de layout antes da captura (`html2canvas`):
  - novo helper `relaxScrollableLayout` para remover clipping de `overflow` (`auto/scroll/hidden/clip`) em nós clonados;
  - remoção de restrições de altura (`height/max-height`) quando detectado conteúdo rolável;
  - clone do `sourceElement` agora entra com `width:100%`, `height:auto`, `max-height:none` e `overflow:visible`.
- Objetivo: evitar exportação truncada quando o preview usa containers com `h-full` + `overflow-y-auto` (caso típico do `ArtifactPreviewSheet`/`DocumentPreviewModal`).

Notes:
- Validação executada: `npx tsc --noEmit`, `npm run build`, `npm test` — tudo OK.

### [2026-05-11 01:31] — Auditoria com subagentes para “deixar mais redondo”

Context:
- Anders pediu um pente-fino usando agentes para identificar correções de maior impacto no projeto.

Details:
- Três auditorias paralelas focaram em: UX/frontend, pipeline markdown/reasoning, e robustez API/stream/persistência.
- Achados de maior impacto:
  - `sendMessage` retorna `true` mesmo em erro (`hooks/useChat.ts`), podendo limpar composer após falha.
  - limpeza de citação (`cleanCitationMarkers`) remove padrões `[n]` genéricos e pode corromper conteúdo válido.
  - normalização de markdown (`/n`, `\\n`) é agressiva e combinada com `remark-breaks` pode degradar formatação.
  - acoplamento por `querySelector("textarea")` + eventos globais `gaucho:*` pode atingir textarea errado.
  - parse de URL em citação sem proteção (`new URL(cite.url)`) pode quebrar render em URL malformada.

Notes:
- Próxima ação recomendada: corrigir primeiro o contrato de retorno do `sendMessage` (alto impacto, baixo esforço) antes dos ajustes de markdown.

### [2026-05-11 01:34] — Contrato de sucesso do sendMessage corrigido

Context:
- Anders aprovou seguir com a primeira correção priorizada da auditoria: evitar limpar o composer quando o envio falha.

Details:
- `hooks/useChat.ts` (`sendMessage`) agora usa flag `sent` em vez de retornar `true` incondicionalmente.
- Fluxo novo:
  - sucesso real do envio -> `sent = true`;
  - abort do usuário (`AbortError`) -> `sent = true` (mantém UX atual de envio já iniciado);
  - falha de API/erro inesperado -> `sent = false`.
- Efeito direto no composer: `CommandComposerContainerV2` só limpa input/anexos quando `sendMessage` retorna `true`.

Notes:
- Validação executada: `npx tsc --noEmit`, `npm test`, `npm run build` — tudo OK.

### 2026-05-21 11:47 - TTS via Web Audio para contornar autoplay/CSP

Context:
Anders relatou que o TTS das mensagens do assistente e o laboratório Realtime mini falhavam no navegador com erro de áudio, apesar de `/api/tts` gerar áudio.

Details:
`lib/tts/browserAudio.ts` passou a desbloquear também `AudioContext`, tocar o prime silencioso sem `muted` e evitar que o prime pause o áudio real se resolver atrasado. `hooks/useAssistantTts.ts` agora decodifica os blobs MP3 com `AudioContext.decodeAudioData` e toca por Web Audio quando disponível, mantendo `<audio>` apenas como fallback. `hooks/useRealtimeTtsLab.ts` conecta o stream WebRTC ao destino do `AudioContext` antes de cair para `<audio>`. `proxy.ts` adicionou `media-src 'self' blob: data:` e `wss:` no CSP do app.

Notes:
Validação executada: `npx tsc --noEmit`, `npm test`, `npm run build`, `systemctl restart chatgpt.service`, health local e publico OK. A tentativa de alterar o CSP global do Apache em `/etc/apache2/sites-available/ultrassom.ai-optimized.conf` falhou por permissão do ambiente; por isso o caminho principal evita depender de `blob:` em `<audio>`.

### 2026-05-21 11:51 - CSP global do Apache liberado para audio blob

Context:
Após notar que o vhost Apache estava com atributo immutable, Anders orientou remover temporariamente o immutable para aplicar o CSP correto.

Details:
`/etc/apache2/sites-available/ultrassom.ai-optimized.conf` teve `media-src 'self' blob: data: https:` adicionado ao `Content-Security-Policy` global. `/etc/apache2/APACHE.md` foi atualizado para refletir a regra. O atributo immutable foi removido com `chattr -i`, o Apache foi validado e recarregado, e o immutable foi restaurado com `chattr +i`.

Notes:
Validação: `apachectl configtest` retornou `Syntax OK`; `systemctl reload apache2` OK; `curl -fsSI https://ultrassom.ai/chat/api/health` mostrou HTTP 200 e o header global `Content-Security-Policy` já inclui `media-src 'self' blob: data: https:`.

### [2026-05-11 01:37] — Modo documento com fundamento de deep research

Context:
- Anders pediu para o modo `document` enviar com um prompt-base de estilo deep research, preservando explicitamente o estilo de escrita definido no prompt principal/custom.

Details:
- `hooks/useChat.ts` (`appendDocumentModeInstructions`) foi expandido com dois blocos novos:
  - `Deep Research Foundation`: orienta cadeia analítica (`scope -> assumptions -> method -> findings -> synthesis -> conclusion`), separação de fatos/inferências/recomendações, tradeoffs/incerteza e proibição de inventar fontes.
  - `Style Anchor (Must Preserve)`: fixa que voz/tom/estilo do prompt base + custom instructions continuam sendo a fonte de verdade.
- `Clinical Report Style` foi mantido e segue condicional por `isClinicalReportRequest(content)`.

Notes:
- Validação executada: `npx tsc --noEmit`, `npm test`, `npm run build` — tudo OK.

### 2026-06-05 16:15 - Realtime TTS: payload GA corrigido (session/output)

Context:
Erro real em `/api/realtime/tts-call`: OpenAI retornando `Unknown parameter: 'session.modalities'` ao iniciar chamadas Realtime.

Details:
`app/api/realtime/tts-call/route.ts` voltou ao shape GA aceito pela `/v1/realtime/calls`: `type: "realtime"`, `output_modalities: ["audio"]` e `audio.output.voice` (em vez de `modalities` na raiz e `voice` direto). `hooks/useRealtimeTtsLab.ts` alinhado para enviar `output_modalities` também no evento `response.create` pelo data channel. `app/api/realtime/tts-call/route.test.ts` atualizado para validar o contrato novo (`output_modalities` + `audio.output.voice`).

Notes:
Validação desta rodada: `npm test -- app/api/realtime/tts-call/route.test.ts`, `npx tsc --noEmit`, `npm test`, `npm run build` — tudo OK.

### 2026-06-05 16:22 - Realtime mini validado em runtime (local/public)

Context:
Mesmo após o hotfix do payload GA, Anders reportou que o fluxo ainda parecia falhar.

Details:
Foi feito diagnóstico no serviço em execução: `chatgpt.service` ativo, restart aplicado e health local/público OK. Sondas autenticadas em `http://127.0.0.1:3040/chat/api/realtime/tts-call` e `https://ultrassom.ai/chat/api/realtime/tts-call` não reproduziram `session.modalities`; ambas retornaram erro esperado de SDP inválido (`invalid_offer`) quando o offer era fake. Smoke real com browser headless (Chrome do host) clicando `Realtime mini` no app público retornou `201` com SDP answer, confirmando que o backend ativo está no shape GA (`output_modalities` + `audio.output.voice`).

Notes:
Se o usuário ainda vir erro antigo no navegador, priorizar hard reload/aba nova e inspeção de Network em `/chat/api/realtime/tts-call` para capturar a resposta atual (não confiar em mensagem cacheada de tentativa anterior).

### 2026-06-05 16:28 - Catchers de log para falhas do Realtime mini

Context:
Anders pediu endurecer o fluxo de logs do Realtime TTS porque algumas falhas não estavam aparecendo de forma útil durante o uso no navegador.

Details:
`app/api/realtime/tts-call/route.ts` agora normaliza erro upstream (`error.message`), inclui `diagnosticId` em respostas de erro e registra `status`, `x-request-id` da OpenAI e body truncado no log do servidor. Foi criada a rota autenticada `POST /api/realtime/tts-call/log` em `app/api/realtime/tts-call/log/route.ts` para receber logs do cliente (event/message/details) e escrever em log server-side. `hooks/useRealtimeTtsLab.ts` passou a reportar eventos críticos: `icecandidateerror`, erro/close do data channel, parse error de eventos do servidor, `response.error`, erro de playback, `response !ok` da rota e catch final de start. Também foi incluído contexto de `diagnosticId/openaiRequestId` quando a rota retorna não-OK.

Notes:
Validação desta rodada: `npm test -- app/api/realtime/tts-call/route.test.ts app/api/realtime/tts-call/log/route.test.ts`, `npm test`, `npx tsc --noEmit`, `npm run build`, `systemctl restart chatgpt.service` e smoke autenticado em `/chat/api/realtime/tts-call/log` retornando `200 {"ok":true}` com entrada visível em `/var/log/chatgpt/error.log`.

### 2026-06-05 16:42 - Realtime restaurado ao core pré-Agenda com logs preservados

Context:
Anders pediu comparar com o estado anterior à frente Google Agenda/Notas e restaurar o Realtime mini mantendo os catchers de log.

Details:
O commit pré-Agenda relevante é `d2b2ec4` (2026-05-31). O core atual foi mantido alinhado a esse snapshot: sessão `/v1/realtime/calls` com `type: "realtime"`, `output_modalities: ["audio"]` e `audio.output.voice`; `response.create` no data channel também usa `output_modalities`. Os logs client→server foram preservados e ajustados para sempre aparecerem em `/var/log/chatgpt/error.log`. `hooks/useRealtimeTtsLab.ts` agora registra `settings.applied` sem vazar o texto das instruções: loga `voice`, `realtimeVoice`, `model`, `speed`, `mode`, presença/tamanho das instruções e quais campos são efetivamente aplicados ao Realtime.

Notes:
Smoke browser público confirmou `/chat/api/realtime/tts-call` retornando `201`, logs `settings.applied`, `peer.connection_state: connected` e `track.unmuted`. Exemplo observado: `voice=cedar`, `speed=1.2`, `mode=turbo`, instruções presentes; no Realtime só `voice` e `instructions` são aplicados, enquanto `speed/mode/model` pertencem ao TTS MP3 (`gpt-4o-mini-tts`). Validação: testes focados Realtime, `npx tsc --noEmit`, `npm test`, `npm run build`, restart do serviço e health local OK.

### 2026-06-05 16:50 - Realtime mini ganhou mini-player visível

Context:
Anders identificou que o botão Realtime mini apenas ativava a sessão, diferente do TTS MP3 que abre um player com controle visual; isso deixava o fluxo sem feedback de playback.

Details:
`components/chat/QuickActionsBar.tsx` agora separa o painel Realtime do `tts.isOpen`: clicar direto em Realtime abre um mini-player próprio com botão `Tocar/Parar Realtime` e status claro (`Conectando`, `Sessão pronta`, `Recebendo áudio ao vivo`, `Leitura concluída`, erro). O painel MP3 continua igual quando aberto. `hooks/useRealtimeTtsLab.ts` também recebeu correção de race: `datachannel.open` não sobrescreve mais `speaking`, e o primeiro áudio agora registra `audio.started` com latência.

Notes:
Smoke browser público após rebuild/restart confirmou `/chat/api/realtime/tts-call` `201` e UI mostrando `Recebendo áudio ao vivo · 1º áudio 514ms`. Validação: `npx tsc --noEmit`, testes focados Realtime, `npm run build`, `systemctl restart chatgpt.service` e health local OK.
