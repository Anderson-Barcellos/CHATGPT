# SoundCase — Design de Produto e Arquitetura

**Data:** 2026-09-02

**Estado:** desenho aprovado em conversa; especificação pronta para revisão

**Superfície:** `/chat/soundcase` no deployment público e `/soundcase` no roteamento interno do app
**Referências visuais:** [desktop](./assets/soundcase-desktop-blue.webp) e [mobile](./assets/soundcase-mobile-blue.webp)

## 1. Resultado esperado

Adicionar ao Gaucho Chat uma terceira superfície principal, ao lado de Chat e Studio, para transformar textos longos em leituras agradáveis. O SoundCase combina:

- direção automática de leitura por `gpt-5.6-luna`;
- audição imediata via Realtime no navegador;
- geração durável de um arquivo final via `gpt-4o-mini-tts`;
- capa, resumo, metadados, download e biblioteca de projetos versionados;
- retomada segura depois de fechar a aba, reiniciar o app ou interromper o worker.

O texto original é a fonte de verdade. A direção pode modular voz, ritmo, pausas e pronúncia, mas nunca ganha autorização para resumir, reescrever ou acrescentar conteúdo narrado.

## 2. Escopo da primeira entrega

### Incluído

- Nova rota autenticada do app e navegação `Chat | Studio | SoundCase`.
- Editor central inspirado em uma folha A4, com autosave de rascunho.
- Entrada por digitação, colagem e importação de `.txt` ou `.md`.
- Direção automática pelo Luna, com voz sugerida e overrides manuais.
- Dois comandos: `Gerar e ouvir agora` e `Gerar silenciosamente`.
- Realtime transitório para leitura imediata quando solicitado.
- Job TTS durável, segmentado e retomável, com arquivo único ao final.
- MP3 como formato padrão; FLAC e WAV como overrides.
- Teto estimado de 90 minutos por versão.
- Capa, resumo, duração e histórico de versões.
- Biblioteca lateral no desktop; sheets no mobile.
- Exclusão confirmada de versão ou projeto.

### Limites explícitos

- PDF e DOCX não entram na primeira entrega.
- Livros inteiros não são tratados como um job único; conteúdos acima do teto devem ser divididos em projetos ou capítulos.
- Não há publicação, compartilhamento público, feed, colaboração ou armazenamento externo.
- Não há clonagem de voz, upload de voz nem treinamento personalizado.
- Não há trilha musical, efeitos ou mixagem multifaixa.
- A entrega não altera as preferências globais de TTS do Chat.

## 3. Experiência principal

### 3.1 Projeto e versões

Um SoundCase é um projeto durável. O projeto guarda o rascunho editável atual e uma coleção de versões imutáveis. Cada clique em gerar captura um snapshot do texto e das configurações; editar o projeto depois não altera versões existentes.

Regerar cria uma nova versão ligada ao mesmo projeto. A biblioteca permite reabrir o texto, consultar a direção efetiva, reproduzir ou baixar qualquer versão e comparar escolhas anteriores.

### 3.2 Geração

Ao clicar em `Gerar e ouvir agora`:

1. O servidor salva uma versão imutável e enfileira o job antes de qualquer chamada externa.
2. A folha entra no estado `preparando direção`.
3. O Luna produz um contrato estruturado com título, resumo, voz recomendada, direção global, pronúncias, segmentos e prompt de capa.
4. Assim que a direção está disponível, o navegador inicia a leitura Realtime em uma sequência de trechos fiéis ao texto.
5. Em paralelo, o worker sintetiza e confirma os chunks TTS do arquivo final.
6. O worker monta e valida o arquivo e mede a duração.
7. O player definitivo é liberado; a capa conclui como enriquecimento independente.

`Gerar silenciosamente` executa o mesmo fluxo durável, sem abrir uma sessão Realtime.

Fechar a aba encerra apenas a sessão Realtime. O job final continua no servidor. Quando o usuário retorna, a interface reconcilia o estado persistido.

### 3.3 Transição entre Realtime e arquivo final

