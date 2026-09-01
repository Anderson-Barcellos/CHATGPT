# Thematic Memory and Continuous Recall Design

**Status:** especificação e implementação aprovadas por Anders em 2026-08-31; pronta para plano de implementação  
**Data:** 2026-08-31  
**Escopo:** memória híbrida do Gaucho Chat com núcleo compacto, dossiês temáticos, histórico temporal, conversas arquivadas e recall semântico sob demanda

## Objetivo

Substituir a injeção indiscriminada de todas as memórias ativas por uma
arquitetura de continuidade profunda e seletiva. O sistema deve lembrar a
história de Anders, inclusive fatos pessoais e sensíveis úteis à conexão, sem
enviar toda essa história em cada request, misturar versões antigas com o
estado atual ou perder recall quando uma conversa sai da lista principal.

O resultado combina três representações com papéis distintos:

- SQLite como fonte canônica transacional de fatos, temas, versões,
  evidências, conversas arquivadas e auditoria.
- Markdown temático como projeção legível e regenerável para inspeção humana
  e consumo eficiente pelos modelos.
- LanceDB como índice vetorial derivado e reconstruível para recuperação
  semântica.

## Estado atual e problema

O fluxo atual mantém memórias explícitas em `data/memories.json`, conversas em
`data/conversations.json` e chunks vetoriais em `data/memory-index`. O
`contextBuilder` injeta todas as memórias ativas em toda conversa; na inspeção
de 2026-08-31 eram 16 itens, com cerca de 8 mil caracteres. `useChat.ts` também
executa uma busca vetorial antes do request, e as memory tools permitem salvar
ou pesquisar durante o chat padrão.

Esse desenho já oferece persistência e RAG, mas tem quatro limitações:

- Memórias ativas crescem como uma lista global, sem orçamento temático.
- Duplicatas, mudanças temporais e contradições não têm representação própria.
- O índice vetorial é limpo quando uma conversa é excluída, impedindo recall
  posterior.
- O cliente coordena parte da recuperação, enquanto Chat e Pulse montam
  contexto por caminhos diferentes.

## Decisões aprovadas

- Arquitetura híbrida: SQLite canônico, Markdown projetado e LanceDB derivado.
- Quatro camadas: Núcleo, Temas, Histórico e Arquivo.
- Taxonomia híbrida: temas estáveis mais dossiês dinâmicos criados, fundidos,
  renomeados ou arquivados conforme a história evolui.
- Estado atual separado de histórico temporal append-only.
- Consolidação automática para operações de alta confiança, com proveniência,
  auditoria e rollback; baixa confiança e contradições vão para revisão.
- Fatos pessoais, emocionais e de saúde podem ser consolidados
  automaticamente quando forem claros e relevantes à continuidade.
- Senhas, tokens, chaves, credenciais e segredos detectáveis nunca entram no
  banco semântico, nas projeções ou nos embeddings.
- A ação cotidiana de remoção é Arquivar: sai da lista principal, permanece
  visível em seção própria, restaurável e pesquisável.
- Apagar permanentemente remove conteúdo, derivados e evidências exclusivas,
  sem cópias ocultas em logs.
- Recuperação automática server-side com orçamento rígido; `search_memory`
  permanece como segundo nível para investigação explícita ou aprofundada.

## Arquitetura em quatro camadas

### Núcleo

Retrato pequeno e canônico do que deve acompanhar toda conversa: identidade,
preferências vigentes, relações importantes e princípios estáveis. O Núcleo é
composto a partir de fatos vigentes marcados como `core`, deduplicado e
submetido a orçamento rígido de caracteres ou tokens.

Ele não é um arquivo editado livremente pelo modelo. É uma projeção
determinística dos fatos canônicos e pode ser inspecionado e corrigido na UI.

### Temas

Dossiês como projetos, pessoas, saúde, interesses e decisões. Alguns temas
são raízes estáveis; outros surgem dinamicamente quando um assunto demonstra
recorrência ou relevância. Cada dossiê contém apenas o estado atual útil,
relações relevantes e uma linha do tempo curta.

Um tema pode ser renomeado, fundido, dividido ou arquivado. Essas operações
preservam aliases e histórico para que referências antigas continuem
encontráveis sem criar dossiês duplicados.

### Histórico

Registro temporal append-only de criação, reforço, atualização, substituição,
contradição, correção, movimentação e remoção de fatos. A versão vigente
orienta respostas novas. Versões superadas só entram quando a pergunta exige
trajetória, comparação temporal ou explicação de mudança.

### Arquivo

