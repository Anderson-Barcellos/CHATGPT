# Descobrir IA: controle, TTS e Studio

## Entrevista e aprovação

Anders pediu controle para pausar a curadoria, TTS Grok nas matérias e retorno dos atalhos do Studio. Ao consultar a pausa, corrigiu a frequência para a cada dois dias. Horário preservado: 08h America/Sao_Paulo. Pausa até reativação, execução já iniciada pode terminar e busca manual não altera calendário.

### 1.1 Aprovação vinculante

Em 2026-10-07: “Implement the proposed plan.” Autorizou também integração local na main ao final; push e publicação separados. Não incorporar silenciosamente frentes incompletas de desktop/migração.

## Objetivo e limites

Pausar a atualização automática, ouvir matérias via TTS Orion e abrir Studio pela navegação. Preservar SoundCase, conteúdos, capas, assuntos, auth, Studio e ajustes pendentes. Fora: redesign, outras vozes, Realtime no feed, edição do Studio, deploy e push.

## Agendamento visível

Objetivo: interruptor persistente e próxima execução prevista acima do feed. Escopo: lib/discover/{types,store,runner,schedule}.ts, app/api/discover/{route,settings/route}.ts, testes e components/discover. Contrato: DiscoverState.schedule.enabled (default true legado); GET inclui schedule e nextScheduledAt; PUT settings aceita {enabled:boolean}, responde {schedule,nextScheduledAt}. Intervalo fixo dois dias civis, 08h São Paulo, baseado em lastDailyDate; sem histórico ou vencido, próxima passagem das 08h. Timer diário apenas verifica; claim sob lock retorna paused antes de curadoria. Manual não altera calendário. Falha não dispara repetição paga. Preservar feed e demais campos em gravações concorrentes. Dependências: store e auth atuais. Testes internos: legado, datas, pausa, concorrência e validação HTTP. Externo: pausar/recarregar/reativar e status previsível no browser.

## TTS por matéria

Objetivo: Ouvir matéria abre player sem geração automática; Tocar narra título e conteúdo sem resumo duplicado/fontes. Escopo: components/discover, components/chat/MiniAudioPlayer.tsx e testes. Contrato: allowRealtime opcional default true; feed usa false e ID estável discover-ID. Apenas um player aberto; trocar/fechar/sair cancela pendências; recolher texto não interrompe. Preservar Chat/Pulse/SoundCase, cache e controles atuais. Dependência: hook TTS existente. Testes internos: conteúdo, ausência de Realtime, geração somente ao tocar; externo: player com áudio sintético, erro e troca.

## Acesso ao Studio

Objetivo: restaurar links. Escopo: components/navigation/ProductNav, components/workspace-v2/ConversationRailV2, components/command/CommandPalette e testes. Contrato: /studio com basePath /chat, todos os produtos continuam visíveis. Preservar auth e workspace real. Independente do backend do feed. Evidência: links compactos/expandidos, teclado e navegação com mocks.

## Integração e evidências

Worktree /root/.cache/gaucho-discover-controls-20261007, branch codex/discover-controls-20261007, base 3613d7b. Preservar/capturar correção Lexend já publicada da worktree anterior. Responsabilidade backend delegável; frontend/navegação delegável; principal integra e cuida dos documentos, Git, dependências e gates pesados. Registro técnico: docs/plans/2026-10-07-descobrir-controles-tts-studio-report.md.

Gates no conjunto estabilizado: npm test, npx tsc --noEmit, npm run lint, NEXT_PUBLIC_BASE_PATH=/chat npm run build, git diff --check. Build fora da produção. Browser plugin ausente: Playwright instalado, QA isolado com dados/auth sintéticos e GAUCHO_ISOLATED_RUNTIME=true, desktop/320/390, claro/escuro, erros, overflow e teclado. Não há suíte Playwright configurada; criar smoke específico. Studio real desabilitado no QA: simular APIs, nunca tocar projetos reais. Atualizar docs/API.md, docs/INFRASTRUCTURE.md, BACKLOG.md e diário. Parar parte dependente diante de gate bloqueado, contrato incompatível ou integração de frente incompleta não resolvível com segurança.