O Realtime recebe uma fila de segmentos e abre uma resposta por vez, sempre com o texto exato e a direção aplicável. Isso evita depender de uma única resposta longa e permite parar entre segmentos. O arquivo final nunca substitui o Realtime no meio de uma frase. Quando fica pronto, a interface mostra `Arquivo final pronto`. Se o Realtime estiver tocando, o usuário pode continuar ou migrar voluntariamente para o player definitivo. Se não houver reprodução ativa, o player final passa a ser o controle principal.

### 3.4 Progresso visual

A onda azul sobe pela folha conforme progresso confirmado no backend. Ela acompanha fases e chunks concluídos, sem cronômetro fictício:

`direção → síntese → montagem → áudio pronto`

Falha ou pausa congela a onda na última posição confirmada e troca a legenda por uma ação apropriada. A onda desaparece quando o áudio final está pronto. Resumo e título normalmente já chegam com a direção do Luna; capa e qualquer enriquecimento ausente podem concluir ou ser tentados novamente sem bloquear o áudio.

## 4. Direção inteligente pelo Luna

O `gpt-5.6-luna` usa um prompt-base versionado e Structured Outputs. A resposta contém:

- título curto e resumo editorial;
- idioma e voz recomendada entre as vozes permitidas;
- tom, energia, ritmo e velocidade sugerida;
- instrução global de fidelidade e prosódia;
- glossário de pronúncias difíceis;
- divisões narrativas com instruções específicas por trecho;
- prompt seguro e não textual para a capa.

O modo `Automático` é o padrão. A sidebar mostra a recomendação antes e durante o job. O usuário pode substituir voz, velocidade, formato e instruções. Overrides prevalecem sobre a recomendação e ficam registrados na versão.

O contrato guarda `model`, `promptVersion`, payload validado e origem de cada escolha (`automatic` ou `override`). Se o Luna falhar ou devolver dados inválidos, a versão usa a direção padrão já validada no Chat e registra `directionSource: fallback`.

Os segmentos respeitam parágrafos e frases, com um teto conservador abaixo do limite de entrada do TTS. Cada segmento preserva seu intervalo e hash no texto-fonte. A mesma segmentação alimenta, em ritmos independentes, a fila Realtime do navegador e o manifesto durável do worker.

## 5. Interface e sistema visual

### 5.1 Desktop

O layout aprovado usa três regiões:

- sidebar esquerda estreita para direção e geração;
- centro elástico e dominante com a folha editorial;
- biblioteca direita de largura fixa com o resultado selecionado e gerações anteriores.

O SoundCase consome os tokens reais do Atmosphere Glass. A família de destaque usa `--primary`, `--gc-brand-blue`, `--gc-brand-sky` e superfícies `--gc-*`; não duplica cores hexadecimais extraídas das referências.

A folha usa superfície quente e tipografia editorial apenas para o conteúdo. Controles, metadados e navegação mantêm a tipografia de interface do Chat.

### 5.2 Breakpoints

- Acima de `1280px`: direção, folha e biblioteca convivem.
- De `768px` a `1279px`: a biblioteca recolhe para drawer; direção e folha permanecem.
- Abaixo de `768px`: a folha ocupa a superfície principal; `Direção` e `Acervo` abrem em sheets de tela cheia, e o dock inferior oferece `Direção`, `Acervo` e `Gerar`.

O mobile respeita safe areas, textarea com fonte mínima de 16 px e alvos de toque de pelo menos 44 px. O player Realtime/status final fica imediatamente acima do dock.

### 5.3 Estados visíveis

- rascunho vazio;
- rascunho salvo;
- preparando direção;
- lendo em Realtime;
- sintetizando arquivo com progresso;
- montando e validando;
- áudio pronto e enriquecimento pendente;
- versão pronta;
- interrompida e retomável;
- cancelada;
- falha terminal com diagnóstico seguro.

## 6. Componentes de frontend

- `SoundCaseShell`: composição da página, projeto ativo e responsividade.
- `DirectionSidebar`: automático, recomendações, overrides e ações de geração.
- `SoundCaseEditor`: folha, importação, contagem, estimativa e autosave.
- `GenerationWave`: visualização das fases e progresso confirmado.
- `SoundCaseLibrary`: projetos, versões, estados e exclusão.
- `SoundCaseResult`: capa, resumo e metadados da versão.
- `SoundCasePlayer`: coordenação entre Realtime e arquivo final.
- `SoundCaseMobileDock`: acesso aos sheets e ação principal.