Conversas removidas da lista principal, mas preservadas integralmente e
pesquisáveis. Arquivar não promove automaticamente toda a conversa a memória
canônica; ela continua como evidência bruta e fonte para recall sob demanda.

## Fonte canônica e projeções

### SQLite

O SQLite vive sob `data/` e usa WAL, foreign keys e transações. O banco é a
única fonte autorizada para decidir qual fato está vigente, de onde veio, que
versão substituiu e quais derivados precisam ser reconstruídos.

Entidades conceituais:

- `conversations`: metadados, estado `active | archived` e datas.
- `conversation_messages`: conteúdo canônico das mensagens, papéis, estados e
  timestamps, preservando os IDs atuais.
- `conversation_attachments`: metadados e conteúdo persistido dos anexos
  vinculados às mensagens.
- `memory_topics`: slug, título, resumo, estado, aliases e parentesco.
- `memory_facts`: identidade estável, tema, tipo, sensibilidade, confiança,
  estado atual e intervalo de validade.
- `memory_fact_versions`: conteúdo append-only, motivo da mudança, confiança,
  autor e timestamps.
- `memory_evidence`: vínculo entre versão e conversa/mensagens de origem.
- `memory_conflicts`: versões incompatíveis aguardando resolução.
- `memory_operations`: operação proposta pelo consolidador e resultado da
  validação/aplicação.
- `memory_audit_log`: antes/depois estruturado, origem e vínculo de rollback.
- `memory_jobs`: fila local durável e idempotente para consolidação,
  projeções e embeddings.

Constraints impedem mais de uma versão vigente para a mesma identidade de
fato, evidência órfã e operações parcialmente aplicadas.

### Markdown temático

As projeções ficam em diretório próprio sob `data/`, fora do Git e dos dados
de fixture. Cada tema gera Markdown previsível com metadados mínimos, resumo
vigente, fatos atuais, relações, decisões e linha do tempo curta. Conversas
completas não são copiadas para esses arquivos.

As projeções são escritas de forma atômica e nunca recebem edição livre como
fonte de verdade. Uma futura edição pela UI deve produzir uma operação no
SQLite e então regenerar o arquivo.

### LanceDB

O LanceDB mantém embeddings de fatos vigentes, versões históricas elegíveis,
dossiês e chunks de conversas ativas ou arquivadas. Cada registro referencia
IDs canônicos e carrega tipo, tema, vigência, sensibilidade e timestamp para
filtragem antes do reranking.

O índice pode ser apagado e reconstruído integralmente sem perda canônica.

## Fato de memória e temporalidade

Cada fato possui:

- Identidade estável independente do texto da versão.
- Conteúdo normalizado e tipo semântico.
- Tema principal e relações opcionais com outros temas.
- Classe de sensibilidade e política de recuperação.
- Confiança agregada e quantidade de evidências independentes.
- Estado `current | superseded | conflicted | archived | removed`.
- `validFrom` e `validTo` quando houver temporalidade conhecida.
- Versão vigente e histórico append-only.

Uma repetição equivalente reforça evidência e confiança. Uma mudança datada
cria nova versão e encerra a validade anterior. Uma incompatibilidade sem
explicação temporal cria conflito; não substitui silenciosamente o estado
atual nem entra como instrução canônica.

## Consolidação automática

Quando uma conversa atingir estado terminal, o backend enfileira somente o
delta ainda não processado. O consolidador recebe o trecho novo, temas
candidatos e fatos próximos, e devolve operações estruturadas validadas por
schema:

- criar ou reforçar fato;
- atualizar ou marcar como superado;
- vincular evidência;
- criar, renomear, mover ou fundir tema;
- abrir conflito;
- sugerir promoção ao Núcleo;
- não fazer nada.

O modelo não escreve SQLite ou Markdown diretamente. O backend aplica regras
de autorização, deduplicação, sensibilidade, orçamento e consistência dentro
de uma transação. Operações de alta confiança são automáticas. Baixa
confiança, conflito não resolvido e classificação sensível duvidosa entram na
fila de revisão.

### Deduplicação

A decisão combina chave temática, tipo, entidades normalizadas, similaridade
semântica e evidência textual. Similaridade sozinha não autoriza fusão.
Aliases de temas e identidade estável evitam que pequenas reformulações criem
memórias paralelas.

### Conteúdo pessoal e sensível

Fatos pessoais, emocionais e de saúde podem ser automáticos quando claros e
úteis ao continuum da relação. A sensibilidade controla recuperação e
visibilidade detalhada, não funciona como proibição geral de memória.

Antes de persistir ou criar embedding, um filtro determinístico procura
credenciais e segredos. Itens detectados são descartados da operação e o log
registra somente a categoria da rejeição, nunca o valor.

