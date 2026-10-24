# Relatório — catálogo e UI Claude no chat

**Resultado observável:** o seletor do chat agora oferece Claude Sonnet 5.5 e Claude Opus 5.5. Astra e Gemini permanecem no catálogo compartilhado, mas não aparecem nas novas escolhas do chat. Preferências antigas do chat para esses modelos resolvem para GPT-6 Luna com reasoning `medium`; Studio, Pulse e históricos não foram alterados.

No modo Documento, Claude mostra o perfil efetivo `GPT-6 Luna` com `Raciocínio médio`, bloqueia esse ajuste para evitar uma configuração enganosa e preserva a preferência Claude original para o próximo chat padrão. Imagens continuam anexáveis no composer e a sugestão inicial de gerar imagem deixa de aparecer para Claude; análise de imagem permanece disponível. Temperatura, verbosity, Code Interpreter e Pro não são oferecidos para Claude pelas capacidades do catálogo.

## Arquivos sob responsabilidade

- `types/index.ts`: família `anthropic`.
- `lib/models/modelConfig.ts`: modelos Claude, capacidades, limites, preços e `isAnthropicModel`.
- `stores/settingsStore.ts`: fallback exclusivo das preferências do chat e clamp de Code Interpreter incompatível.
- `lib/chat/documentConfig.ts`: fallback Documento Claude para Luna `medium`.
- `components/workspace-v2/CommandComposerContainerV2.tsx`: exibição e bloqueio do perfil efetivo em Documento.
- `components/chat/ChatContainer.tsx`: ocultação da sugestão de geração de imagem para Claude, preservando análise de imagens.
- Testes correspondentes de catálogo, store, persistência, Documento e composer.

## DECISÃO

`settingsStore` é a preferência do chat, não o resolvedor global de modelos. Por isso, Astra/Gemini continuam em `MODELS` com `hiddenFromChatSelector`, enquanto somente preferências passadas por esse store caem para Luna. Assim Studio e Pulse continuam capazes de usar seus IDs sem uma migração de catálogo ou histórico.

O cache read de Sonnet foi definido em **US$ 0,10/MTok** e o de Opus em **US$ 0,20/MTok**. A confirmação veio da [documentação oficial do Sonnet 5.5](https://platform.claude.com/docs/en/models/sonnet-5-5/overview), seção Pricing, reportada pelo principal durante a execução; ela substitui a estimativa inicial de US$ 0,20 para Sonnet.

## Validação

| Comando | Resultado |
| --- | --- |
| `git diff --check` | exit 0 |
| `npm test -- lib/models/modelConfig.test.ts stores/settingsStore.test.ts stores/settingsStorePersistence.test.ts lib/chat/documentConfig.test.ts components/chat/ChatContainer.test.tsx components/workspace-v2/WorkspaceLayoutV2.test.tsx components/workspace-v2/CommandComposerContainerV2.test.tsx` | exit 0 — 7 arquivos, 67 testes aprovados |
| `npx tsc --noEmit --pretty false` | exit 0 |

Os gates completos, TypeScript, lint, build e a conferência browser pertencem à integração coordenada pelo principal. Nenhuma substituição, remoção de import ou alteração em runtime, dados, credenciais, serviço ou proxy foi feita nesta frente.

## Revisão independente solicitada

Revisados somente para leitura: `package.json`, `package-lock.json`, `systemd/chatgpt.service.d/50-anthropic.conf`, `AGENTS.md`, `BACKLOG.md`, `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/MODELS.md` e `docs/INFRASTRUCTURE.md`.

- O pacote Anthropic está fixado em `0.134.0`; o lockfile contém sua árvore esperada.
- O drop-in não contém segredo e apenas aponta para o `EnvironmentFile` privado preparado, sem instalar nem ativar a unidade.
- A primeira revisão observou que `docs/MODELS.md` não registrava os valores de cache read; o principal confirmou a correção documental para Sonnet US$ 0,10 e Opus US$ 0,20.
- A primeira credencial retornou 401, mas a substituição indicada por Anders foi verificada na Models API para ambos os IDs com HTTP 200. Nenhum segredo foi lido ou exposto nesta revisão; o smoke integrado do chat é coordenado pelo principal.

O painel de configurações `activeMode="image"` não recebeu condição Claude: não há chamada que ative esse modo no app, e seus campos `size`/`quality` pertencem ao fluxo OpenAI separado. Ocultar esse painel por causa do modelo do chat misturaria dois provedores; a sugestão de geração que efetivamente era oferecida na tela de chat foi a superfície removida para Claude.

Na revisão final, `docs/API.md` ainda mantinha o marcador geral “Última atualização” em 2026-10-04 apesar da nova seção Anthropic de 2026-10-15; observação encaminhada ao principal para ajuste editorial.
