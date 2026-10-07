# Interface — controles do Descobrir IA, TTS e Studio

Data: 2026-10-07

Resultado observável: o feed mostra uma faixa compacta para pausar ou reativar a curadoria automática, com frequência e previsão; cada matéria pode abrir um único player TTS Orion sob demanda; e Studio voltou às navegações de produto, rail compacto/expandido e paleta sem retirar Chat, Descobrir IA ou SoundCase.

## Arquivos sob responsabilidade

- `components/discover/DiscoverPage.tsx` e `DiscoverPage.test.tsx`: faixa de agendamento, sincronização contra GET antigo, player por artigo e escopo `gc-chat-ui` para Lexend.
- `components/chat/MiniAudioPlayer.tsx` e teste: prop opcional `allowRealtime`, verdadeira por padrão e falsa no feed.
- `components/navigation/ProductNav.tsx` e teste; `components/workspace-v2/ConversationRailV2.tsx` e teste; `components/command/CommandPalette.tsx` e teste: atalhos restaurados do Studio preservando os demais produtos.

## DECISÃO

O player recebe sempre `title + "\\n\\n" + content`, com `messageId` estável `discover-${article.id}` e `allowRealtime={false}`. Assim, abrir o player não chama provider, tocar continua sendo o único gatilho da geração, e trocar/fechar/desmontar mantém o cleanup já centralizado nos hooks do player. A escolha foi validada pela montagem mockada de um único player, conteúdo sem resumo/fontes e pelo teste unitário que confirma a ausência do seletor Realtime.

O estado recebido por GET só é aplicado quando a versão de mutação ainda coincide. O PUT da faixa preserva o estado visível até a confirmação e atualiza apenas `schedule` e `nextScheduledAt`; por isso uma resposta GET disparada antes do PUT não reativa visualmente uma agenda já pausada. Validado com leitura atrasada no teste do feed.

O Studio permanece acessível no `ProductNav` compacto também em 320/390 px, pois a entrega pede o atalho no header do feed. Rail e paleta mantêm os atalhos existentes e recebem Studio como entrada adicional.

## Validação local

- `npx vitest run components/discover/DiscoverPage.test.tsx components/chat/MiniAudioPlayer.test.tsx components/navigation/ProductNav.test.tsx components/workspace-v2/ConversationRailV2.test.tsx components/workspace-v2/ConversationRailV2.navigation.test.tsx components/workspace-v2/ConversationRailV2.soundcase.test.tsx components/command/CommandPalette.test.tsx` — código de saída 0; 7 arquivos, 15 testes aprovados, 0 falhas, 0 skips.
- Após adicionar o nome acessível do atalho compacto do Studio: `npx vitest run components/navigation/ProductNav.test.tsx components/discover/DiscoverPage.test.tsx components/command/CommandPalette.test.tsx` — código de saída 0; 3 arquivos, 8 testes aprovados, 0 falhas, 0 skips.
- `git diff --check` — código de saída 0.

Não rodei os gates completos, build nem navegador: são integração e QA pesado coordenados pelo orquestrador nesta worktree. Não houve remoção de imports, componentes ou comportamentos; o player e os links foram estendidos de forma aditiva.