## Context Assembler server-side

Chat e Pulse passam a usar um montador comum no servidor. A entrada inclui a
mensagem atual, uma janela curta da conversa, o modo de resposta e os temas
recentemente ativos. O montador combina:

- correspondência temática e aliases;
- busca vetorial;
- busca lexical por termos exatos;
- recência e continuidade da conversa;
- confiança, vigência, sensibilidade e frequência de uso.

O reranking monta um pacote limitado com:

- Núcleo sempre presente e deduplicado;
- um a três dossiês pertinentes;
- fatos vigentes sustentados;
- histórico apenas quando a trajetória importar;
- trechos brutos somente como evidência ou recall profundo.

O orçamento inicial de memória do Chat é de 5 mil tokens estimados: até 1.200
para Núcleo, 2.400 para temas e fatos, 700 para histórico e 700 para trechos
brutos. O Pulse usa até 3 mil: 700 para Núcleo, 1.500 para temas e fatos e 800
compartilhados entre histórico e trechos. Limites são configuração server-side;
blocos não usados não obrigam o preenchimento dos demais, e o total nunca é
ultrapassado. A implementação mede o pacote final e trunca em fronteiras de
itens, nunca no meio de um fato.

Cada item conserva IDs de proveniência no envelope interno. O prompt pode
explicar que uma lembrança vem de conversa anterior sem expor metadados
desnecessários. Ausência de resultado relevante produz pacote vazio, nunca
continuidade inventada.

Fatos superados não orientam o presente. Conflitos chegam ao modelo com datas
e instrução para reconhecer incerteza ou pedir confirmação.

## Memory tools

`remember_memory` continua como caminho explícito para Anders ordenar que algo
seja guardado. Em vez de criar texto solto, a tool gera uma operação canônica
com prioridade alta e proveniência da conversa atual.

`search_memory` continua disponível no chat padrão para ampliar uma busca
quando a recuperação automática não bastar ou quando Anders pedir história,
evidência ou detalhe específico. A resposta da tool distingue fatos atuais,
histórico e trechos arquivados.

## Arquivamento, restauração e exclusão

### Arquivar

Arquivar altera o estado da conversa de `active` para `archived`. Ela sai da
rail principal, aparece na seção Arquivadas, mantém embeddings e continua
elegível para recall. Pode ser aberta em modo histórico ou restaurada sem
alterar seu conteúdo.

### Apagar permanentemente

A UI exige confirmação explícita e informa o alcance. Uma transação remove:

- conversa e anexos persistidos;
- chunks e embeddings derivados;
- evidências exclusivas daquela conversa;
- fatos sem qualquer outra evidência, incluindo suas versões com conteúdo;
- conflitos e operações que ficaram sem base.

Fatos sustentados por outras fontes permanecem e perdem apenas a referência
apagada. Fatos exclusivamente derivados da conversa são removidos, não apenas
marcados como inativos. Projeções e índices afetados são regenerados depois da
transação. Logs guardam que uma remoção ocorreu, mas não preservam o conteúdo
apagado.

## Superfície de produto

A área Memória apresenta quatro vistas coerentes com a arquitetura:

- **Núcleo:** contexto sempre presente, orçamento e edição controlada.
- **Temas:** dossiês atuais, aliases, relações e ações de fundir/arquivar.
- **Histórico:** timeline, versões superadas, conflitos e rollback.
- **Arquivadas:** busca, leitura histórica, restauração e exclusão permanente.

A visão padrão privilegia resumos. Proveniência, confiança, sensibilidade,
versões e antes/depois aparecem sob demanda. Toda operação automática pode
ser desfeita; rollback cria uma nova versão e nunca reescreve o passado.

## Processamento assíncrono e falhas

Salvar a conversa é o caminho crítico. Consolidação, projeções e embeddings
rodam depois em fila local durável. Cada job possui chave idempotente,
tentativas limitadas, backoff e estado observável. Falha do modelo extrator,
do LanceDB ou da geração de Markdown não impede o chat de responder.

Ordem de processamento:

1. Persistir conversa e registrar evento/outbox na mesma transação.
2. Consolidar o delta e aplicar operações canônicas.
3. Regenerar projeções temáticas afetadas.
4. Atualizar embeddings afetados.
5. Marcar checkpoint do delta processado.

Saída inválida do modelo é rejeitada integralmente. Não existe escrita
parcial. Jobs travados podem ser retomados depois de restart.

## Migração segura

A migração não altera diretamente os dados vivos na primeira passagem.

