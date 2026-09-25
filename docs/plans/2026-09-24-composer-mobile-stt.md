# Composer mobile com folga e retorno visual do STT

## 1. Entrevista e entendimento

Anders mostrou a barra inferior do chat num iPhone e pediu mais folga entre as ferramentas e uma animação pequena ao tocar em STT. A inspeção encontrou anexo, modelo, raciocínio, voz, pesquisa e envio disputando uma faixa mobile. O fluxo de voz já expõe `recording`, `transcribing`, erro e nível de áudio.

Anders escolheu inicialmente duas faixas e uma ondinha discreta no botão de voz. A disposição em duas faixas foi substituída pela correção vinculante abaixo. Quando a permissão do microfone for concedida e a gravação começar, ele verá a ondinha em “Rec”; ao parar, verá a transcrição em andamento. Permissão negada mantém o erro e não mostra gravação ativa.

### 1.1 Aprovação vinculante

Em 2026-09-24, Anders respondeu `Implement the proposed plan.` ao plano apresentado na conversa. A aprovação cobre implementação local, validação e commits da entrega. Não autoriza build no checkout de produção, restart, publicação, push ou alteração de dados runtime.

Em 2026-09-25, após revisar a entrega, Anders corrigiu a escolha visual: quer a barra mobile em uma linha até a lateral, com Pesquisa representada por uma lupa logo após o botão de adicionar. Esta decisão prevalece sobre qualquer menção a duas faixas no plano ou no relatório anterior. A ondinha do STT continua aprovada.

Na mesma revisão, Anders pediu remover o botão “+” de anexos para facilitar. Esta segunda correção prevalece sobre a posição relativa “lupa depois do +”: a lupa passa a ser o primeiro controle. Colar imagem e arrastar arquivos continuam; a escolha manual de arquivo pelo botão sai da interface.

## 2. Objetivo

Dar espaço utilizável às ferramentas do composer mobile e indicar visualmente a gravação real do STT sem mudar seu funcionamento.

## 3. Fica fora

API, persistência, modelos, demais superfícies, produção, Apache e dados runtime privados. No desktop, só saem o botão de anexos e a capacidade de o frame deslizar horizontalmente ao fechar um menu.

## 4. Decisões confirmadas

| Tema | Decisão |
|---|---|
| Layout | Uma faixa mobile: lupa da pesquisa, modelo/raciocínio/Pro, voz e envio até a lateral direita. Sem botão de anexos. |
| STT | Ondinha discreta no botão “Rec” somente durante `recording`; transcrição conserva o indicador existente. |
| Movimento | `prefers-reduced-motion` recebe estado estático. |
| Produção | Worktree isolada, sem publicar ou reiniciar serviço. |

## 5. Grupamento — Ferramentas mobile com espaço

### Objetivo

Distribuir os controles em uma linha mobile, substituindo o texto de Pesquisa por uma lupa e retirando o botão de anexos, sem ampliar a tela horizontalmente.

### Escopo por arquivo

- `components/workspace-v2/WorkspaceLayoutV2.tsx`: grupos responsivos dos controles.
- `components/workspace-v2/CommandComposerContainerV2.tsx`: retirar seletor manual e manter colagem/arraste.
- `app/globals.css`: espaçamento/tokens mobile se necessário.
- `components/workspace-v2/WorkspaceLayoutV2.test.tsx`: estrutura e controles.

### Contratos

A lupa mantém nome acessível e menu. Em 320 px, inclusive com Pro ou “Parar”, não há recorte, quebra nem rolagem horizontal, inclusive depois de escolher um modelo. Colagem de imagem e arrastar/soltar arquivos continuam; o seletor manual de anexo sai da interface. Desktop conserva os demais controles. O frame não aceita deslocamento horizontal programático do menu. O teclado e a área segura do iPhone continuam respeitados.

### Dependências

Usar controles atuais do `CommandComposerV2` e não alterar `useSpeechToText`.

### Testes — camadas interna e externa

Teste focado do composer e inspeção browser em 320, 390 e 430 px, paisagem curta, temas claro/escuro e teclado aberto. Conferir limites dos botões e overflow.

### Evidência de pronto

Capturas da faixa única com lupa à esquerda, envio inteiro e nenhum overflow.

### Preservar

Desktop fora do botão de anexos, seleção de modelo/raciocínio, menus, pesquisa, envio, anexos já adicionados, colagem/arraste, safe area e texto digitado.

## 6. Grupamento — Ondinha de gravação

### Objetivo

Dar retorno visual pequeno apenas quando a captura de áudio estiver ativa.

### Escopo por arquivo

- `components/workspace-v2/WorkspaceLayoutV2.tsx`: ícone e estado visual do botão “Rec”.
- `components/workspace-v2/WorkspaceLayoutV2.test.tsx`: estados parado/gravando/transcrevendo.
- `app/globals.css`: redução de movimento, se necessária.

### Contratos

O estado vem de `isRecording`, não do clique; falha de permissão não anima. O segundo toque encerra a gravação e o indicador de transcrição permanece. Os rótulos acessíveis refletem as ações.

### Dependências

Depende da barra integrada e das props atuais `audioLevel`, `isRecording`, `isTranscribing`.

### Testes — camadas interna e externa

Teste focado de markup/estados e inspeção visual de gravação, transcrição, erro e movimento reduzido com mídia sintética/mocks, sem chamada externa paga.

### Evidência de pronto

Ondinha visível sem deslocar botões; estado reduzido estático.

### Preservar

Gravação, parada, duração, transcrição, erros e fluxo do texto.

## 7. Integração, gates e registro

Após estabilizar: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` sequencialmente, além do Playwright completo aplicável ao frontend e `git diff --check`. Build e browser em worktree isolada. Registrar comandos, códigos de saída, totais, decisões e evidências em `docs/plans/2026-09-24-composer-mobile-stt-report.md`; fechar estado em `BACKLOG.md` e acrescentar entrada ao fim de `docs/DIARIO-AGENTS.md`. Ponto de parada: falha persistente de gate ou mudança de resultado/escopo.
