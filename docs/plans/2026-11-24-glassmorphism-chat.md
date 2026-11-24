# Gaúcho Chat com vidro fosco e painéis flutuantes

## Objetivo

Renovar o Abyssal Ocean e o Polar Fjord com fundo de formas estáticas, placas translúcidas, bordas iluminadas e superfícies densas nas áreas de leitura. O escuro usa azul-marinho, cobalto e ciano. O claro usa branco-gelo e azul suave.

### Decisões de Anders

- Renovar os dois temas do chat. Reusar as escolhas Claro, Escuro e Sistema e a preferência já salva.
- Dar margens e cantos independentes às colunas do desktop. Preservar o espaço de leitura e a geometria de tela cheia no celular e na paisagem curta com toque.
- Implementação autorizada após a aprovação desta proposta. A entrega é uma prévia isolada para revisão visual. Publicação depende de autorização específica.

## Placas e encaixe

- Usar a fonte da build ativa `x181rYVKuPICoBVw54RqS`, originada em `gaucho-ocean-layout`. Capturar o diff dessa fonte sobre `77cb98f` e preparar uma worktree própria para código, testes e build.
- Ajustar `WorkspaceLayoutV2.tsx` e `app/globals.css`. Compor duas formas estáticas em CSS, uma arredondada no alto à esquerda e outra alongada na base. Mostrar o fundo entre as placas de Conversas, Chat e Painel Operacional com 8 px de espaço a partir do tablet e 12 px a partir de 1440 px.
- Preservar o encaixe do painel normal a partir de 1280 px, ampliado a partir de 1440 px e as três colunas completas a partir de 1680 px. Manter uma única instância do painel durante a transição desktop e a gaveta de tela cheia nas dimensões mobile.
- Aplicar o acabamento ao cabeçalho, ao composer, às gavetas e ao Descobrir embutido. Limitar o desfoque às superfícies maiores e usar fundos de contraste estável como fallback. Reusar as container queries e o contrato visual do teclado no celular. O escopo de estilização é o chat principal.

## Validação

- Rodar typegen, TypeScript, lint, testes e build isolada com os scripts do projeto. Rodar as suítes Chrome da entrega anterior e o aceite visual deste tema.
- Comparar a build ativa com a candidata no Chrome com dados sintéticos. Capturar boas-vindas, conversa longa e painel aberto em desktop e celular nos dois temas.
- Verificar antes e depois de 1280, 1440 e 1680 px, em retrato e em paisagem curta com toque. Conferir contraste, separação das placas, rolagem, persistência do tema, edição de mensagem e caixa de texto com teclado aberto.
- Registrar resultados no BACKLOG e no diário. Guardar a comparação e os logs sanitizados junto da evidência de QA fora do repositório.