1. Criar backup verificável dos JSON e do LanceDB atuais.
2. Importar cópias de conversas, memórias e sugestões preservando IDs e datas.
3. Gerar fatos, temas, versões e evidências no SQLite isolado.
4. Regenerar Markdown e LanceDB a partir do SQLite.
5. Comparar contagens, hashes e uma bateria de recall com o sistema atual.
6. Executar cutover somente depois da equivalência e do rollback comprovado.

Após o cutover, os JSON legados permanecem somente-leitura durante a entrega.
Eles só deixam de ser rollback quando Anders fechar explicitamente a
entrega. Dados runtime reais não são usados como fixtures nem versionados.

## Observabilidade e privacidade

Métricas permitidas: duração, jobs por estado, quantidade de operações,
fatos por tema, resultados recuperados, orçamento de contexto, taxa de
contradição, duplicatas evitadas e falhas por categoria.

Logs não registram conteúdo de fatos, prompts completos, trechos de conversa,
segredos ou embeddings. Auditoria com conteúdo pessoal permanece no banco
autenticado e na UI, não nos logs operacionais.

## Estratégia de testes

### Unitários

- Identidade e deduplicação de fatos equivalentes.
- Nova versão temporal versus conflito real.
- Promoção, substituição e exclusão sem versões vigentes paralelas.
- Detecção e rejeição de credenciais antes de storage/embedding.
- Seleção temática, reranking e orçamento do Context Assembler.
- Serialização determinística das projeções Markdown.

### Integração

- Transação de fatos, versões, evidências, auditoria e outbox.
- Jobs idempotentes após retry e restart.
- Arquivar, restaurar e apagar permanentemente com integridade referencial.
- Rebuild completo de Markdown e LanceDB a partir do SQLite.
- `remember_memory` e `search_memory` sobre o contrato canônico.
- Chat e Pulse consumindo o mesmo montador com budgets próprios.

### Migração

- IDs, timestamps, conteúdo e status preservados.
- Contagens e hashes reconciliados antes do cutover.
- Reexecução segura da migração sem duplicação.
- Rollback comprovado para os JSON e índice anteriores.

### Avaliações de continuidade

Um corpus sintético privado, sem dados pessoais reais no Git, cobre:

- lembrar preferência vigente sem carregar temas irrelevantes;
- alterar uma preferência e recuperar a versão nova;
- explicar a preferência antiga quando perguntado sobre o passado;
- recuperar fato vindo apenas de conversa arquivada;
- não promover contradição incerta;
- evitar duplicata após reformulações;
- excluir permanentemente e não recuperar o conteúdo apagado.

As métricas incluem precisão do recall, contexto irrelevante, fatos
desatualizados, duplicatas, contradições e custo aproximado de tokens antes e
depois.

## Critérios de aceite

- O contexto fixo contém somente Núcleo deduplicado dentro do orçamento.
- Uma mensagem relevante carrega apenas os temas e fatos necessários.
- Fatos superados nunca são apresentados como estado atual.
- Conversas arquivadas somem da rail principal, aparecem em seção própria e
  continuam recuperáveis e restauráveis.
- Exclusão permanente remove conteúdo e derivados, preservando apenas fatos
  sustentados por outras evidências.
- Consolidação automática é auditável e reversível.
- Credenciais detectáveis nunca aparecem no SQLite semântico, Markdown,
  LanceDB ou logs.
- Markdown e LanceDB podem ser reconstruídos integralmente do SQLite.
- Migração mantém IDs, datas e dados e possui rollback comprovado antes do
  cutover.
- Testes, TypeScript, build, smoke autenticado e health local/público passam.
- A comparação mostra redução material do contexto fixo sem perda relevante
  de recall nas avaliações sintéticas.

## Limites desta frente

- Não criar memória compartilhada entre usuários; o Gaucho Chat continua
  pessoal e autenticado para Anders.
- Não usar serviço vetorial externo nem banco remoto na primeira versão.
- Não transformar dossiês em documentos colaborativos editáveis fora da UI.
- Não usar fatos pessoais reais em testes versionados.
- Não migrar dados vivos, apagar JSON legados ou fazer cutover sem backup,
  evidência de equivalência e contrato de entrega aprovado.

## Sequenciamento proposto

Esta especificação descreve a arquitetura completa, mas a implementação deve
ser dividida em entregas revisáveis dentro de uma única frente ativa. O plano
de implementação definirá a menor primeira entrega capaz de estabelecer o
SQLite, o schema e a importação isolada sem mudar ainda o comportamento de
produção. Entregas posteriores poderão ativar consolidação, Context Assembler,
UI de arquivos e cutover somente após seus próprios gates.