Hooks e clientes de API ficam separados dos componentes visuais. Seletores de estado devem ser estreitos para evitar rerender do editor a cada atualização do job. Módulos pesados ou exclusivos do SoundCase são carregados somente na nova rota.

## 7. Modelo de dados e armazenamento

O armazenamento fica em `data/soundcase/`, ignorado pelo Git e privado ao processo:

```text
data/soundcase/
  projects.json
  jobs.json
  projects/<project-id>/
    draft.txt
    project.json
    versions/<version-id>/
      source.txt
      direction.json
      manifest.json
      chunks/
      cover.png
      final.mp3 | final.flac | final.wav
```

`projects.json` e `jobs.json` são índices pequenos. Texto, chunks e binários não são serializados em base64 dentro deles. Escritas críticas usam arquivo temporário, `fsync` do arquivo, rename atômico e sincronização do diretório pai antes de confirmar a mutação.

### 7.1 Projeto

Campos essenciais: `id`, `title`, `draftRevision`, `activeVersionId`, `createdAt`, `updatedAt`, `deletedAt` opcional e metadados da importação.

### 7.2 Versão

Campos essenciais: `id`, `projectId`, `status`, `sourceHash`, `wordCount`, `estimatedDurationSeconds`, `direction`, `settings`, `progress`, `audio`, `cover`, `summary`, `createdAt`, `completedAt` e erro seguro opcional.

### 7.3 Job e chunks

O job guarda `id`, `versionId`, `status`, `attempt`, `leaseOwner`, `leaseExpiresAt`, `nextRunAt`, `createdAt` e `updatedAt`. O manifesto de chunks preserva índice, intervalo no texto, hash, status, tentativas, caminho do arquivo e duração confirmada.

O hash do texto e das configurações forma a chave idempotente. Um segundo clique enquanto uma versão equivalente está ativa devolve a versão existente, em vez de cobrar uma nova geração.

## 8. APIs

Todas as rotas abaixo usam a autenticação existente:

- `GET/POST /api/soundcase/projects`
- `GET/PATCH/DELETE /api/soundcase/projects/:projectId`
- `POST /api/soundcase/projects/:projectId/import`
- `GET/POST /api/soundcase/projects/:projectId/versions`
- `GET/DELETE /api/soundcase/projects/:projectId/versions/:versionId`
- `POST /api/soundcase/projects/:projectId/versions/:versionId/cancel`
- `POST /api/soundcase/projects/:projectId/versions/:versionId/resume`
- `GET /api/soundcase/projects/:projectId/versions/:versionId/audio`
- `GET /api/soundcase/projects/:projectId/versions/:versionId/cover`
- `POST /api/soundcase/realtime-call`
- `POST /api/soundcase/worker/run-next` para loopback autenticado pelo token do worker.

O endpoint de áudio implementa `Range`, `Content-Length`, `Content-Range`, `Accept-Ranges`, tipo correto e download com nome saneado. Rotas de arquivos resolvem IDs conhecidos; não aceitam caminhos arbitrários do cliente.

O frontend usa polling moderado durante jobs ativos e reconcilia ao montar, recuperar visibilidade ou voltar da rede. Estados terminais encerram o polling.

## 9. Worker durável e systemd

A API enfileira o job e atualiza `jobs.json`. Um `systemd.path` observa a fila e aciona imediatamente um serviço oneshot. O runner chama o endpoint interno em loop até receber fila vazia. Um timer de recuperação também desperta o serviço periodicamente para cobrir reinício do app, perda de evento do path ou lease expirado.

O worker usa lease e compare-and-swap para reivindicar um job. Apenas um job pesado roda por vez. Dentro dele, chunks independentes podem usar concorrência baixa e configurável; o padrão inicial é 2. A ordem do áudio sempre segue o manifesto, não a ordem de conclusão das requisições.

Cada chunk é gravado e validado antes de ser marcado como concluído. O FFmpeg instalado no host monta o arquivo final; o FFprobe valida duração, codec e integridade antes da publicação interna. Arquivos temporários permanecem fora do caminho servido e são promovidos por rename.

