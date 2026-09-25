# Composer mobile com folga e retorno visual do STT

## 1. Entrevista e entendimento

Anders mostrou a barra inferior do chat num iPhone e pediu mais folga entre as ferramentas e uma animação pequena ao tocar em STT. A inspeção encontrou anexo, modelo, raciocínio, voz, pesquisa e envio disputando uma faixa mobile. O fluxo de voz já expõe `recording`, `transcribing`, erro e nível de áudio.

Anders escolheu duas faixas e uma ondinha discreta no botão de voz. Quando abrir o chat no celular, ele verá modelo/raciocínio acima de anexo/voz/pesquisa/envio. Quando a permissão do microfone for concedida e a gravação começar, verá a ondinha em “Rec”; ao parar, verá a transcrição em andamento. Permissão negada mantém o erro e não mostra gravação ativa.

### 1.1 Aprovação vinculante

Em 2026-09-24, Anders respondeu `Implement the proposed plan.` ao plano apresentado na conversa. A aprovação cobre implementação local, validação e commits da entrega. Não autoriza build no checkout de produção, restart, publicação, push ou alteração de dados runtime.

## 2. Objetivo

Dar espaço utilizável às ferramentas do composer mobile e indicar visualmente a gravação real do STT sem mudar seu funcionamento.

## 3. Fica fora

API, persistência, modelos, desktop, demais superfícies, produção, Apache e dados runtime privados.

## 4. Decisões confirmadas

| Tema | Decisão |
|---|---|
| Layout | Duas faixas mobile: modelo/raciocínio/Pro acima; anexo/voz/pesquisa/envio abaixo. |
| STT | Ondinha discreta no botão “Rec” somente durante `recording`; transcrição conserva o indicador existente. |
| Movimento | `prefers-reduced-motion` recebe estado estático. |
| Produção | Worktree isolada, sem publicar ou reiniciar serviço. |

## 5. Grupamento — Ferramentas mobile com espaço

### Objetivo

Separar configurações das ações de composição sem perder controles ou ampliar a tela horizontalmente.

### Escopo por arquivo

- `components/workspace-v2/WorkspaceLayoutV2.tsx`: grupos responsivos dos controles.
- `app/globals.css`: espaçamento/tokens mobile se necessário.
- `components/workspace-v2/WorkspaceLayoutV2.test.tsx`: estrutura e controles.

### Contratos

Todos os controles continuam visíveis e funcionais; em 320 px não há recorte ou rolagem horizontal. Desktop mantém ordem e apresentação. O teclado e a área segura do iPhone continuam respeitados.

### Dependências

Usar controles atuais do `CommandComposerV2` e não alterar `useSpeechToText`.

### Testes — camadas interna e externa

Teste focado do composer e inspeção browser em 320, 390 e 430 px, paisagem curta, temas claro/escuro e teclado aberto. Conferir limites dos botões e overflow.

### Evidência de pronto

Capturas das duas faixas, envio inteiro e nenhum overflow.

### Preservar

Desktop, seleção de modelo/raciocínio, menus, pesquisa, envio, anexo, safe area e texto digitado.

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
