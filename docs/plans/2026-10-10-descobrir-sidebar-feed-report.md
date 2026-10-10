# Feed reutilizável — Descobrir IA na lateral

Data: 2026-10-10  
Estado: pronto para revisão da integração

## Resultado observável

`DiscoverFeed` pode ser montado tanto pela página pública quanto pelo painel do workspace. A rota `/discover` preserva seu cabeçalho, navegação de produto, grade de duas colunas e promoção da matéria aberta no desktop. Com `embedded`, o componente ocupa o espaço flexível do painel, rola no próprio `data-discover-scroll-root`, não cria `h-dvh` nem cabeçalho de produto, limita a largura para a tela ampliada, mantém os cards numa coluna e expande cada matéria no seu lugar.

No painel, as preferências de automação e assuntos começam recolhidas sob um único controle acessível. Buscar novidades, estados de carregamento/erro/vazio, atualizações de assuntos e agenda, polling, fontes e o `MiniAudioPlayer` sob demanda permanecem no mesmo componente; o player continua com `allowRealtime={false}`.

## Arquivos da frente

- `components/discover/DiscoverPage.tsx`
- `components/discover/DiscoverPage.test.tsx`

## DECISÃO

`DiscoverPage` tornou-se uma casca mínima que renderiza `DiscoverFeed`; o estado de leitura, player, mutações e polling fica no feed. O shell pode, portanto, ampliar ou reduzir o painel alterando apenas sua moldura/CSS, sem desmontar essa instância. Validado por rerender do painel incorporado que preserva matéria expandida e player aberto.

O modo `embedded` suprime somente comportamentos que dependem da página inteira: navegação de produto, `h-dvh`, grade de cards, promoção no desktop e `scrollIntoView` ao abrir uma matéria. A página pública mantém esses comportamentos. Essa separação preserva a leitura da rota existente e torna o painel estreito previsível.

## Validação

| Comando | Resultado |
|---|---|
| `npm exec vitest -- run components/discover/DiscoverPage.test.tsx` | código de saída 0; 1 arquivo, 12 testes aprovados, 0 falhas, 0 skips; executado após a alteração final |
| `git diff --check` | código de saída 0; conferido sobre o diff combinado das frentes |

Os testes verificam a página pública, a agenda e as mutações concorrentes já existentes; no painel, verificam rolagem flexível, ausência de cabeçalho/nav, preferências inicialmente fechadas, coluna única, ausência de promoção/rolagem ao abrir e preservação de leitura/player em rerender. Também cobrem loading, vazio e erro no modo incorporado.

Não houve remoção de APIs, imports públicos, TTS ou comportamento da rota `/discover`; `DiscoverPage` continua exportado. Build, lint, tipos, suíte total e QA de navegador pertencem aos gates integrados coordenados pelo orquestrador, pois dependem do shell e devem rodar sobre o conjunto estabilizado.