Os chunks duráveis usam FLAC como intermediário canônico. Depois da concatenação na ordem do manifesto, o FFmpeg produz o formato escolhido: MP3 para o padrão compacto, FLAC para alta fidelidade ou WAV para edição externa. Intermediários permitem retomar e reencodar sem repetir chamadas TTS.

O worker usa `OPENAI_API_KEY` já existente. Um `SOUNDCASE_WORKER_TOKEN` separado protege a rota interna e nunca vai para o cliente ou para logs.

## 10. Degradação graciosa e retomada

- Falha de Realtime não altera o job TTS.
- Falha do Luna ativa direção padrão e mantém a geração disponível.
- Falha transitória de TTS recebe retry com espera exponencial e jitter.
- Falha após o limite deixa a versão `interrupted`, com retomada do primeiro chunk ausente ou inválido.
- Chunks válidos não são repetidos depois de restart.
- Falha de capa não bloqueia o áudio; uma capa tipográfica local ocupa o lugar e o enriquecimento pode ser repetido.
- Cancelamento interrompe Realtime e novas chamadas TTS, preservando projeto e chunks válidos.
- Exclusão exige confirmação e remove apenas o projeto ou versão resolvido por ID.

Erros visíveis explicam a ação possível. Logs registram IDs, fase, latência, contagem de tentativas e código do provider, sem texto integral, instruções pessoais, áudio ou credenciais.

## 11. Segurança e privacidade

- Autenticação obrigatória em projetos, assets e Realtime.
- Chave OpenAI somente no backend.
- IDs opacos e validação de ownership/localidade em todas as rotas.
- Limites de tamanho antes da leitura integral do upload.
- MIME, extensão e UTF-8 validados para `.txt` e `.md`.
- Proteção contra path traversal e symlinks na árvore privada.
- Assets com cache privado e sem exposição estática pelo Apache.
- Texto do usuário fora de logs e mensagens de erro.
- Dados de runtime existentes nunca usados como fixture.

## 12. Validação

### 12.1 Testes automatizados

- Schema do Luna, fallback e precedência de overrides.
- Estimativa de duração e limite de 90 minutos.
- Segmentação que preserva ordem e conteúdo narrável.
- Idempotência, store atômico, lease, CAS e retomada.
- Simulação de 90 minutos sem chamadas pagas.
- Retries, cancelamento, restart e enriquecimento parcial.
- Autenticação, importação, assets, `Range` e path traversal.
- Estados de UI, autosave, players, biblioteca, versões e sheets.
- Acessibilidade básica por teclado, foco, nomes e touch targets.

### 12.2 Smoke real

- Texto temporário com aproximadamente 15 minutos de leitura.
- Realtime iniciado depois da direção do Luna.
- Job continua depois de fechar e reabrir a aba.
- Interrupção controlada do worker seguida de retomada sem duplicação.
- MP3 final reproduzível, buscável e baixável.
- Geração focal em FLAC e WAV.
- Capa, resumo, duração e metadados persistidos.
- Cleanup do projeto temporário ao final.

### 12.3 Escada de fechamento

- testes focados durante a implementação;
- `npm test`;
- `npx tsc --noEmit`;
- `npm run build` com `NEXT_PUBLIC_BASE_PATH=/chat` quando exigido pelo ambiente;
- instalação/validação das units systemd;
- restart controlado de `chatgpt.service` e health local/público;
- QA em Chrome desktop e viewport mobile;
- comparação por `view_image` entre screenshots finais e as duas referências aprovadas;
- `git diff --check` e revisão de escopo.

## 13. Critério de pronto

A entrega fica `pronta para revisão` quando Anders consegue criar ou importar um texto, manter o Luna em automático ou aplicar overrides, ouvir via Realtime, fechar a aba, retornar ao projeto, acompanhar o job durável, reproduzir/baixar o arquivo final e reencontrar a versão com capa e metadados na biblioteca. O fluxo deve sobreviver a uma interrupção real do worker sem repetir chunks confirmados, e as validações da seção 12 devem estar verdes ou ter limitações explicitamente registradas.

Fechar a entrega, publicar externamente, fazer push ou iniciar outra frente continuam sendo decisões explícitas de Anders.
